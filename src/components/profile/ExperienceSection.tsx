import { notifyProfileChanged } from "@/lib/profileNav";
import { useCallback, useEffect, useState } from "react";
import { Pencil, Trash2, Briefcase } from "lucide-react";

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
import { ExperienceDialog } from "@/components/profile/ExperienceDialog";
import { byRecency, formatRange, type ExperienceRow } from "@/components/profile/careerTypes";

interface ExperienceSectionProps {
  /** profiles.id */
  profileId: string;
  isOwner: boolean;
}

const ExperienceSection = ({ profileId, isOwner }: ExperienceSectionProps) => {
  const { toast } = useToast();
  const [rows, setRows] = useState<ExperienceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ExperienceRow | null>(null);
  const [deleting, setDeleting] = useState<ExperienceRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("experience")
      .select("*")
      .eq("user_id", profileId);
    if (error) {
      setError("Couldn’t load experience.");
      setRows([]);
    } else {
      setRows([...(data ?? [])].sort(byRecency));
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
  const openEdit = (row: ExperienceRow) => {
    setEditing(row);
    setDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const { error } = await supabase
        .from("experience")
        .delete()
        .eq("id", deleting.id);
      if (error) throw error;
      toast({ title: "Experience deleted" });
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
        id="experience"
        title="Experience"
        count={rows.length}
        icon={Briefcase}
        isOwner={isOwner}
        onAdd={openAdd}
        addLabel="Add experience"
        loading={loading}
        error={error}
        onRetry={fetchRows}
        empty={rows.length === 0}
        emptyText={
          isOwner
            ? "Add roles you’ve held to show your career history."
            : "No experience added yet."
        }
      >
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.id} className="py-3 flex gap-3">
              <div className="mt-0.5 h-9 w-9 rounded-md bg-secondary flex items-center justify-center shrink-0">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground break-words">{row.role}</p>
                <p className="text-sm text-foreground/80 break-words">
                  {row.company}
                  {row.employment_type ? ` · ${row.employment_type}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatRange(row.start_date, row.end_date, row.is_current)}
                  {row.location ? ` · ${row.location}` : ""}
                </p>
                {row.description && (
                  <p className="text-sm text-foreground/90 mt-1 whitespace-pre-wrap break-words">
                    {row.description}
                  </p>
                )}
              </div>
              {isOwner && (
                <div className="flex flex-col gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(row)}
                    aria-label="Edit experience"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleting(row)}
                    aria-label="Delete experience"
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
        <ExperienceDialog
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
            <AlertDialogTitle>Delete this experience?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? `“${deleting.role} at ${deleting.company}” will be removed. This can’t be undone.` : ""}
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
              {deleteBusy ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ExperienceSection;
