import { useState } from "react";
import { MapPin, Pencil, BadgeCheck, Briefcase } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CoverImage } from "@/components/profile/CoverImage";
import { ProfilePhoto } from "@/components/profile/ProfilePhoto";
import { ProfileActions } from "@/components/profile/ProfileActions";
import { AddSectionMenu } from "@/components/profile/AddSectionMenu";
import { ProfileMoreMenu } from "@/components/profile/ProfileMoreMenu";
import { ProfileCompletion } from "@/components/profile/ProfileCompletion";
import { EditProfileDialog } from "@/components/profile/EditProfileDialog";
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

  const [editOpen, setEditOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [aboutExpanded, setAboutExpanded] = useState(false);

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
        <div className="mt-3 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="text-2xl font-bold text-foreground leading-tight">
              {name}
            </h1>
            {profile.pronouns && (
              <span className="text-sm text-muted-foreground">
                ({profile.pronouns})
              </span>
            )}
            {/* Verification: shown when the account has a confirmed email on file */}
            {profile.email && (
              <BadgeCheck
                className="h-4 w-4 text-primary"
                aria-label="Email verified"
              />
            )}
          </div>

          {profile.open_to_work && (
            <Badge className="gap-1 bg-primary/10 text-primary hover:bg-primary/15 border-0">
              <Briefcase className="h-3 w-3" />
              Open to work
            </Badge>
          )}

          {headline && (
            <p className="text-[15px] text-foreground/90 whitespace-pre-wrap">
              {headline}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            {profile.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {profile.location}
              </span>
            )}
            {!gated && (
              <>
                {profile.location && <span aria-hidden>·</span>}
                <button
                  type="button"
                  onClick={() => setContactOpen(true)}
                  className="text-primary font-medium hover:underline"
                >
                  Contact info
                </button>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {counts.connections != null && (
              <span className="text-foreground font-medium">
                {counts.connections}
                <span className="text-muted-foreground font-normal">
                  {" "}
                  connection{counts.connections === 1 ? "" : "s"}
                </span>
              </span>
            )}
            <span className="text-foreground font-medium">
              {counts.followers}
              <span className="text-muted-foreground font-normal">
                {" "}
                follower{counts.followers === 1 ? "" : "s"}
              </span>
            </span>
          </div>
        </div>

        {/* actions */}
        <div className="mt-4 flex flex-wrap items-center gap-2 sm:justify-end">
          {isOwner ? (
            <>
              <Button onClick={() => setEditOpen(true)} className="gap-2">
                <Pencil className="h-4 w-4" />
                Edit profile
              </Button>
              <AddSectionMenu onEditAbout={() => setEditOpen(true)} />
              <ProfileMoreMenu
                ctx={ctx}
                onShare={() => setShareOpen(true)}
                onContactInfo={() => setContactOpen(true)}
                onReport={() => setReportOpen(true)}
                onEditVisibility={() => setEditOpen(true)}
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
                onEditVisibility={() => setEditOpen(true)}
              />
            </>
          )}
        </div>

        {/* profile completion — owner only */}
        {isOwner && !gated && (
          <div className="mt-4">
            <ProfileCompletion ctx={ctx} onEdit={() => setEditOpen(true)} />
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
          onSaved={ctx.patchProfile}
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
