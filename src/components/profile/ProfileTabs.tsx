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
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-100 w-full px-4 sm:px-0">
        <div className="max-w-4xl mx-auto">
          <TabsList className="flex w-full justify-start overflow-x-auto h-auto p-0 bg-transparent gap-6 md:gap-8 no-scrollbar">
            <TabsTrigger 
              value="posts"
              className="rounded-none border-b-2 border-transparent px-2 py-3 text-sm font-medium text-gray-500 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-colors hover:text-gray-900"
            >
              Activity
            </TabsTrigger>
            <TabsTrigger 
              value="experience"
              className="rounded-none border-b-2 border-transparent px-2 py-3 text-sm font-medium text-gray-500 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-colors hover:text-gray-900"
            >
              Experience
            </TabsTrigger>
            <TabsTrigger 
              value="education"
              className="rounded-none border-b-2 border-transparent px-2 py-3 text-sm font-medium text-gray-500 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-colors hover:text-gray-900"
            >
              Education
            </TabsTrigger>
            <TabsTrigger 
              value="skills"
              className="rounded-none border-b-2 border-transparent px-2 py-3 text-sm font-medium text-gray-500 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-colors hover:text-gray-900"
            >
              Skills
            </TabsTrigger>
            <TabsTrigger 
              value="portfolio"
              className="rounded-none border-b-2 border-transparent px-2 py-3 text-sm font-medium text-gray-500 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-colors hover:text-gray-900"
            >
              Proof of Work
            </TabsTrigger>
            <TabsTrigger 
              value="social"
              className="rounded-none border-b-2 border-transparent px-2 py-3 text-sm font-medium text-gray-500 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-colors hover:text-gray-900"
            >
              Contact
            </TabsTrigger>
          </TabsList>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-0 sm:px-6 py-6">
        <TabsContent value="posts" className="mt-0">
          <Feed userId={userId} />
        </TabsContent>

        <TabsContent value="experience" className="mt-0">
          <ExperienceSection userId={userId} isOwnProfile={isOwnProfile} />
        </TabsContent>

        <TabsContent value="education" className="mt-0">
          <EducationSection userId={userId} isOwnProfile={isOwnProfile} />
        </TabsContent>

        <TabsContent value="skills" className="mt-0">
          <SkillsSection userId={userId} profileId={profileId} isOwnProfile={isOwnProfile} />
        </TabsContent>

        <TabsContent value="portfolio" className="mt-0">
          <ProofOfWork userId={userId} isOwnProfile={isOwnProfile} />
        </TabsContent>

        <TabsContent value="social" className="mt-0">
          <SocialLinksSection userId={userId} isOwnProfile={isOwnProfile} />
        </TabsContent>
      </div>
    </Tabs>
  );
};

export default ProfileTabs;
