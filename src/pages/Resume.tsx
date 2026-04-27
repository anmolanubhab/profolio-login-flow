import ResumeBuilder from '@/components/ResumeBuilder';
import BottomNavigation from '@/components/BottomNavigation';

const Resume = () => {
  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-primary text-primary-foreground sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3">
          <h1 className="text-xl font-bold">Resume Builder</h1>
        </div>
      </header>
      
      <div className="container mx-auto px-4 py-6">
        <ResumeBuilder />
      </div>
      
      <BottomNavigation />
    </div>
  );
};

export default Resume;