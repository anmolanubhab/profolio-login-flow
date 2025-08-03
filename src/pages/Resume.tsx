import ResumeBuilder from '@/components/ResumeBuilder';

const Resume = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        <ResumeBuilder />
      </div>
    </div>
  );
};

export default Resume;