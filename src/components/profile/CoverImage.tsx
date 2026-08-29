import { useRef, useState } from "react";
import { Camera, Loader2, Trash2, Upload, MoveVertical } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
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

const DEFAULT_GRADIENT =
  "linear-gradient(135deg, hsl(211 100% 45%), hsl(240 60% 55%))";

interface CoverImageProps {
  coverUrl: string | null;
  coverPosition: number | null;
  isOwner: boolean;
  /** auth.uid() — used as the storage path prefix so RLS accepts the write */
  authUserId: string;
  /** profiles.user_id — used to target the row in profiles.update() */
  profileUserId: string;
  onChange: (patch: { cover_url?: string | null; cover_position?: number }) => void;
}

export const CoverImage = ({
  coverUrl,
  coverPosition,
  isOwner,
  authUserId,
  profileUserId,
  onChange,
}: CoverImageProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingPosition, setSavingPosition] = useState(false);

  // draft position while the edit modal is open
  const initialPos = typeof coverPosition === "number" ? coverPosition : 50;
  const [draftPos, setDraftPos] = useState(initialPos);

  const objectPosition = `center ${
    typeof coverPosition === "number" ? coverPosition : 50
  }%`;
  const draftObjectPosition = `center ${draftPos}%`;

  const openEditor = () => {
    setDraftPos(initialPos);
    setEditOpen(true);
  };

  const handleFilePicked = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
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
        description: "Cover images must be under 5MB.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const { secureUpload } = await import("@/lib/secure-upload");
      const result = await secureUpload({
        bucket: "covers",
        file,
        userId: authUserId,
      });
      if (!result.success || !result.url) {
        throw new Error(result.error || "Upload failed");
      }

      const { error } = await supabase
        .from("profiles")
        .update({ cover_url: result.url, cover_position: 50 })
        .eq("user_id", profileUserId);
      if (error) throw error;

      onChange({ cover_url: result.url, cover_position: 50 });
      setDraftPos(50);
      toast({ title: "Cover updated" });
    } catch (err) {
      toast({
        title: "Couldn’t update cover",
        description: err instanceof Error ? err.message : "Upload failed",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSavePosition = async () => {
    setSavingPosition(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ cover_position: draftPos })
        .eq("user_id", profileUserId);
      if (error) throw error;
      onChange({ cover_position: draftPos });
      toast({ title: "Cover position saved" });
      setEditOpen(false);
    } catch (err) {
      toast({
        title: "Couldn’t save position",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setSavingPosition(false);
    }
  };

  const handleRemove = async () => {
    setUploading(true);
    try {
      // best-effort delete of the stored object
      if (coverUrl) {
        const marker = "/covers/";
        const idx = coverUrl.indexOf(marker);
        if (idx !== -1) {
          const path = coverUrl.slice(idx + marker.length);
          await supabase.storage.from("covers").remove([path]);
        }
      }
      const { error } = await supabase
        .from("profiles")
        .update({ cover_url: null, cover_position: 50 })
        .eq("user_id", profileUserId);
      if (error) throw error;

      onChange({ cover_url: null, cover_position: 50 });
      setConfirmRemoveOpen(false);
      setEditOpen(false);
      toast({ title: "Cover removed" });
    } catch (err) {
      toast({
        title: "Couldn’t remove cover",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const hasChanges = draftPos !== initialPos;

  return (
    <>
      <div className="relative w-full h-32 sm:h-44 md:h-52 overflow-hidden rounded-t-xl bg-secondary">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt="Profile cover"
            className={cn(
              "w-full h-full object-cover transition-opacity duration-300",
              uploading && "opacity-50"
            )}
            style={{ objectPosition }}
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ backgroundImage: DEFAULT_GRADIENT }}
            aria-hidden
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent pointer-events-none" />

        {isOwner && (
          <Button
            size="sm"
            variant="secondary"
            onClick={openEditor}
            disabled={uploading}
            className="absolute top-3 right-3 gap-2 bg-background/85 backdrop-blur-sm hover:bg-background"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Edit cover</span>
          </Button>
        )}
      </div>

      {/* hidden file input, shared by the modal buttons */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFilePicked}
      />

      {/* Edit-cover modal --------------------------------------------------- */}
      <ResponsiveModal open={editOpen} onOpenChange={setEditOpen}>
        <ResponsiveModalContent className="sm:max-w-xl">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>Cover image</ResponsiveModalTitle>
            <ResponsiveModalDescription>
              Upload a banner, then drag the slider to reposition it.
            </ResponsiveModalDescription>
          </ResponsiveModalHeader>

          <div className="space-y-4">
            <div className="relative w-full h-36 sm:h-44 overflow-hidden rounded-lg border bg-secondary">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt="Cover preview"
                  className="w-full h-full object-cover"
                  style={{ objectPosition: draftObjectPosition }}
                />
              ) : (
                <div
                  className="w-full h-full grid place-items-center text-sm text-muted-foreground"
                  style={{ backgroundImage: DEFAULT_GRADIENT }}
                >
                  <span className="text-white/90">No cover yet</span>
                </div>
              )}
            </div>

            {coverUrl && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MoveVertical className="h-4 w-4 text-primary" />
                  Reposition
                </div>
                <Slider
                  value={[draftPos]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={(v) => setDraftPos(v[0])}
                  aria-label="Cover vertical position"
                />
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                {coverUrl ? "Replace image" : "Upload image"}
              </Button>
              {coverUrl && (
                <Button
                  variant="outline"
                  onClick={() => setConfirmRemoveOpen(true)}
                  disabled={uploading}
                  className="gap-2 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </Button>
              )}
            </div>
          </div>

          <ResponsiveModalFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setEditOpen(false)}
              disabled={savingPosition || uploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSavePosition}
              disabled={!coverUrl || !hasChanges || savingPosition || uploading}
            >
              {savingPosition ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>

      {/* Remove confirmation --------------------------------------------- */}
      <AlertDialog open={confirmRemoveOpen} onOpenChange={setConfirmRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove cover image?</AlertDialogTitle>
            <AlertDialogDescription>
              Your profile will show the default banner. You can upload a new
              cover any time.
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

export default CoverImage;
