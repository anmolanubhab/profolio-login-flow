import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ExperienceSection from './ExperienceSection';
import EducationSection from './EducationSection';
import SkillsSection from './SkillsSection';
import SocialLinksSection from './SocialLinksSection';
import Feed from '@/components/Feed';
import { ProofOfWork } from './redesign/ProofOfWork';

interface ProfileTabsProps {
  userId: string;
  profileId: string;
  isOwnProfile?: boolean;
}

const ProfileTabs = ({ userId, profileId, isOwnProfile = false }: ProfileTabsProps) => {
  return (
    <Tabs defaultValue="posts" className="w-full">
      <TabsList className="grid w-full grid-cols-6 mb-6 overflow-x-auto">
        <TabsTrigger value="posts">Activity</TabsTrigger>
        <TabsTrigger value="experience">Experience</TabsTrigger>
        <TabsTrigger value="education">Education</TabsTrigger>
        <TabsTrigger value="skills">Skills</TabsTrigger>
        <TabsTrigger value="portfolio">Proof of Work</TabsTrigger>
        <TabsTrigger value="social">Contact</TabsTrigger>
      </TabsList>

      <TabsContent value="posts">
        <div className="mt-6">
          <Feed userId={userId} />
        </div>
      </TabsContent>

      <TabsContent value="experience">
        <ExperienceSection userId={userId} isOwnProfile={isOwnProfile} />
      </TabsContent>

      <TabsContent value="education">
        <EducationSection userId={userId} isOwnProfile={isOwnProfile} />
      </TabsContent>

      <TabsContent value="skills">
        <SkillsSection userId={userId} profileId={profileId} isOwnProfile={isOwnProfile} />
      </TabsContent>

      <TabsContent value="portfolio">
        <ProofOfWork userId={userId} isOwnProfile={isOwnProfile} />
      </TabsContent>

      <TabsContent value="social">
        <SocialLinksSection userId={userId} isOwnProfile={isOwnProfile} />
      </TabsContent>
    </Tabs>
  );
};

export default ProfileTabs;