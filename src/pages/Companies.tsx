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
      <div className="relative w-full overflow-hidden mb-8">
        <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] opacity-10 animate-gradient-shift" />
        <div className="max-w-6xl mx-auto py-12 px-4 relative">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-[#1D2226] mb-2 tracking-tight">My Companies</h1>
              <p className="text-[#5E6B7E] text-base md:text-lg font-medium">Manage your professional presence and job opportunities</p>
            </div>
            <Button
              onClick={() => {
                setEditingCompany(null);
                setShowCompanyDialog(true);
              }}
              className="w-full md:w-auto rounded-2xl bg-gradient-to-r from-[#0077B5] to-[#00A0DC] hover:from-[#005E93] hover:to-[#008CC9] text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-300 px-8 py-6 h-auto text-base font-semibold border-none"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Company
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto pb-12 px-4">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        ) : companies.length === 0 ? (
          <Card className="border-2 border-dashed border-gray-200 rounded-3xl bg-white/50 backdrop-blur-sm">
            <CardContent className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
                <Building2 className="w-12 h-12 text-[#0077B5] opacity-50" />
              </div>
              <h3 className="text-2xl font-bold text-[#1D2226] mb-3">No Companies Yet</h3>
              <p className="text-[#5E6B7E] mb-8 max-w-md text-lg">
                Create your first company profile to start posting jobs and building your employer brand
              </p>
              <Button
                onClick={() => setShowCompanyDialog(true)}
                className="rounded-2xl bg-gradient-to-r from-[#0077B5] to-[#00A0DC] hover:from-[#005E93] hover:to-[#008CC9] text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 px-10 py-7 h-auto text-lg font-bold border-none"
              >
                <Plus className="w-6 h-6 mr-2" />
                Create Company Profile
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {companies.map((company) => (
              <Card key={company.id} className="group overflow-hidden border-none shadow-md hover:shadow-2xl transition-all duration-500 rounded-3xl bg-white/80 backdrop-blur-sm flex flex-col">
                {/* Cover Banner */}
                <div className="h-32 w-full bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] opacity-80 group-hover:opacity-100 transition-opacity duration-500 relative shrink-0">
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors duration-500" />
                  
                  {/* Top-right Edit/Delete Actions */}
                  <div className="absolute top-4 right-4 flex gap-2 z-20">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(company)}
                      className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-white hover:text-[#0077B5] border border-white/30 transition-all duration-300"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingCompanyId(company.id)}
                      className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-red-500 hover:text-white border border-white/30 transition-all duration-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <CardContent className="p-0 relative flex-1">
                  <div className="px-6 pb-6">
                    {/* Header: Logo + Info Layout (Horizontal on Web, Vertical on Mobile) */}
                    <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 -mt-12 mb-6 relative z-10">
                      {/* Logo Container */}
                      <div className="relative shrink-0 mx-auto sm:mx-0">
                        {company.logo_url ? (
                          <img
                            src={company.logo_url}
                            alt={company.name}
                            className="w-28 h-28 rounded-3xl object-cover border-4 border-white shadow-xl bg-white"
                          />
                        ) : (
                          <div className="w-28 h-28 rounded-3xl bg-[#F3F6F9] flex items-center justify-center border-4 border-white shadow-xl">
                            <Building2 className="w-14 h-14 text-[#5E6B7E]" />
                          </div>
                        )}
                        <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-green-500 border-4 border-white rounded-full shadow-lg" title="Active Company" />
                      </div>

                      {/* Name and Industry */}
                      <div className="flex-1 text-center sm:text-left pt-1 sm:pt-14">
                        <h3 className="text-2xl font-extrabold text-[#1D2226] mb-1 group-hover:text-[#0077B5] transition-colors line-clamp-1">
                          {company.name}
                        </h3>
                        {company.industry && (
                          <Badge className="bg-gradient-to-r from-blue-50 to-indigo-50 text-[#0077B5] border-blue-100 rounded-full px-4 py-1 font-semibold hover:from-blue-100 hover:to-indigo-100 transition-all">
                            {company.industry}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="space-y-6">
                      {/* Description */}
                      {company.description && (
                        <p className="text-[#5E6B7E] text-sm md:text-base line-clamp-2 leading-relaxed italic border-l-2 border-blue-100 pl-4">
                          "{company.description}"
                        </p>
                      )}

                      {/* Info Grid: Responsive 1 column on mobile, 2 on tablet/web */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 bg-gray-50/50 rounded-2xl p-4 border border-gray-100/50">
                        {company.location && (
                          <div className="flex items-center gap-3 text-[#5E6B7E] text-sm font-medium">
                            <div className="p-2 rounded-xl bg-white text-gray-400 group-hover:text-[#0077B5] group-hover:shadow-sm transition-all duration-300">
                              <MapPin className="w-4 h-4" />
                            </div>
                            <span className="truncate">{company.location}</span>
                          </div>
                        )}
                        {company.employee_count && (
                          <div className="flex items-center gap-3 text-[#5E6B7E] text-sm font-medium">
                            <div className="p-2 rounded-xl bg-white text-gray-400 group-hover:text-[#0077B5] group-hover:shadow-sm transition-all duration-300">
                              <Users className="w-4 h-4" />
                            </div>
                            <span>{company.employee_count}</span>
                          </div>
                        )}
                        {company.founded_year && (
                          <div className="flex items-center gap-3 text-[#5E6B7E] text-sm font-medium">
                            <div className="p-2 rounded-xl bg-white text-gray-400 group-hover:text-[#0077B5] group-hover:shadow-sm transition-all duration-300">
                              <Calendar className="w-4 h-4" />
                            </div>
                            <span>Est. {company.founded_year}</span>
                          </div>
                        )}
                        {company.website && (
                          <div className="flex items-center gap-3 text-sm font-medium overflow-hidden">
                            <div className="p-2 rounded-xl bg-white text-gray-400 group-hover:text-[#0077B5] group-hover:shadow-sm transition-all duration-300">
                              <Globe className="w-4 h-4" />
                            </div>
                            <a
                              href={company.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#0077B5] hover:underline truncate"
                            >
                              {company.website.replace(/^https?:\/\//, '')}
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons: Stacked on Mobile, Side-by-Side on Web */}
                      <div className="pt-2 flex flex-col sm:flex-row gap-3">
                        <Button
                          variant="outline"
                          className="flex-1 rounded-2xl border-2 border-[#0077B5]/20 text-[#0077B5] hover:bg-gradient-to-r hover:from-[#0077B5] hover:to-[#00A0DC] hover:text-white hover:border-transparent transition-all duration-300 font-bold py-6 shadow-sm hover:shadow-md"
                          onClick={() => navigate(`/company/${company.id}`)}
                        >
                          View Profile
                        </Button>
                        <Button
                          className="flex-1 rounded-2xl bg-gradient-to-r from-[#0077B5] to-[#00A0DC] hover:from-[#005E93] hover:to-[#008CC9] text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-300 font-bold py-6 border-none"
                          onClick={() => navigate(`/company/${company.id}/jobs`)}
                        >
                          <Briefcase className="w-5 h-5 mr-2" />
                          View Jobs
                        </Button>
                      </div>
                    </div>
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