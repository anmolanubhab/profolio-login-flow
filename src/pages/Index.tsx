import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Login from '@/components/Login';

const Index = () => {
  const { user, session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Simple redirect: authenticated users go to dashboard
    if (!loading && user && session) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, session, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!user || !session) {
    return <Login />;
  }

  // Show loading while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
};

export default Index;
