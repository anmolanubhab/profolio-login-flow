import ResumeBuilder from '@/components/ResumeBuilder';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';

const Resume = () => {
  const { user, signOut } = useAuth();

  return (
    <Layout user={user} onSignOut={signOut}>
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-xl font-bold mb-4">Resume Builder</h1>
        <ResumeBuilder />
      </div>
    </Layout>
  );
};

export default Resume;