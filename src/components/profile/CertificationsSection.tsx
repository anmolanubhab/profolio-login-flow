import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, ExternalLink, ArrowUpRight } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProfileSectionCard } from "@/components/profile/ProfileSectionCard";
import type { CertificateRow } from "@/components/profile/careerTypes";

/**
 * Profile view of the owner's Certificate Vault. This is READ-ONLY here — all
 * mutations (upload / delete) happen in the existing /certificates vault, which
 * this section links to. It renders only for the owner: the `certificates`
 * table is fully owner-private (RLS: auth.uid() = user_id), and this phase does
 * NOT add any public disclosure of certificates or their files.
 */
interface CertificationsSectionProps {
  /** auth.uid() — certificates.user_id references auth.users(id) */
  authUserId: string;
}

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const fmtSize = (b: number | null) => {
  if (!b) return null;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
};

const CertificationsSection = ({ authUserId }: CertificationsSectionProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState<CertificateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("certificates")
      .select("*")
      .eq("user_id", authUserId)
      .order("created_at", { ascending: false });
    if (error) {
      setError("Couldn’t load certificates.");
      setRows([]);
    } else {
      setRows(data ?? []);
    }
    setLoading(false);
  }, [authUserId]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const view = async (cert: CertificateRow) => {
    // short-lived signed URL, generated on demand, owner only
    const { data, error } = await supabase.storage
      .from("certificates")
      .createSignedUrl(cert.file_url, 60);
    if (error || !data?.signedUrl) {
      toast({
        title: "Couldn’t open file",
        description: "The certificate link could not be generated.",
        variant: "destructive",
      });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <ProfileSectionCard
      id="certifications"
      title="Certifications"
      count={rows.length}
      icon={FileText}
      isOwner
      onAdd={() => navigate("/certificates")}
      addLabel="Add certificate"
      loading={loading}
      error={error}
      onRetry={fetchRows}
      empty={rows.length === 0}
      emptyText="Upload certificates in your Certificate Vault to show them here."
      headerExtra={
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-muted-foreground"
          onClick={() => navigate("/certificates")}
        >
          Vault <ArrowUpRight className="h-3.5 w-3.5" />
        </Button>
      }
    >
      <ul className="divide-y divide-border">
        {rows.map((c) => (
          <li key={c.id} className="py-3 flex gap-3">
            <div className="mt-0.5 h-9 w-9 rounded-md bg-secondary flex items-center justify-center shrink-0">
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground break-words">{c.title}</p>
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                <Badge variant="secondary" className="text-[11px]">
                  Added {fmtDate(c.created_at)}
                </Badge>
                {fmtSize(c.file_size) && (
                  <Badge variant="outline" className="text-[11px]">
                    {fmtSize(c.file_size)}
                  </Badge>
                )}
              </div>
              {c.description && (
                <p className="text-sm text-foreground/90 mt-1 whitespace-pre-wrap break-words">
                  {c.description}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 gap-1"
              onClick={() => view(c)}
            >
              View <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </li>
        ))}
      </ul>
    </ProfileSectionCard>
  );
};

export default CertificationsSection;
