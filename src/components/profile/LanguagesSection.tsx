import { notifyProfileChanged } from "@/lib/profileNav";
import { useCallback, useEffect, useState } from "react";
import { Pencil, Trash2, Languages as LanguagesIcon } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
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
import { ProfileSectionCard } from "@/components/profile/ProfileSectionCard";
import { LanguageDialog } from "@/components/profile/LanguageDialog";
import {
  PROFICIENCY_LABEL,
  type LanguageProficiency,
  type LanguageRow,
} from "@/components/profile/careerTypes";

interface LanguagesSectionProps {
  /** profiles.id */
  profileId: string;
  isOwner: boolean;
}

const LanguagesSection = ({ profileId, isOwner }: LanguagesSectionProps) => {
  const { toast } = useToast();
  const [rows, setRows] = useState<LanguageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LanguageRow | null>(null);
  const [deleting, setDeleting] = useState<LanguageRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("languages")
      .select("*")
      .eq("user_id", profileId)
      .order("created_at", { ascending: true });
    if (error) {
      setError("Couldn’t load languages.");
      setRows([]);
    } else {
      setRows(data ?? []);
    }
    setLoading(false);
  }, [profileId]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (row: LanguageRow) => {
    setEditing(row);
    setDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const { error } = await supabase
        .from("languages")
        .delete()
        .eq("id", deleting.id);
      if (error) throw error;
      toast({ title: "Language removed" });
      setDeleting(null);
      void fetchRows();
    } catch (err) {
      toast({
        title: "Couldn’t delete",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <>
      <ProfileSectionCard
        id="languages"
        title="Languages"
        count={rows.length}
        icon={LanguagesIcon}
        isOwner={isOwner}
        onAdd={openAdd}
        addLabel="Add language"
        loading={loading}
        error={error}
        onRetry={fetchRows}
        empty={rows.length === 0}
        emptyText={
          isOwner ? "Add languages you speak and your proficiency." : "No languages added yet."
        }
      >
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.id} className="py-2.5 flex items-center gap-3">
              <div className="h-8 w-8 rounded-md bg-secondary flex items-center justify-center shrink-0">
                <LanguagesIcon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground break-words">{row.name}</p>
                <p className="text-xs text-muted-foreground">
                  {PROFICIENCY_LABEL[row.proficiency as LanguageProficiency] ??
                    row.proficiency}
                </p>
              </div>
              {isOwner && (
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(row)}
                    aria-label="Edit language"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleting(row)}
                    aria-label="Delete language"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </ProfileSectionCard>

      {isOwner && (
        <LanguageDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          profileId={profileId}
          existing={editing}
          onSaved={() => { fetchRows(); notifyProfileChanged(); }}
        />
      )}

      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this language?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? `“${deleting.name}” will be removed from your profile.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={deleteBusy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteBusy ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default LanguagesSection;
