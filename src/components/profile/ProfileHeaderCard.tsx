import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Pencil, BadgeCheck, Briefcase } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CoverImage } from "@/components/profile/CoverImage";
import { ProfilePhoto } from "@/components/profile/ProfilePhoto";
import { ProfileActions } from "@/components/profile/ProfileActions";
import { AddSectionMenu } from "@/components/profile/AddSectionMenu";
import { ProfileMoreMenu } from "@/components/profile/ProfileMoreMenu";
import { ProfileStrength } from "@/components/profile/ProfileStrength";
import { EditProfileDialog } from "@/components/profile/EditProfileDialog";
import {
  jumpToProfileSection,
  scrollToProfileHeader,
  notifyProfileChanged,
} from "@/lib/profileNav";
import type { StrengthAction } from "@/lib/profileStrength";
import { ContactInfoDialog } from "@/components/profile/ContactInfoDialog";
import { ShareProfileDialog } from "@/components/profile/ShareProfileDialog";
import { ReportProfileDialog } from "@/components/profile/ReportProfileDialog";
import {
  profileDisplayName,
  profileHeadline,
  type PhotoVisibility,
  type ProfileContextValue,
} from "@/components/profile/profileTypes";

interface ProfileHeaderCardProps {
  ctx: ProfileContextValue;
  gated: boolean;
}

const ABOUT_CLAMP = 280;

