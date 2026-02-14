import React from "react";
import { ResponsiveDrawer } from "./ResponsiveDrawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const UpdateEmailDrawer: React.FC<Props> = ({ open, onOpenChange }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [newEmail, setNewEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const onSave = async () => {
    if (!user) return;
    if (!newEmail || !password) {
      toast({ title: "Error", description: "All fields are required.", variant: "destructive" });
      return;
    }
    try {
      setLoading(true);
      const { data: signInRes, error: signInErr } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password,
      });
      if (signInErr) throw signInErr;
      if (!signInRes.user) throw new Error("Authentication failed.");
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      toast({ title: "Email update", description: "Verification email sent to your new address." });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to update email.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Update email address"
      footer={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={loading || !newEmail || !password} className="bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] text-white">
            {loading ? "Saving..." : "Save changes"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="currentEmail">Current email</Label>
          <Input id="currentEmail" value={user?.email ?? ""} readOnly />
        </div>
        <div>
          <Label htmlFor="newEmail">New email</Label>
          <Input id="newEmail" placeholder="name@example.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="password">Confirm password</Label>
          <Input id="password" type="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
      </div>
    </ResponsiveDrawer>
  );
};

