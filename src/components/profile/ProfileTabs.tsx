import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ExperienceSection from './ExperienceSection';
import EducationSection from './EducationSection';
import SkillsSection from './SkillsSection';
import SocialLinksSection from './SocialLinksSection';

interface ProfileTabsProps {
  userId: string;
}

const ProfileTabs = ({ userId }: ProfileTabsProps) => {
  return (
    <Tabs defaultValue="experience" className="w-full">
      <TabsList className="grid w-full grid-cols-4 mb-6">
        <TabsTrigger value="experience">Experience</TabsTrigger>
        <TabsTrigger value="education">Education</TabsTrigger>
        <TabsTrigger value="skills">Skills</TabsTrigger>
        <TabsTrigger value="social">Social Links</TabsTrigger>
      </TabsList>

      <TabsContent value="experience">
        <ExperienceSection userId={userId} />
      </TabsContent>

      <TabsContent value="education">
        <EducationSection userId={userId} />
      </TabsContent>

      <TabsContent value="skills">
        <SkillsSection userId={userId} />
      </TabsContent>

      <TabsContent value="social">
        <SocialLinksSection userId={userId} />
      </TabsContent>
    </Tabs>
  );
};

export default ProfileTabs;