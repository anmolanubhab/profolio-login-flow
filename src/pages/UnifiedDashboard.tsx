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
import { Building2, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

const UnifiedDashboard = () => {
  const { user, signOut } = useAuth();
  const { companies, hasCompanies, isLoading: companiesLoading } = useCompanyAdmin();

  if (!user) return null;

  return (
    <Layout user={user} onSignOut={signOut}>
      <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
        {/* Pending Company Invitations */}
        <CompanyInvitationsCard />
        
        {/* User's Job Applications */}
        <UserApplicationsCard />
        
        {/* Company Switcher - Only show if user manages companies */}
        {!companiesLoading && hasCompanies && (
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
                    <Button variant="outline" size="sm" className="gap-2">
                      {membership.company.logo_url ? (
                        <img 
                          src={membership.company.logo_url} 
                          alt={membership.company.name}
                          className="h-4 w-4 rounded object-cover"
                        />
                      ) : (
                        <Building2 className="h-4 w-4" />
                      )}
                      {membership.company.name}
                      <span className="text-xs text-muted-foreground capitalize">
                        ({membership.role === 'super_admin' ? 'Admin' : 'Content'})
                      </span>
                    </Button>
                  </Link>
                ))}
                <Link to="/companies">
                  <Button variant="ghost" size="sm" className="gap-1 text-primary">
                    <Plus className="h-4 w-4" />
                    Create Company
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        <Stories />
        <QuickActions />
        <CreateCompanyPostButton />
        <Feed />
      </div>
    </Layout>
  );
};

export default UnifiedDashboard;
