import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useCompanyAdmin } from '@/hooks/use-company-admin';
import { useCompanyInvitations } from '@/hooks/use-company';
import { CompanyDialog } from '@/components/jobs/CompanyDialog';
import { CompanyInvitationsCard } from '@/components/company/CompanyInvitationsCard';
import Feed from '@/components/Feed';
import Stories from '@/components/Stories';
import { CreateCompanyPostButton } from '@/components/company/CreateCompanyPostButton';
import { 
  Building2, 
  Plus, 
  Users, 
  FileText,
  BarChart3,
  Settings,
  MapPin,
  Calendar
} from 'lucide-react';

const CompanyDashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { companies, isLoading: loadingCompanies, profileId, refetch } = useCompanyAdmin();
  const { invitations, isLoading: loadingInvitations, acceptInvitation, rejectInvitation, refetch: refetchInvitations } = useCompanyInvitations();
  const [showCompanyDialog, setShowCompanyDialog] = useState(false);
  const [editingCompany, setEditingCompany] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('feed');
  const [refreshFeed, setRefreshFeed] = useState(0);

  if (!user) return null;

  const hasCompanies = companies.length > 0;

  const handleCompanyCreated = () => {
    refetch();
    setEditingCompany(null);
    setShowCompanyDialog(false);
  };

  const handlePostCreated = () => {
    setRefreshFeed(prev => prev + 1);
  };

  const handleInvitationAction = async () => {
    refetch();
    refetchInvitations();
  };

  // First-time flow: No companies yet
  if (!loadingCompanies && !hasCompanies && invitations.length === 0) {
    return (
      <Layout user={user} onSignOut={signOut}>
        <div className="max-w-2xl mx-auto py-12 px-4">
          <Card className="border-2 border-dashed border-primary/30">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <Building2 className="w-10 h-10 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Welcome to Company Dashboard
              </h1>
              <p className="text-muted-foreground mb-6 max-w-md">
                Create your first company profile to start posting as a company, 
                manage your team, and build your employer brand.
              </p>
              <Button
                onClick={() => setShowCompanyDialog(true)}
                className="bg-primary hover:bg-primary/90"
                size="lg"
              >
                <Plus className="w-5 h-5 mr-2" />
                Create Your First Company
              </Button>
            </CardContent>
          </Card>

          {profileId && (
            <CompanyDialog
              open={showCompanyDialog}
              onOpenChange={setShowCompanyDialog}
              profileId={profileId}
              onCompanyCreated={handleCompanyCreated}
            />
          )}
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onSignOut={signOut}>
      <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
        {/* Pending Invitations */}
        {!loadingInvitations && invitations.length > 0 && (
          <CompanyInvitationsCard
            invitations={invitations}
            isLoading={loadingInvitations}
            onAccept={async (id) => {
              const result = await acceptInvitation(id);
              if (result.success) handleInvitationAction();
              return result;
            }}
            onReject={async (id) => {
              const result = await rejectInvitation(id);
              if (result.success) handleInvitationAction();
              return result;
            }}
          />
        )}

        {/* My Companies Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Company Dashboard</h1>
            <p className="text-muted-foreground">
              Managing {companies.length} compan{companies.length === 1 ? 'y' : 'ies'}
            </p>
          </div>
          <Button
            onClick={() => {
              setEditingCompany(null);
              setShowCompanyDialog(true);
            }}
            variant="outline"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Company
          </Button>
        </div>

        {/* Company Cards */}
        {loadingCompanies ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {companies.map((membership) => (
              <Card 
                key={membership.company_id} 
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/company/${membership.company_id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {membership.company.logo_url ? (
                      <img
                        src={membership.company.logo_url}
                        alt={membership.company.name}
                        className="w-12 h-12 rounded-lg object-cover border border-border"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center border border-border">
                        <Building2 className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-foreground truncate">
                          {membership.company.name}
                        </h3>
                        <Badge 
                          variant={membership.role === 'super_admin' ? 'default' : 'secondary'}
                          className="shrink-0"
                        >
                          {membership.role === 'super_admin' ? 'Admin' : 'Editor'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {membership.company.description || 'No description'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="feed" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Feed
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="team" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Team
            </TabsTrigger>
          </TabsList>

          <TabsContent value="feed" className="space-y-4 mt-4">
            <Stories />
            <CreateCompanyPostButton onPostCreated={handlePostCreated} />
            <Feed refresh={refreshFeed} />
          </TabsContent>

          <TabsContent value="analytics" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  Company Analytics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">Analytics Coming Soon</p>
                  <p className="text-sm mt-1">
                    Track your company's reach, engagement, and follower growth.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="team" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Team Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {companies.map((membership) => (
                    <div 
                      key={membership.company_id}
                      className="flex items-center justify-between p-4 rounded-lg border border-border"
                    >
                      <div className="flex items-center gap-3">
                        {membership.company.logo_url ? (
                          <img
                            src={membership.company.logo_url}
                            alt={membership.company.name}
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-foreground">{membership.company.name}</p>
                          <p className="text-sm text-muted-foreground">
                            You are {membership.role === 'super_admin' ? 'an Admin' : 'a Content Editor'}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/company/${membership.company_id}`);
                        }}
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        Manage
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {profileId && (
        <CompanyDialog
          open={showCompanyDialog}
          onOpenChange={(open) => {
            setShowCompanyDialog(open);
            if (!open) setEditingCompany(null);
          }}
          profileId={profileId}
          onCompanyCreated={handleCompanyCreated}
          editCompany={editingCompany}
        />
      )}
    </Layout>
  );
};

export default CompanyDashboard;