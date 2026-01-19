import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CompanyDialog } from '@/components/jobs/CompanyDialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Building2, MapPin, Globe, Users, Calendar, Edit, Trash2, Plus, Briefcase } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

export default function Companies() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [showCompanyDialog, setShowCompanyDialog] = useState(false);
  const [editingCompany, setEditingCompany] = useState<any>(null);
  const [deletingCompanyId, setDeletingCompanyId] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (profileId) {
      fetchCompanies();
    }
  }, [profileId]);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/');
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (profile) {
      setProfileId(profile.id);
    }
  };

  const fetchCompanies = async () => {
    if (!profileId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('owner_id', profileId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error('Error fetching companies:', error);
      toast({
        title: 'Error',
        description: 'Failed to load companies',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (company: any) => {
    setEditingCompany(company);
    setShowCompanyDialog(true);
  };

  const handleDelete = async () => {
    if (!deletingCompanyId) return;

    try {
      // Check if company has any jobs
      const { data: jobs } = await supabase
        .from('jobs')
        .select('id')
        .eq('company_id', deletingCompanyId)
        .limit(1);

      if (jobs && jobs.length > 0) {
        toast({
          title: 'Cannot Delete',
          description: 'This company has active job posts. Please remove or reassign them first.',
          variant: 'destructive',
        });
        setDeletingCompanyId(null);
        return;
      }

      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', deletingCompanyId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Company deleted successfully',
      });

      setCompanies(companies.filter(c => c.id !== deletingCompanyId));
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setDeletingCompanyId(null);
    }
  };

  const handleCompanyCreated = () => {
    fetchCompanies();
    setEditingCompany(null);
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#1D2226] mb-2">My Companies</h1>
            <p className="text-[#5E6B7E]">Manage your company profiles and job postings</p>
          </div>
          <Button
            onClick={() => {
              setEditingCompany(null);
              setShowCompanyDialog(true);
            }}
            className="bg-[#0A66C2] hover:bg-[#084c97] text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Company
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        ) : companies.length === 0 ? (
          <Card className="border-2 border-dashed border-[#E5E7EB]">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Building2 className="w-16 h-16 text-[#5E6B7E] mb-4" />
              <h3 className="text-xl font-semibold text-[#1D2226] mb-2">No Companies Yet</h3>
              <p className="text-[#5E6B7E] mb-6 max-w-md">
                Create your first company profile to start posting jobs and building your employer brand
              </p>
              <Button
                onClick={() => setShowCompanyDialog(true)}
                className="bg-[#0A66C2] hover:bg-[#084c97] text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Company Profile
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {companies.map((company) => (
              <Card key={company.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-4 flex-1">
                      {company.logo_url ? (
                        <img
                          src={company.logo_url}
                          alt={company.name}
                          className="w-16 h-16 rounded-lg object-cover border-2 border-[#E5E7EB]"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-[#F3F6F9] flex items-center justify-center border-2 border-[#E5E7EB]">
                          <Building2 className="w-8 h-8 text-[#5E6B7E]" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg text-[#1D2226] mb-1 truncate">
                          {company.name}
                        </h3>
                        {company.industry && (
                          <Badge variant="secondary" className="text-xs bg-[#F3F6F9] text-[#5E6B7E]">
                            {company.industry}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(company)}
                        className="text-[#0A66C2] hover:bg-[#F3F6F9]"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingCompanyId(company.id)}
                        className="text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {company.description && (
                    <p className="text-sm text-[#5E6B7E] line-clamp-2 mb-4">
                      {company.description}
                    </p>
                  )}

                  <div className="space-y-2">
                    {company.location && (
                      <div className="flex items-center gap-2 text-sm text-[#5E6B7E]">
                        <MapPin className="w-4 h-4" />
                        <span>{company.location}</span>
                      </div>
                    )}
                    {company.employee_count && (
                      <div className="flex items-center gap-2 text-sm text-[#5E6B7E]">
                        <Users className="w-4 h-4" />
                        <span>{company.employee_count} employees</span>
                      </div>
                    )}
                    {company.founded_year && (
                      <div className="flex items-center gap-2 text-sm text-[#5E6B7E]">
                        <Calendar className="w-4 h-4" />
                        <span>Founded in {company.founded_year}</span>
                      </div>
                    )}
                    {company.website && (
                      <div className="flex items-center gap-2 text-sm">
                        <Globe className="w-4 h-4 text-[#5E6B7E]" />
                        <a
                          href={company.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#0A66C2] hover:underline truncate"
                        >
                          {company.website.replace(/^https?:\/\//, '')}
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-[#E5E7EB] flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-[#E5E7EB] hover:bg-[#F3F6F9]"
                      onClick={() => navigate(`/company/${company.id}`)}
                    >
                      View Profile
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-[#E5E7EB] hover:bg-[#F3F6F9]"
                      onClick={() => navigate(`/jobs?company=${company.id}`)}
                    >
                      <Briefcase className="w-4 h-4 mr-2" />
                      View Jobs
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

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

        <AlertDialog open={!!deletingCompanyId} onOpenChange={(open) => !open && setDeletingCompanyId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Company</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this company? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}