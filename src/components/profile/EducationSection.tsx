import { useCallback, useEffect, useState } from "react";
import { Pencil, Trash2, GraduationCap } from "lucide-react";

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
import { EducationDialog } from "@/components/profile/EducationDialog";
import { byRecency, formatRange, type EducationRow } from "@/components/profile/careerTypes";

interface EducationSectionProps {
  /** profiles.id */
  profileId: string;
  isOwner: boolean;
}

const EducationSection = ({ profileId, isOwner }: EducationSectionProps) => {
  const { toast } = useToast();
  const [rows, setRows] = useState<EducationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EducationRow | null>(null);
  const [deleting, setDeleting] = useState<EducationRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("education")
      .select("*")
      .eq("user_id", profileId);
    if (error) {
      setError("Couldn’t load education.");
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
  const openEdit = (row: EducationRow) => {
    setEditing(row);
    setDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const { error } = await supabase
        .from("education")
        .delete()
        .eq("id", deleting.id);
      if (error) throw error;
      toast({ title: "Education deleted" });
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
        id="education"
        title="Education"
        isOwner={isOwner}
        onAdd={openAdd}
        addLabel="Add education"
        loading={loading}
        error={error}
        onRetry={fetchRows}
        empty={rows.length === 0}
        emptyText={
          isOwner
            ? "Add schools, degrees and courses you’ve completed."
            : "No education added yet."
        }
      >
        <ul className="divide-y divide-border">
          {rows.map((row) => {
            const line2 = [row.degree, row.field_of_study]
              .filter(Boolean)
              .join(", ");
            return (
              <li key={row.id} className="py-3 flex gap-3">
                <div className="mt-0.5 h-9 w-9 rounded-md bg-secondary flex items-center justify-center shrink-0">
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground break-words">
                    {row.institution}
                  </p>
                  {line2 && (
                    <p className="text-sm text-foreground/80 break-words">{line2}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {formatRange(row.start_date, row.end_date)}
                    {row.grade ? ` · Grade: ${row.grade}` : ""}
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
                      aria-label="Edit education"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleting(row)}
                      aria-label="Delete education"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </ProfileSectionCard>

      {isOwner && (
        <EducationDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          profileId={profileId}
          existing={editing}
          onSaved={fetchRows}
        />
      )}

      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this education entry?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? `“${deleting.institution}” will be removed. This can’t be undone.` : ""}
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

export default EducationSection;
