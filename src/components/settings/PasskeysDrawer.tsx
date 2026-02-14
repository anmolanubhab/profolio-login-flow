import React from "react";
import { ResponsiveDrawer } from "./ResponsiveDrawer";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface PasskeysDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Passkey = {
  id: string;
  credential_id: string;
  device_name: string | null;
  created_at: string;
};

function strToBuffer(str: string) {
  return new TextEncoder().encode(str);
}

export const PasskeysDrawer: React.FC<PasskeysDrawerProps> = ({ open, onOpenChange }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [list, setList] = React.useState<Passkey[]>([]);
  const [fetching, setFetching] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!user) return;
    setFetching(true);
    try {
      const { data, error } = await supabase
        .from("user_passkeys")
        .select("id, credential_id, device_name, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setList(data as any);
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to fetch passkeys", variant: "destructive" });
    } finally {
      setFetching(false);
    }
  }, [user, toast]);

  React.useEffect(() => {
    if (open) load();
  }, [open, load]);

  const addPasskey = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const publicKey: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: { name: "Profolio", id: window.location.hostname },
        user: {
          id: strToBuffer(user.id),
          name: user.email || user.id,
          displayName: user.email || user.id,
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: { userVerification: "preferred" },
        timeout: 60000,
      };
      const cred = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null;
      if (!cred) throw new Error("Passkey creation was cancelled");
      const credentialId = cred.id;
      const deviceName = navigator.platform || "This device";
      const { error } = await supabase
        .from("user_passkeys")
        .insert({ user_id: user.id, credential_id: credentialId, device_name: deviceName });
      if (error) throw error;
      toast({ title: "Passkey added" });
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to add passkey", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const removePasskey = async (id: string) => {
    try {
      const { error } = await supabase.from("user_passkeys").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Passkey removed" });
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to remove passkey", variant: "destructive" });
    }
  };

  return (
    <ResponsiveDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Passkeys"
      footer={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading || fetching}>Close</Button>
          <Button onClick={addPasskey} disabled={loading} className="bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] text-white">
            {loading ? "Adding…" : "Add Passkey"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {fetching ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent mx-2" />
        ) : list.length === 0 ? (
          <div className="text-sm text-muted-foreground">No passkeys added</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {list.map(item => (
              <li key={item.id} className="flex items-center justify-between py-3">
                <div className="flex flex-col">
                  <span className="text-sm text-foreground">{item.device_name || "Unknown device"}</span>
                  <span className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</span>
                </div>
                <Button variant="outline" onClick={() => removePasskey(item.id)}>Remove</Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ResponsiveDrawer>
  );
};

