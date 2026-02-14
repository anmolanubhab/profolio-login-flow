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
  onSuccess?: () => void;
}

function getStrength(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 2) return "weak";
  if (score === 3 || score === 4) return "medium";
  return "strong";
}

export const UpdatePasswordDrawer: React.FC<Props> = ({ open, onOpenChange, onSuccess }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const strength = getStrength(next);
  const canSave = current.length > 0 && next.length >= 8 && next === confirm;

  const onSave = async () => {
    if (!user) return;
    if (!canSave) {
      toast({ title: "Error", description: "Please meet all validation requirements.", variant: "destructive" });
      return;
    }
    try {
      setLoading(true);
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: current,
      });
      if (signInErr) throw signInErr;
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;
      toast({ title: "Password updated successfully." });
      if (onSuccess) {
        try {
          await onSuccess();
        } catch {}
      }
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to update password.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Change password"
      footer={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={loading || !canSave} className="bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] text-white">
            {loading ? "Saving..." : "Save changes"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="currentPw">Current password</Label>
          <Input id="currentPw" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="newPw">New password</Label>
          <Input id="newPw" type="password" value={next} onChange={(e) => setNext(e.target.value)} />
          <div className="text-xs mt-1">
            <span className={strength === "weak" ? "text-red-500" : strength === "medium" ? "text-yellow-600" : "text-green-600"}>
              Strength: {strength}
            </span>
          </div>
        </div>
        <div>
          <Label htmlFor="confirmPw">Confirm new password</Label>
          <Input id="confirmPw" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <p className="text-xs text-muted-foreground">
          Minimum 8 characters. Include uppercase, lowercase, number, and symbol for a stronger password.
        </p>
      </div>
    </ResponsiveDrawer>
  );
};
