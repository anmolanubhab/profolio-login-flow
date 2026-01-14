import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import Feed from '@/components/Feed';
import Stories from '@/components/Stories';
import QuickActions from '@/components/QuickActions';
import { CreateCompanyPostButton } from '@/components/company/CreateCompanyPostButton';
import { CompanyInvitationsCard } from '@/components/company/CompanyInvitationsCard';
import { UserApplicationsCard } from '@/components/jobs/UserApplicationsCard';
import { useCompanyAdmin } from '@/hooks/use-company-admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, Plus, Briefcase, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

const UnifiedDashboard = () => {
  const { user, signOut } = useAuth();
  const { companies, hasCompanies, isLoading: companiesLoading } = useCompanyAdmin();

  if (!user) return null;

  return (
    <Layout user={user} onSignOut={signOut}>
      <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
        {/* Pending Company Invitations */}
        <CompanyInvitationsCard />
        
        {/* User's Job Applications - Collapsible */}
        <UserApplicationsCard />
        
        {/* Company Switcher - Only show if user manages companies */}
        {companiesLoading ? (
          <Card className="border-none shadow-sm bg-gradient-to-r from-primary/5 to-primary/10">
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex gap-2">
                <Skeleton className="h-8 w-28" />
                <Skeleton className="h-8 w-28" />
              </div>
            </CardContent>
          </Card>
        ) : hasCompanies ? (
          <Card className="border-none shadow-sm bg-gradient-to-r from-primary/5 to-primary/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Your Companies
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2">
                {companies.map((membership) => (
                  <Link
                    key={membership.company_id}
                    to={`/company/${membership.company_id}`}
                  >
                    <Button variant="outline" size="sm" className="gap-2 hover:bg-primary/5 hover:border-primary/30 transition-colors">
                      {membership.company.logo_url ? (
                        <img 
                          src={membership.company.logo_url} 
                          alt={membership.company.name}
                          className="h-4 w-4 rounded object-cover"
                        />
                      ) : (
                        <Building2 className="h-4 w-4" />
                      )}
                      <span className="max-w-[120px] truncate">{membership.company.name}</span>
                      <span className="text-[10px] text-muted-foreground capitalize px-1.5 py-0.5 bg-muted rounded">
                        {membership.role === 'super_admin' ? 'Admin' : 'Content'}
                      </span>
                    </Button>
                  </Link>
                ))}
                <Link to="/companies">
                  <Button variant="ghost" size="sm" className="gap-1 text-primary hover:text-primary hover:bg-primary/10">
                    <Plus className="h-4 w-4" />
                    Create Company
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Quick Actions Row */}
        <div className="grid grid-cols-2 gap-3">
          <Link to="/jobs">
            <Card className="border hover:shadow-md transition-all cursor-pointer hover:border-primary/30 group">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Briefcase className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Find Jobs</p>
                  <p className="text-xs text-muted-foreground">Browse opportunities</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link to="/network">
            <Card className="border hover:shadow-md transition-all cursor-pointer hover:border-primary/30 group">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">My Network</p>
                  <p className="text-xs text-muted-foreground">Grow connections</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        <Stories />
        <QuickActions />
        <CreateCompanyPostButton />
        <Feed />
      </div>
    </Layout>
  );
};

export default UnifiedDashboard;