export const ProfileHeaderCard = ({ ctx, gated }: ProfileHeaderCardProps) => {
  const { profile, isOwner, relationship, counts } = ctx;
  const navigate = useNavigate();

  const [editOpen, setEditOpen] = useState(false);
  const [editInitialTab, setEditInitialTab] = useState<"basics" | "contact" | "visibility">("basics");
  const [contactOpen, setContactOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [aboutExpanded, setAboutExpanded] = useState(false);

  const openEdit = (tab: "basics" | "contact" | "visibility" = "basics") => {
    setEditInitialTab(tab);
    setEditOpen(true);
  };

  // Route a Profile Strength recommendation to the real editor / section.
  const handleStrengthAction = (action: StrengthAction) => {
    switch (action.type) {
      case "editProfile":
        openEdit("basics");
        break;
      case "editContact":
        // EditProfileDialog's Contact tab is where phone / links are edited
        // (ContactInfoDialog is a read-only viewer).
        openEdit("contact");
        break;
      case "resume":
        navigate("/resume");
        break;
      case "photo":
        scrollToProfileHeader();
        break;
      case "section":
        jumpToProfileSection(action.key);
        break;
    }
  };

  const name = profileDisplayName(profile);
  const headline = profileHeadline(profile);
  const photoVisibility = (profile.photo_visibility as PhotoVisibility) ?? "public";

  const canSeePhoto =
    isOwner ||
    photoVisibility === "public" ||
    (photoVisibility === "connections_only" && relationship === "connected");

  const bio = profile.bio ?? "";
  const bioTooLong = bio.length > ABOUT_CLAMP;
  const bioDisplay =
    bioTooLong && !aboutExpanded ? bio.slice(0, ABOUT_CLAMP).trimEnd() + "…" : bio;

  return (
    <Card className="mb-4 overflow-hidden border-0 shadow-card">
      <CoverImage
        coverUrl={profile.cover_url}
        coverPosition={profile.cover_position}
        isOwner={isOwner}
        authUserId={profile.user_id}
        profileUserId={profile.user_id}
        onChange={ctx.patchProfile}
      />

      <CardContent className="pt-0 pb-5">
        {/* photo overlapping the cover */}
        <div className="-mt-14 sm:-mt-16">
          <ProfilePhoto
            avatarUrl={profile.avatar_url}
            displayName={name}
            isOwner={isOwner}
            authUserId={profile.user_id}
            profileUserId={profile.user_id}
            photoVisibility={photoVisibility}
            canSeePhoto={canSeePhoto}
            onChange={ctx.patchProfile}
          />
        </div>

        {/* identity */}
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="text-2xl sm:text-[28px] font-bold text-foreground leading-tight tracking-tight">
              {name}
            </h1>
            {profile.pronouns && (
              <span className="text-sm text-muted-foreground">
                ({profile.pronouns})
              </span>
            )}
            {/* Verification: shown when the account has a confirmed email on file */}
            {profile.email && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-primary"
                aria-label="Verified account"
              >
                <BadgeCheck className="h-3.5 w-3.5" />
                Verified
              </span>
            )}
          </div>

          {headline && (
            <p className="text-base text-foreground whitespace-pre-wrap leading-snug">
              {headline}
            </p>
          )}

          <div className="flex flex-col gap-y-0.5 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2">
            {profile.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{profile.location}</span>
              </span>
            )}
            {!gated && (
              <span className="inline-flex items-center gap-2">
                {profile.location && (
                  <span aria-hidden className="hidden sm:inline">
                    ·
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setContactOpen(true)}
                  className="font-semibold text-primary hover:underline"
                >
                  Contact info
                </button>
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {counts.connections != null &&
              (isOwner ? (
                <button
                  type="button"
                  onClick={() => navigate("/network?tab=connections")}
                  className="font-semibold text-primary hover:underline"
                >
                  {counts.connections} connection{counts.connections === 1 ? "" : "s"}
                </button>
              ) : (
                <span className="text-foreground font-medium">
                  {counts.connections}
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    connection{counts.connections === 1 ? "" : "s"}
                  </span>
                </span>
              ))}
            {isOwner ? (
              <button
                type="button"
                onClick={() => navigate("/network?tab=following&sub=followers")}
                className="font-semibold text-primary hover:underline"
              >
                {counts.followers} follower{counts.followers === 1 ? "" : "s"}
              </button>
            ) : (
              <span className="text-foreground font-medium">
                {counts.followers}
                <span className="text-muted-foreground font-normal">
                  {" "}
                  follower{counts.followers === 1 ? "" : "s"}
                </span>
              </span>
            )}
          </div>

          {profile.open_to_work && (
            <div className="mt-1 flex items-center gap-2 rounded-lg border border-primary/25 bg-accent/50 px-3 py-1.5 sm:py-2">
              <Briefcase className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-primary leading-tight">
                  Open to work
                </p>
                <p className="hidden text-xs text-muted-foreground leading-tight sm:block">
                  {name.split(" ")[0]} is open to new opportunities
                </p>
              </div>
            </div>
          )}
        </div>

        {/* actions */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {isOwner ? (
            <>
              <Button
                onClick={() => openEdit("basics")}
                size="sm"
                className="h-9 w-full gap-2 rounded-full px-4 sm:w-auto"
              >
                <Pencil className="h-4 w-4" />
                Edit profile
              </Button>
              <AddSectionMenu onEditAbout={() => openEdit("basics")} />
              <ProfileMoreMenu
                ctx={ctx}
                onShare={() => setShareOpen(true)}
                onContactInfo={() => setContactOpen(true)}
                onReport={() => setReportOpen(true)}
                onEditVisibility={() => openEdit("visibility")}
              />
            </>
          ) : (
            <>
              <ProfileActions ctx={ctx} />
              <ProfileMoreMenu
                ctx={ctx}
                onShare={() => setShareOpen(true)}
                onContactInfo={() => setContactOpen(true)}
                onReport={() => setReportOpen(true)}
                onEditVisibility={() => openEdit("visibility")}
              />
            </>
          )}
        </div>

        {/* profile strength — owner only */}
        {isOwner && !gated && (
          <div className="mt-4">
            <ProfileStrength
              profileId={profile.id}
              authUserId={profile.user_id}
              onAction={handleStrengthAction}
            />
          </div>
        )}

        {/* About preview */}
        {!gated && bio.trim() && (
          <div className="mt-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/70 mb-1">
              About
            </h2>
            <p className="text-[15px] leading-relaxed text-foreground whitespace-pre-wrap break-words">
              {bioDisplay}
            </p>
            {bioTooLong && (
              <button
                type="button"
                onClick={() => setAboutExpanded((v) => !v)}
                className="text-muted-foreground/80 hover:text-primary text-sm font-medium mt-1"
              >
                {aboutExpanded ? "…show less" : "…see more"}
              </button>
            )}
          </div>
        )}
      </CardContent>

      {/* dialogs */}
      {isOwner && (
        <EditProfileDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          profile={profile}
          profileUserId={profile.user_id}
          initialTab={editInitialTab}
          onSaved={(patch) => {
            ctx.patchProfile(patch);
            notifyProfileChanged();
          }}
        />
      )}
      <ContactInfoDialog
        open={contactOpen}
        onOpenChange={setContactOpen}
        profile={profile}
        isOwner={isOwner}
      />
      <ShareProfileDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        profileId={profile.id}
        displayName={name}
      />
      {!isOwner && (
        <ReportProfileDialog
          open={reportOpen}
          onOpenChange={setReportOpen}
          reportedProfileId={profile.id}
          reporterProfileId={ctx.viewerProfileId}
          displayName={name}
        />
      )}
    </Card>
  );
};

export default ProfileHeaderCard;
