import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Login from '@/components/Login';
import { getDefaultDashboard } from '@/components/auth/ProtectedRoute';

const Index = () => {
  const { user, session, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && session && role) {
      const dashboard = getDefaultDashboard(role);
      navigate(dashboard, { replace: true });
    }
  }, [user, session, role, loading, navigate]);

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

  // Show loading while role is being fetched for redirect
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
};

export default Index;
