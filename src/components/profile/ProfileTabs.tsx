import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Feed from "@/components/Feed";
import ExperienceSection from "./ExperienceSection";
import EducationSection from "./EducationSection";
import SkillsSection from "./SkillsSection";
import CertificationsSection from "./CertificationsSection";
import ProjectsSection from "./ProjectsSection";
import LanguagesSection from "./LanguagesSection";
import SocialLinksSection from "./SocialLinksSection";
import {
  scrollToProfileSectionWhenReady,
  type ProfileSectionKey,
} from "@/lib/profileNav";
import type { ProfileContextValue } from "@/components/profile/profileTypes";

interface ProfileTabsProps {
  ctx: ProfileContextValue;
}

// section anchors used by the "Add section" menu + #hash deep links
const SECTION_IDS = [
  "experience",
  "education",
  "skills",
  "certifications",
  "projects",
  "languages",
  "social",
] as const;

function initialTab(): "profile" | "activity" {
  if (typeof window === "undefined") return "profile";
  return window.location.hash.replace("#", "") === "activity" ? "activity" : "profile";
}

const ProfileTabs = ({ ctx }: ProfileTabsProps) => {
  const { profileId, targetUserId, isOwner } = ctx;
  const [tab, setTab] = useState<"profile" | "activity">(initialTab);

  // hash → tab + scroll to a section anchor
  useEffect(() => {
    const apply = () => {
      const h = window.location.hash.replace("#", "");
      if (h === "activity") {
        setTab("activity");
        return;
      }
      if ((SECTION_IDS as readonly string[]).includes(h)) {
        setTab("profile");
        // Shared settle-aware scroll: waits for the section cards to finish
        // their own async loads before scrolling, so a direct /profile#skills
        // hit (and back/forward to one) lands on the right section. Runs after
        // the state update is queued so the Profile tab content is rendering.
        scrollToProfileSectionWhenReady(h as ProfileSectionKey);
      }
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  const handleChange = (value: string) => {
    const next = value === "activity" ? "activity" : "profile";
    setTab(next);
    if (typeof window !== "undefined") {
      const hash = next === "activity" ? "#activity" : "";
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}${hash}`
      );
    }
  };

  return (
    <Tabs value={tab} onValueChange={handleChange} className="w-full">
      <TabsList className="grid w-full grid-cols-2 mb-4">
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
      </TabsList>

      <TabsContent value="profile" className="space-y-4">
        <ExperienceSection profileId={profileId} isOwner={isOwner} />
        <EducationSection profileId={profileId} isOwner={isOwner} />
        <SkillsSection userId={targetUserId} profileId={profileId} isOwnProfile={isOwner} />
        {isOwner && <CertificationsSection authUserId={targetUserId} />}
        <ProjectsSection ctx={ctx} />
        <LanguagesSection profileId={profileId} isOwner={isOwner} />
        <SocialLinksSection userId={targetUserId} isOwnProfile={isOwner} />
      </TabsContent>

      <TabsContent value="activity">
        <div className="mt-2">
          <Feed userId={targetUserId} />
        </div>
      </TabsContent>
    </Tabs>
  );
};

export default ProfileTabs;
