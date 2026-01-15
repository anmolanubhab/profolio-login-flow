import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

// Simplified: All authenticated users go to unified dashboard
export const getDefaultDashboard = (): string => {
  return '/dashboard';
};

const ProtectedRoute = ({ children, redirectTo = '/' }: ProtectedRouteProps) => {
  const { user, session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Not authenticated
  if (!user || !session) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Authenticated - render children (no role-based redirection)
  return <>{children}</>;
};

export default ProtectedRoute;
