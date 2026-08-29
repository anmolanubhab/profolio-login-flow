import { useRef, useState } from "react";
import { Camera, Loader2, Trash2, Upload, Globe, Users, Lock } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
} from "@/components/ui/responsive-modal";
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
import type { PhotoVisibility } from "@/components/profile/profileTypes";

interface ProfilePhotoProps {
  avatarUrl: string | null;
  displayName: string;
  isOwner: boolean;
  /** auth.uid() — storage path prefix */
  authUserId: string;
  /** profiles.user_id — target row for profiles.update() */
  profileUserId: string;
  photoVisibility: PhotoVisibility;
  /** parent decides whether this viewer may see the actual photo */
  canSeePhoto: boolean;
  onChange: (patch: {
    avatar_url?: string | null;
    photo_visibility?: PhotoVisibility;
  }) => void;
  className?: string;
}

const VIS_OPTIONS: {
  value: PhotoVisibility;
  label: string;
  icon: typeof Globe;
}[] = [
  { value: "public", label: "Anyone", icon: Globe },
  { value: "connections_only", label: "Connections only", icon: Users },
  { value: "private", label: "Only me", icon: Lock },
];

export const ProfilePhoto = ({
  avatarUrl,
  displayName,
  isOwner,
  authUserId,
  profileUserId,
  photoVisibility,
  canSeePhoto,
  onChange,
  className,
}: ProfilePhotoProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingVis, setSavingVis] = useState(false);
  const [draftVis, setDraftVis] = useState<PhotoVisibility>(photoVisibility);

  const shownImage = canSeePhoto ? avatarUrl : null;
  const initial = displayName.charAt(0).toUpperCase() || "U";

  const openModal = () => {
    if (!isOwner && !avatarUrl) return; // nothing to view
    setDraftVis(photoVisibility);
    setOpen(true);
  };

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please choose an image file.",
        variant: "destructive",
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Image too large",
        description: "Profile photos must be under 5MB.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const { secureUpload } = await import("@/lib/secure-upload");
      const result = await secureUpload({
        bucket: "avatars",
        file,
        userId: authUserId,
      });
      if (!result.success || !result.url) {
        throw new Error(result.error || "Upload failed");
      }
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: result.url })
        .eq("user_id", profileUserId);
      if (error) throw error;

      onChange({ avatar_url: result.url });
      toast({ title: "Profile photo updated" });
    } catch (err) {
      toast({
        title: "Couldn’t update photo",
        description: err instanceof Error ? err.message : "Upload failed",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    setUploading(true);
    try {
      if (avatarUrl) {
        const marker = "/avatars/";
        const idx = avatarUrl.indexOf(marker);
        if (idx !== -1) {
          await supabase.storage
            .from("avatars")
            .remove([avatarUrl.slice(idx + marker.length)]);
        }
      }
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("user_id", profileUserId);
      if (error) throw error;

      onChange({ avatar_url: null });
      setConfirmRemoveOpen(false);
      toast({ title: "Profile photo removed" });
    } catch (err) {
      toast({
        title: "Couldn’t remove photo",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveVisibility = async () => {
    setSavingVis(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ photo_visibility: draftVis })
        .eq("user_id", profileUserId);
      if (error) throw error;
      onChange({ photo_visibility: draftVis });
      toast({ title: "Photo visibility saved" });
      setOpen(false);
    } catch (err) {
      toast({
        title: "Couldn’t save visibility",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setSavingVis(false);
    }
  };

  const visChanged = draftVis !== photoVisibility;

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={cn(
          "relative rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
          !isOwner && !avatarUrl && "cursor-default",
          className
        )}
        aria-label={isOwner ? "Edit profile photo" : "View profile photo"}
      >
        <Avatar className="h-28 w-28 sm:h-32 sm:w-32 border-4 border-card shadow-elegant">
          <AvatarImage src={shownImage ?? undefined} alt={displayName} />
          <AvatarFallback className="text-2xl font-bold bg-primary text-primary-foreground">
            {initial}
          </AvatarFallback>
        </Avatar>
        {isOwner && (
          <span className="absolute bottom-1 right-1 bg-primary text-primary-foreground rounded-full p-2 shadow-elegant">
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
          </span>
        )}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFilePicked}
      />

      <ResponsiveModal open={open} onOpenChange={setOpen}>
        <ResponsiveModalContent className="sm:max-w-md">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>
              {isOwner ? "Profile photo" : `${displayName}’s photo`}
            </ResponsiveModalTitle>
            {isOwner && (
              <ResponsiveModalDescription>
                Upload a photo and choose who can see it.
              </ResponsiveModalDescription>
            )}
          </ResponsiveModalHeader>

          <div className="flex flex-col items-center gap-4">
            <Avatar className="h-40 w-40 border-4 border-card shadow-elegant">
              <AvatarImage src={avatarUrl ?? undefined} alt={displayName} />
              <AvatarFallback className="text-4xl font-bold bg-primary text-primary-foreground">
                {initial}
              </AvatarFallback>
            </Avatar>

            {isOwner && (
              <>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Upload className="h-4 w-4" />
                    {avatarUrl ? "Replace" : "Upload"}
                  </Button>
                  {avatarUrl && (
                    <Button
                      variant="outline"
                      className="gap-2 text-destructive hover:text-destructive"
                      onClick={() => setConfirmRemoveOpen(true)}
                      disabled={uploading}
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </Button>
                  )}
                </div>

                <div className="w-full space-y-1.5">
                  <Label htmlFor="photo-vis" className="text-sm">
                    Who can see your photo
                  </Label>
                  <Select
                    value={draftVis}
                    onValueChange={(v) => setDraftVis(v as PhotoVisibility)}
                  >
                    <SelectTrigger id="photo-vis">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VIS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          <span className="flex items-center gap-2">
                            <o.icon className="h-4 w-4" />
                            {o.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>

          {isOwner && (
            <ResponsiveModalFooter className="gap-2">
              <Button
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={savingVis || uploading}
              >
                Close
              </Button>
              <Button
                onClick={handleSaveVisibility}
                disabled={!visChanged || savingVis || uploading}
              >
                {savingVis ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </ResponsiveModalFooter>
          )}
        </ResponsiveModalContent>
      </ResponsiveModal>

      <AlertDialog open={confirmRemoveOpen} onOpenChange={setConfirmRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove profile photo?</AlertDialogTitle>
            <AlertDialogDescription>
              Your profile will show your initials until you upload a new photo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={uploading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleRemove();
              }}
              disabled={uploading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {uploading ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ProfilePhoto;
