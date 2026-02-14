import React from "react";
import { ResponsiveDrawer } from "./ResponsiveDrawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface EmailAddressesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type EmailRow = {
  id: string;
  email: string;
  is_primary: boolean;
  verified: boolean;
};

export const EmailAddressesDrawer: React.FC<EmailAddressesDrawerProps> = ({ open, onOpenChange }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [list, setList] = React.useState<EmailRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [fetching, setFetching] = React.useState(false);
  const [newEmail, setNewEmail] = React.useState("");

  const load = React.useCallback(async () => {
    if (!user) return;
    setFetching(true);
    try {
      const { data, error } = await supabase
        .from("user_emails")
        .select("id,email,is_primary,verified")
        .eq("user_id", user.id)
        .order("is_primary", { ascending: false });
      if (error) throw error;
      const rows = (data || []) as EmailRow[];
      const existsPrimary = rows.some(r => r.is_primary);
      if (!existsPrimary && user.email) {
        // Ensure current auth email appears as primary
        rows.unshift({
          id: "auth-email",
          email: user.email,
          is_primary: true,
          verified: true,
        });
      }
      setList(rows);
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to load emails", variant: "destructive" });
    } finally {
      setFetching(false);
    }
  }, [user, toast]);

  React.useEffect(() => {
    if (open) load();
  }, [open, load]);

  const addEmail = async () => {
    if (!user || !newEmail) return;
    try {
      setLoading(true);
      const { error: updErr } = await supabase.auth.updateUser({ email: newEmail });
      if (updErr) throw updErr;
      await supabase.from("user_emails").insert({
        user_id: user.id,
        email: newEmail,
        is_primary: false,
        verified: false,
      });
      toast({ title: "Verification email sent to your new address." });
      setNewEmail("");
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to add email", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const makePrimary = async (row: EmailRow) => {
    if (!user) return;
    try {
      setLoading(true);
      const { error: updErr } = await supabase.auth.updateUser({ email: row.email });
      if (updErr) throw updErr;
      // optimistic local update
      setList(prev => prev.map(r => ({ ...r, is_primary: r.email === row.email })));
      toast({ title: "Verification email sent to your new address." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to make primary", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const removeEmail = async (row: EmailRow) => {
    if (!user) return;
    if (row.is_primary) {
      toast({ title: "Error", description: "Cannot remove primary email", variant: "destructive" });
      return;
    }
    try {
      setLoading(true);
      await supabase.from("user_emails").delete().eq("id", row.id);
      toast({ title: "Email removed" });
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to remove email", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Email addresses"
      footer={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading || fetching}>Close</Button>
          <Button onClick={addEmail} disabled={loading || !newEmail} className="bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] text-white">
            {loading ? "Saving…" : "Add Email"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {fetching ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent mx-2" />
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="email">Add new email</Label>
              <Input id="email" placeholder="name@example.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </div>
            <ul className="divide-y divide-gray-100">
              {list.length === 0 ? (
                <li className="py-2 text-sm text-muted-foreground">No email added</li>
              ) : list.map((row) => (
                <li key={row.id + row.email} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="text-sm text-foreground">{row.email}</span>
                    <span className="text-xs text-muted-foreground">
                      {row.is_primary ? "Primary" : "Secondary"} • {row.verified ? "Verified" : "Pending verification"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {!row.is_primary && (
                      <Button variant="outline" onClick={() => makePrimary(row)} disabled={loading}>Make primary</Button>
                    )}
                    {!row.is_primary && row.id !== "auth-email" && (
                      <Button variant="outline" onClick={() => removeEmail(row)} disabled={loading}>Remove</Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </ResponsiveDrawer>
  );
};

