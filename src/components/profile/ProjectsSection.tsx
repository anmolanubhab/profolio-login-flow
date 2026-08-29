import { useMemo, useState } from "react";
import { Pencil, Trash2, FolderGit2, ExternalLink } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { ProjectDialog } from "@/components/profile/ProjectDialog";
import {
  formatRange,
  parseProjects,
  type ProjectEntry,
} from "@/components/profile/careerTypes";
import type { ProfileContextValue } from "@/components/profile/profileTypes";

interface ProjectsSectionProps {
  ctx: ProfileContextValue;
}

const withProtocol = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);

const ProjectsSection = ({ ctx }: ProjectsSectionProps) => {
  const { toast } = useToast();
  const { isOwner, targetUserId, profile, patchProfile } = ctx;

  const projects = useMemo(
    () => parseProjects(profile.projects),
    [profile.projects]
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectEntry | null>(null);
  const [deleting, setDeleting] = useState<ProjectEntry | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (p: ProjectEntry) => {
    setEditing(p);
    setDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const next = projects.filter((p) => p.id !== deleting.id);
      const { error } = await supabase
        .from("profiles")
        .update({ projects: next })
        .eq("user_id", targetUserId);
      if (error) throw error;
      patchProfile({ projects: next });
      toast({ title: "Project deleted" });
      setDeleting(null);
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
        id="projects"
        title="Projects"
        isOwner={isOwner}
        onAdd={openAdd}
        addLabel="Add project"
        empty={projects.length === 0}
        emptyText={
          isOwner
            ? "Showcase things you’ve built, shipped or contributed to."
            : "No projects added yet."
        }
      >
        <ul className="divide-y divide-border">
          {projects.map((p) => (
            <li key={p.id} className="py-3 flex gap-3">
              <div className="mt-0.5 h-9 w-9 rounded-md bg-secondary flex items-center justify-center shrink-0">
                <FolderGit2 className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-foreground break-words">{p.title}</p>
                  {p.url && (
                    <a
                      href={withProtocol(p.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary inline-flex items-center gap-0.5 text-xs hover:underline"
                    >
                      Link <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                {(p.start_date || p.end_date || p.is_ongoing) && (
                  <p className="text-xs text-muted-foreground">
                    {formatRange(p.start_date, p.end_date, p.is_ongoing)}
                  </p>
                )}
                {p.description && (
                  <p className="text-sm text-foreground/90 mt-1 whitespace-pre-wrap break-words">
                    {p.description}
                  </p>
                )}
                {p.skills && p.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {p.skills.map((s) => (
                      <Badge key={s} variant="secondary" className="text-[11px]">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              {isOwner && (
                <div className="flex flex-col gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(p)}
                    aria-label="Edit project"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleting(p)}
                    aria-label="Delete project"
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
        <ProjectDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          profileUserId={targetUserId}
          projects={projects}
          existing={editing}
          onSaved={(next) => patchProfile({ projects: next })}
        />
      )}

      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? `“${deleting.title}” will be removed. This can’t be undone.` : ""}
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

export default ProjectsSection;
