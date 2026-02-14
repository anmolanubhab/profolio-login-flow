import React from "react";
import { ResponsiveDrawer } from "./ResponsiveDrawer";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface SessionsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SessionRow = {
  id: string;
  device_id: string;
  device_name: string | null;
  user_agent: string | null;
  last_active: string;
  is_current: boolean;
};

async function sha(text: string) {
  const enc = new TextEncoder();
  const data = enc.encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const arr = Array.from(new Uint8Array(digest));
  return arr.map(b => b.toString(16).padStart(2, "0")).join("");
}

export const SessionsDrawer: React.FC<SessionsDrawerProps> = ({ open, onOpenChange }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [list, setList] = React.useState<SessionRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [fetching, setFetching] = React.useState(false);
  const [signingOutOthers, setSigningOutOthers] = React.useState(false);

  const syncCurrent = React.useCallback(async () => {
    if (!user) return;
    const ua = navigator.userAgent;
    const deviceName = navigator.platform || "This device";
    const deviceId = await sha(ua + "|" + deviceName);
    await supabase.from("user_sessions").upsert({
      user_id: user.id,
      device_id: deviceId,
      device_name: deviceName,
      user_agent: ua,
      is_current: true,
      last_active: new Date().toISOString(),
    }, { onConflict: "device_id" } as any);
  }, [user]);

  const load = React.useCallback(async () => {
    if (!user) return;
    setFetching(true);
    try {
      await syncCurrent();
      const { data, error } = await supabase
        .from("user_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("last_active", { ascending: false });
      if (error) throw error;
      setList(data as any);
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to load sessions", variant: "destructive" });
    } finally {
      setFetching(false);
    }
  }, [user, syncCurrent, toast]);

  React.useEffect(() => {
    if (open) load();
  }, [open, load]);

  const signOutOthers = async () => {
    setSigningOutOthers(true);
    try {
      const signOutAny = (supabase.auth as any).signOut;
      if (typeof signOutAny === "function") {
        try {
          await signOutAny({ scope: "others" });
        } catch {}
      }
      if (user) {
        const ua = navigator.userAgent;
        const deviceName = navigator.platform || "This device";
        const deviceId = await sha(ua + "|" + deviceName);
        await supabase.from("user_sessions").delete().eq("user_id", user.id).neq("device_id", deviceId);
      }
      toast({ title: "Signed out from other devices" });
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to sign out others", variant: "destructive" });
    } finally {
      setSigningOutOthers(false);
    }
  };

  return (
    <ResponsiveDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Where you're signed in"
      footer={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading || fetching}>Close</Button>
          <Button onClick={signOutOthers} disabled={signingOutOthers} className="bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] text-white">
            {signingOutOthers ? "Signing out…" : "Sign out from other devices"}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {fetching ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent mx-2" />
        ) : (
          <ul className="divide-y divide-gray-100">
            {list.map(s => (
              <li key={s.id} className="py-3 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className={"text-sm " + (s.is_current ? "font-semibold text-foreground" : "text-foreground")}>
                    {s.device_name || "Unknown device"} {s.is_current ? "(Current)" : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {s.user_agent || "Browser"} • Last active {new Date(s.last_active).toLocaleString()}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ResponsiveDrawer>
  );
};

