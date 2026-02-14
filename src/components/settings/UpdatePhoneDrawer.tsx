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
  currentPhone?: string | null;
}

export const UpdatePhoneDrawer: React.FC<Props> = ({ open, onOpenChange, currentPhone }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [newPhone, setNewPhone] = React.useState("");
  const [otpSent, setOtpSent] = React.useState(false);
  const [otp, setOtp] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const sendOtp = async () => {
    if (!newPhone) {
      toast({ title: "Error", description: "Phone number is required.", variant: "destructive" });
      return;
    }
    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({ phone: newPhone });
      if (error) throw error;
      setOtpSent(true);
      toast({ title: "OTP sent", description: "Enter the code sent to your new phone." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to send OTP.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const verifyAndSave = async () => {
    if (!user) return;
    if (!otp) {
      toast({ title: "Error", description: "Enter the OTP code.", variant: "destructive" });
      return;
    }
    try {
      setLoading(true);
      // Attempt to verify phone change token
      // Some projects may require different 'type'; adjust if your project uses another type
      await supabase.auth.verifyOtp({ phone: newPhone, token: otp, type: "phone_change" as any });
      const { error } = await supabase.from("profiles").update({ phone: newPhone }).eq("user_id", user.id);
      if (error) throw error;
      toast({ title: "Phone updated", description: "Phone number updated successfully." });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to verify OTP.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Update phone number"
      footer={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          {otpSent ? (
            <Button onClick={verifyAndSave} disabled={loading || !otp} className="bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] text-white">
              {loading ? "Verifying..." : "Verify & Save"}
            </Button>
          ) : (
            <Button onClick={sendOtp} disabled={loading || !newPhone} className="bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] text-white">
              {loading ? "Sending..." : "Send OTP"}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="currentPhone">Current phone</Label>
          <Input id="currentPhone" value={currentPhone ?? "Not provided"} readOnly />
        </div>
        <div>
          <Label htmlFor="newPhone">New phone</Label>
          <Input id="newPhone" placeholder="+1 555 555 5555" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
        </div>
        {otpSent && (
          <div>
            <Label htmlFor="otp">Enter OTP</Label>
            <Input id="otp" placeholder="123456" value={otp} onChange={(e) => setOtp(e.target.value)} />
          </div>
        )}
      </div>
    </ResponsiveDrawer>
  );
};

