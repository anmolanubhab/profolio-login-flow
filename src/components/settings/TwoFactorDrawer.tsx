import React from "react";
import { ResponsiveDrawer } from "./ResponsiveDrawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface TwoFactorDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function base32encode(bytes: Uint8Array) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, value = 0, output = "";
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }
  return output;
}

async function hotp(secret: Uint8Array, counter: number) {
  const msg = new ArrayBuffer(8);
  const view = new DataView(msg);
  view.setUint32(4, counter);
  const key = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, msg);
  const h = new Uint8Array(sig);
  const offset = h[h.length - 1] & 0x0f;
  const bin = ((h[offset] & 0x7f) << 24) | (h[offset + 1] << 16) | (h[offset + 2] << 8) | (h[offset + 3]);
  return (bin % 1e6).toString().padStart(6, "0");
}

async function totp(secret: Uint8Array, step = 30) {
  const counter = Math.floor(Date.now() / 1000 / step);
  return hotp(secret, counter);
}

export const TwoFactorDrawer: React.FC<TwoFactorDrawerProps> = ({ open, onOpenChange }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [method, setMethod] = React.useState<"totp" | "sms">("totp");
  const [secretB32, setSecretB32] = React.useState<string>("");
  const [code, setCode] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [showSetup, setShowSetup] = React.useState(false);
  const [recoveryCodes, setRecoveryCodes] = React.useState<string[] | null>(null);

  const startTotp = async () => {
    const raw = new Uint8Array(20);
    crypto.getRandomValues(raw);
    const b32 = base32encode(raw);
    setSecretB32(b32);
    setShowSetup(true);
  };

  const saveTotp = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const secretBytes = new TextEncoder().encode(secretB32);
      const expected = await totp(secretBytes);
      if (expected !== code) throw new Error("Invalid code");

      await supabase.from("user_twofactor").upsert({
        user_id: user.id,
        method: "totp",
        totp_secret: secretB32,
      });
      await supabase.from("profiles").update({
        two_factor_enabled: true,
        two_factor_type: "totp",
      }).eq("user_id", user.id);

      const gen: string[] = [];
      for (let i = 0; i < 8; i++) {
        const buf = new Uint8Array(8);
        crypto.getRandomValues(buf);
        const plain = Array.from(buf).map(b => b.toString(16).padStart(2, "0")).join("");
        const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(plain));
        const hashHex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, "0")).join("");
        await supabase.from("user_recovery_codes").insert({
          user_id: user.id,
          code_hash: hashHex,
        });
        gen.push(plain);
      }
      setRecoveryCodes(gen);
      toast({ title: "Two-factor enabled" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to enable 2FA", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const disable2fa = async () => {
    if (!user) return;
    try {
      setLoading(true);
      await supabase.from("profiles").update({
        two_factor_enabled: false,
        two_factor_type: null,
      } as any).eq("user_id", user.id);
      await supabase.from("user_twofactor").delete().eq("user_id", user.id);
      await supabase.from("user_recovery_codes").delete().eq("user_id", user.id);
      toast({ title: "Two-factor disabled" });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to disable 2FA", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Two-factor authentication"
      footer={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Close</Button>
          {!showSetup ? (
            <Button onClick={startTotp} className="bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] text-white" disabled={loading}>
              Set up Authenticator App
            </Button>
          ) : (
            <Button onClick={saveTotp} className="bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] text-white" disabled={loading || !code}>
              Verify & Enable
            </Button>
          )}
        </div>
      }
    >
      {!showSetup ? (
        <div className="space-y-4 text-sm text-muted-foreground">
          <p>Use an Authenticator App to protect your account.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <Label>Secret key</Label>
            <div className="text-sm font-mono p-2 rounded bg-muted mt-1">{secretB32}</div>
            <p className="text-xs text-muted-foreground mt-1">Add this key to your authenticator app. Then enter the 6-digit code below.</p>
          </div>
          <div>
            <Label htmlFor="code">Enter 6-digit code</Label>
            <Input id="code" inputMode="numeric" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          {recoveryCodes && (
            <div>
              <Label>Recovery codes</Label>
              <ul className="mt-1 grid grid-cols-2 gap-2">
                {recoveryCodes.map((c, i) => (
                  <li key={i} className="text-xs font-mono p-2 rounded bg-muted">{c}</li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground mt-2">Save these codes in a safe place. Each code can be used once.</p>
            </div>
          )}
          <div className="pt-2">
            <Button variant="outline" onClick={disable2fa} disabled={loading}>Disable 2FA</Button>
          </div>
        </div>
      )}
    </ResponsiveDrawer>
  );
};

