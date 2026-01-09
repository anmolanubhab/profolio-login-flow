import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, AppRole } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
  redirectTo?: string;
}

const roleToDefaultDashboard: Record<AppRole, string> = {
  student: '/dashboard/student',
  employer: '/dashboard/employer',
  company_admin: '/dashboard/company',
  company_employee: '/dashboard/employee',
  mentor: '/dashboard/mentor',
  admin: '/dashboard/admin',
  recruiter: '/dashboard/recruiter',
  user: '/dashboard/student', // fallback for legacy 'user' role
};

export const getDefaultDashboard = (role: AppRole | null): string => {
  if (!role) return '/';
  return roleToDefaultDashboard[role] || '/dashboard/student';
};

const ProtectedRoute = ({ children, allowedRoles, redirectTo = '/' }: ProtectedRouteProps) => {
  const { user, session, role, loading } = useAuth();
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

  // Role check
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    // Redirect to their proper dashboard
    const correctDashboard = getDefaultDashboard(role);
    return <Navigate to={correctDashboard} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
