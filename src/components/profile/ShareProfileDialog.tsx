import { useState } from "react";
import { Check, Copy, ExternalLink, Mail, Share2 } from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
} from "@/components/ui/responsive-modal";
import { profileShareUrl } from "@/components/profile/profileTypes";

interface ShareProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  displayName: string;
}

export const ShareProfileDialog = ({
  open,
  onOpenChange,
  profileId,
  displayName,
}: ShareProfileDialogProps) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const url = profileShareUrl(profileId);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: "Link copied" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Couldn’t copy",
        description: "Copy the link manually from the field above.",
        variant: "destructive",
      });
    }
  };

  const nativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `${displayName} on Profolio`,
          url,
        });
      } catch {
        /* user cancelled */
      }
    }
  };

  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="sm:max-w-md">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Share profile</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Anyone with the link can open {displayName}’s profile (subject to
            their visibility settings).
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <div className="space-y-3">
          <div className="flex gap-2">
            <Input value={url} readOnly onFocus={(e) => e.currentTarget.select()} />
            <Button onClick={copy} className="shrink-0 gap-2">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>

          <div className="grid gap-2">
            {canNativeShare && (
              <Button variant="outline" className="justify-start gap-2" onClick={nativeShare}>
                <Share2 className="h-4 w-4" />
                Share via…
              </Button>
            )}
            <Button variant="outline" className="justify-start gap-2" asChild>
              <a
                href={`mailto:?subject=${encodeURIComponent(
                  `${displayName} on Profolio`
                )}&body=${encodeURIComponent(url)}`}
              >
                <Mail className="h-4 w-4" />
                Share by email
              </a>
            </Button>
            <Button variant="outline" className="justify-start gap-2" asChild>
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                Open in a new tab
              </a>
            </Button>
          </div>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
};

export default ShareProfileDialog;
