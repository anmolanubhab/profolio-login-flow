import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ExperienceSection from './ExperienceSection';
import EducationSection from './EducationSection';
import SkillsSection from './SkillsSection';
import SocialLinksSection from './SocialLinksSection';

interface ProfileTabsProps {
  userId: string;
  profileId: string;
  isOwnProfile?: boolean;
}

const ProfileTabs = ({ userId, profileId, isOwnProfile = false }: ProfileTabsProps) => {
  return (
    <Tabs defaultValue="experience" className="w-full">
      <TabsList className="grid w-full grid-cols-4 mb-6">
        <TabsTrigger value="experience">Experience</TabsTrigger>
        <TabsTrigger value="education">Education</TabsTrigger>
        <TabsTrigger value="skills">Skills</TabsTrigger>
        <TabsTrigger value="social">Social Links</TabsTrigger>
      </TabsList>

      <TabsContent value="experience">
        <ExperienceSection userId={userId} isOwnProfile={isOwnProfile} />
      </TabsContent>

      <TabsContent value="education">
        <EducationSection userId={userId} isOwnProfile={isOwnProfile} />
      </TabsContent>

      <TabsContent value="skills">
        <SkillsSection userId={userId} profileId={profileId} isOwnProfile={isOwnProfile} />
      </TabsContent>

      <TabsContent value="social">
        <SocialLinksSection userId={userId} isOwnProfile={isOwnProfile} />
      </TabsContent>
    </Tabs>
  );
};

export default ProfileTabs;