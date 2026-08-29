import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
} from "@/components/ui/responsive-modal";

const REASONS = [
  "Spam or scam",
  "Harassment or hate",
  "Impersonation or fake profile",
  "Inappropriate content",
  "Something else",
] as const;

interface ReportProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportedProfileId: string;
  reporterProfileId: string | null;
  displayName: string;
}

export const ReportProfileDialog = ({
  open,
  onOpenChange,
  reportedProfileId,
  reporterProfileId,
  displayName,
}: ReportProfileDialogProps) => {
  const { toast } = useToast();
  const [reason, setReason] = useState<string>(REASONS[0]);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setReason(REASONS[0]);
      setDetails("");
    }
  }, [open]);

  const submit = async () => {
    if (!reporterProfileId) {
      toast({
        title: "Sign in required",
        description: "You need a profile to report members.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("profile_reports").insert({
        reporter_id: reporterProfileId,
        reported_profile_id: reportedProfileId,
        reason,
        details: details.trim() || null,
      });

      if (error) {
        // 23505 = unique_violation → already reported
        if ((error as { code?: string }).code === "23505") {
          toast({
            title: "Already reported",
            description: "You’ve already reported this profile. Our team will review it.",
          });
          onOpenChange(false);
          return;
        }
        throw error;
      }

      toast({
        title: "Report submitted",
        description: "Thanks — our team will review this profile.",
      });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Couldn’t submit report",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="sm:max-w-md">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Report {displayName}</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Reports are private. The member won’t be told who reported them.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <div className="space-y-4">
          <RadioGroup value={reason} onValueChange={setReason} className="space-y-2">
            {REASONS.map((r) => (
              <div key={r} className="flex items-center gap-2">
                <RadioGroupItem value={r} id={`reason-${r}`} />
                <Label htmlFor={`reason-${r}`} className="font-normal">
                  {r}
                </Label>
              </div>
            ))}
          </RadioGroup>

          <div>
            <Label htmlFor="report-details">Additional details (optional)</Label>
            <Textarea
              id="report-details"
              rows={3}
              maxLength={1000}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Anything that helps us understand the issue"
            />
          </div>
        </div>

        <ResponsiveModalFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting} variant="destructive">
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting…
              </>
            ) : (
              "Submit report"
            )}
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
};

export default ReportProfileDialog;
