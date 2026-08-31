import { useEffect, useState } from "react";
import {
  MoreHorizontal,
  Share2,
  Link as LinkIcon,
  IdCard,
  FileDown,
  Flag,
  Ban,
  ShieldCheck,
  Eye,
  Loader2,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  profileDisplayName,
  profileHeadline,
  profileShareUrl,
  type ProfileContextValue,
} from "@/components/profile/profileTypes";

interface ProfileMoreMenuProps {
  ctx: ProfileContextValue;
  onShare: () => void;
  onContactInfo: () => void;
  onReport: () => void;
  onEditVisibility: () => void;
}

async function saveProfilePdf(ctx: ProfileContextValue) {
  const { profile } = ctx;
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  let y = margin;
  const width = doc.internal.pageSize.getWidth() - margin * 2;

  const line = (
    text: string,
    size: number,
    opts: { bold?: boolean; gap?: number } = {}
  ) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(size);
    const wrapped = doc.splitTextToSize(text, width);
    doc.text(wrapped, margin, y);
    y += wrapped.length * (size + 4) + (opts.gap ?? 6);
  };

  line(profileDisplayName(profile), 22, { bold: true });
  const hl = profileHeadline(profile);
  if (hl) line(hl, 12);
  if (profile.pronouns) line(`(${profile.pronouns})`, 10);
  if (profile.location) line(profile.location, 11, { gap: 12 });

  if (profile.bio) {
    line("About", 14, { bold: true });
    line(profile.bio, 11, { gap: 14 });
  }

  const contact: string[] = [];
  if (profile.email) contact.push(`Email: ${profile.email}`);
  if (profile.phone) contact.push(`Phone: ${profile.phone}`);
  if (profile.website) contact.push(`Website: ${profile.website}`);
  if (profile.linkedin_url) contact.push(`LinkedIn: ${profile.linkedin_url}`);
  if (profile.github_url) contact.push(`GitHub: ${profile.github_url}`);
  if (contact.length) {
    line("Contact", 14, { bold: true });
    contact.forEach((c) => line(c, 11));
    y += 8;
  }

  line(`Profile: ${profileShareUrl(profile.id)}`, 10);

  const safeName = profileDisplayName(profile)
    .replace(/[^\w]+/g, "_")
    .toLowerCase();
  doc.save(`${safeName || "profile"}_profolio.pdf`);
}

export const ProfileMoreMenu = ({
  ctx,
  onShare,
  onContactInfo,
  onReport,
  onEditVisibility,
}: ProfileMoreMenuProps) => {
  const { toast } = useToast();
  const { profile, profileId, viewerProfileId, isOwner } = ctx;
  const name = profileDisplayName(profile);

  const [blocked, setBlocked] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [confirmBlockOpen, setConfirmBlockOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    if (isOwner || !viewerProfileId) return;
    let active = true;
    supabase
      .from("blocked_users")
      .select("id")
      .eq("user_id", viewerProfileId)
      .eq("blocked_user_id", profileId)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setBlocked(Boolean(data));
      });
    return () => {
      active = false;
    };
  }, [isOwner, viewerProfileId, profileId]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(profileShareUrl(profileId));
      toast({ title: "Link copied" });
    } catch {
      toast({
        title: "Couldn’t copy",
        description: "Use “Share” to get the link.",
        variant: "destructive",
      });
    }
  };

  const doPdf = async () => {
    setPdfBusy(true);
    try {
      await saveProfilePdf(ctx);
    } catch (err) {
      toast({
        title: "Couldn’t build PDF",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setPdfBusy(false);
    }
  };

  const toggleBlock = async () => {
    if (!viewerProfileId) return;
    setBlockBusy(true);
    try {
      if (blocked) {
        const { error } = await supabase
          .from("blocked_users")
          .delete()
          .eq("user_id", viewerProfileId)
          .eq("blocked_user_id", profileId);
        if (error) throw error;
        setBlocked(false);
        toast({ title: `Unblocked ${name}` });
      } else {
        const { error } = await supabase.from("blocked_users").insert({
          user_id: viewerProfileId,
          blocked_user_id: profileId,
        });
        if (error) throw error;
        setBlocked(true);
        setConfirmBlockOpen(false);
        toast({ title: `Blocked ${name}` });
        await ctx.refresh();
      }
    } catch (err) {
      toast({
        title: "Couldn’t update block",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setBlockBusy(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            aria-label="More actions"
            className="h-9 w-9 rounded-full"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={onShare}>
            <Share2 className="h-4 w-4 mr-2" />
            Share profile
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={copyLink}>
            <LinkIcon className="h-4 w-4 mr-2" />
            Copy link
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onContactInfo}>
            <IdCard className="h-4 w-4 mr-2" />
            Contact info
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              void doPdf();
            }}
            disabled={pdfBusy}
          >
            {pdfBusy ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4 mr-2" />
            )}
            Save to PDF
          </DropdownMenuItem>

          {isOwner ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onEditVisibility}>
                <Eye className="h-4 w-4 mr-2" />
                Profile visibility
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onReport} className="text-destructive focus:text-destructive">
                <Flag className="h-4 w-4 mr-2" />
                Report this profile
              </DropdownMenuItem>
              {blocked ? (
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    void toggleBlock();
                  }}
                  disabled={blockBusy}
                >
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Unblock {name}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setConfirmBlockOpen(true);
                  }}
                  disabled={blockBusy}
                  className="text-destructive focus:text-destructive"
                >
                  <Ban className="h-4 w-4 mr-2" />
                  Block {name}
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmBlockOpen} onOpenChange={setConfirmBlockOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              You won’t see each other’s posts or be able to message. You can
              unblock later from this menu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={blockBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void toggleBlock();
              }}
              disabled={blockBusy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {blockBusy ? "Blocking…" : "Block"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ProfileMoreMenu;
