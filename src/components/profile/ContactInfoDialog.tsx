import { useEffect, useState } from "react";
import {
  Mail,
  Phone,
  Globe,
  MapPin,
  Linkedin,
  Github,
  Twitter,
  Loader2,
  Link as LinkIcon,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
} from "@/components/ui/responsive-modal";
import { profileShareUrl, type ProfileRow } from "@/components/profile/profileTypes";

interface ContactInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: ProfileRow;
  isOwner: boolean;
}

type Row = {
  icon: typeof Mail;
  label: string;
  value: string;
  href?: string;
};

const withProtocol = (url: string) =>
  /^https?:\/\//i.test(url) ? url : `https://${url}`;

export const ContactInfoDialog = ({
  open,
  onOpenChange,
  profile,
  isOwner,
}: ContactInfoDialogProps) => {
  const [loading, setLoading] = useState(false);
  // email/phone come from the visibility-aware DB function; the rest are
  // read from the already-loaded profile row (itself visibility-gated by RLS).
  const [gated, setGated] = useState<{ email: string | null; phone: string | null }>(
    { email: null, phone: null }
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || isOwner) return;
    let active = true;
    setLoading(true);
    setError(null);
    supabase
      .rpc("get_profile_contact_info", { _profile_id: profile.id })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setError(error.message);
          setGated({ email: null, phone: null });
        } else {
          const row = Array.isArray(data) ? data[0] : null;
          setGated({
            email: row?.email ?? null,
            phone: row?.phone ?? null,
          });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, isOwner, profile.id]);

  const source: Record<string, string | null | undefined> = isOwner
    ? {
        email: profile.email,
        phone: profile.phone,
        address: profile.address,
        website: profile.website,
        linkedin_url: profile.linkedin_url,
        github_url: profile.github_url,
        twitter_url: profile.twitter_url,
      }
    : {
        email: gated.email,
        phone: gated.phone,
        address: profile.address,
        website: profile.website,
        linkedin_url: profile.linkedin_url,
        github_url: profile.github_url,
        twitter_url: profile.twitter_url,
      };

  const rows: Row[] = [];
  const pushIf = (key: string, make: (v: string) => Row) => {
    const v = source[key];
    if (v && String(v).trim()) rows.push(make(String(v).trim()));
  };

  pushIf("email", (v) => ({ icon: Mail, label: "Email", value: v, href: `mailto:${v}` }));
  pushIf("phone", (v) => ({ icon: Phone, label: "Phone", value: v, href: `tel:${v}` }));
  pushIf("address", (v) => ({ icon: MapPin, label: "Address", value: v }));
  pushIf("website", (v) => ({ icon: Globe, label: "Website", value: v, href: withProtocol(v) }));
  pushIf("linkedin_url", (v) => ({ icon: Linkedin, label: "LinkedIn", value: v, href: withProtocol(v) }));
  pushIf("github_url", (v) => ({ icon: Github, label: "GitHub", value: v, href: withProtocol(v) }));
  pushIf("twitter_url", (v) => ({ icon: Twitter, label: "X / Twitter", value: v, href: withProtocol(v) }));

  const shareUrl = profileShareUrl(profile.id);

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="sm:max-w-md">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Contact info</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            {isOwner
              ? "This is what others can request to see, subject to your visibility settings."
              : "Only the details this member has chosen to share are shown."}
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <div className="space-y-3">
          {/* profile URL is always available */}
          <div className="flex items-start gap-3">
            <LinkIcon className="h-4 w-4 mt-0.5 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Profile</p>
              <a
                href={shareUrl}
                className="text-sm text-primary hover:underline break-all"
              >
                {shareUrl.replace(/^https?:\/\//, "")}
              </a>
            </div>
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading contact info…
            </div>
          )}

          {!loading && error && (
            <p className="text-sm text-destructive py-2">{error}</p>
          )}

          {!loading &&
            rows.map((r) => (
              <div key={r.label} className="flex items-start gap-3">
                <r.icon className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{r.label}</p>
                  {r.href ? (
                    <a
                      href={r.href}
                      target={r.href.startsWith("http") ? "_blank" : undefined}
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline break-all"
                    >
                      {r.value}
                    </a>
                  ) : (
                    <p className="text-sm break-words">{r.value}</p>
                  )}
                </div>
              </div>
            ))}

          {!loading && !error && rows.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">
              {isOwner
                ? "You haven’t added any contact details yet. Use “Edit profile” to add them."
                : "This member hasn’t shared any contact details."}
            </p>
          )}
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
};

export default ContactInfoDialog;
