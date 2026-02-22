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

import { useAuth } from '@/contexts/AuthContext';

export default function Companies() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [showCompanyDialog, setShowCompanyDialog] = useState(false);
  const [editingCompany, setEditingCompany] = useState<any>(null);
  const [deletingCompanyId, setDeletingCompanyId] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      const controller = new AbortController();
      fetchProfile(controller.signal);
      return () => controller.abort();
    } else {
      navigate('/');
    }
  }, [user]);

  useEffect(() => {
    if (profileId) {
      const controller = new AbortController();
      fetchCompanies(controller.signal);
      return () => controller.abort();
    }
  }, [profileId]);

  const fetchProfile = async (signal?: AbortSignal) => {
    if (!user) return;

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .abortSignal(signal)
        .maybeSingle();

      if (error) {
        if (error.code === 'ABORTED') return;
        throw error;
      }

      if (profile) {
        setProfileId(profile.id);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchCompanies = async (signal?: AbortSignal) => {
    if (!profileId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('owner_id', profileId)
        .order('created_at', { ascending: false })
        .abortSignal(signal);

      if (error) {
        if (error.code === 'ABORTED') return;
        throw error;
      }
      setCompanies(data || []);
    } catch (error) {
      if ((error as any).name === 'AbortError' || (error as any).code === 'ABORTED') return;
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
      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('id')
        .eq('company_id', deletingCompanyId)
        .limit(1);

      if (jobsError) {
        if (jobsError.code === 'ABORTED') return;
        throw jobsError;
      }

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
      <div
        className="min-h-screen"
        style={{ background: "radial-gradient(1000px 300px at 0% 0%, #e9d5ff 0%, #fce7f3 40%, #dbeafe 80%)" }}
      >
        <div className="relative w-full bg-gradient-to-r from-indigo-300 via-pink-200 to-blue-200 rounded-b-3xl py-14 px-8 overflow-hidden mb-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
              <div className="text-center lg:text-left animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                <h1 className="text-3xl md:text-5xl font-extrabold text-[#1D2226] mb-2 tracking-tight">
                  My Companies
                </h1>
                <p className="text-gray-700 text-base md:text-lg font-medium max-w-2xl mx-auto lg:mx-0">
                  Manage your professional presence and job opportunities in one central dashboard.
                </p>
              </div>
              <div className="w-full lg:w-auto animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                <Button
                  onClick={() => {
                    setEditingCompany(null);
                    setShowCompanyDialog(true);
                  }}
                  className="w-full lg:w-auto rounded-2xl bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] hover:opacity-90 text-white shadow-xl hover:shadow-2xl hover:-translate-y-1 active:scale-[0.98] transition-all duration-300 px-10 py-7 h-auto text-lg font-bold border-none group"
                >
                  <Plus className="w-6 h-6 mr-2 group-hover:rotate-90 transition-transform duration-300" />
                  Add Company
                </Button>
              </div>
            </div>
          </div>
          <div className="pointer-events-none absolute inset-0 opacity-40">
            <div className="absolute -top-20 -right-32 w-[400px] h-[400px] bg-white/30 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-16 w-[300px] h-[300px] bg-white/20 rounded-full blur-3xl" />
          </div>
        </div>

      <div className="max-w-6xl mx-auto pb-12 px-0 sm:px-4">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-4 sm:px-0">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-64 rounded-none sm:rounded-[2rem]" />
            ))}
          </div>
        ) : companies.length === 0 ? (
          <Card className="border-4 border-dashed border-gray-100 rounded-none sm:rounded-[2rem] bg-white/50 backdrop-blur-sm overflow-hidden group shadow-none sm:shadow-card">
            <CardContent className="flex flex-col items-center justify-center py-16 sm:py-32 text-center relative px-4 sm:px-8">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-transparent to-purple-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
              <div className="relative z-10">
                <div className="w-32 h-32 bg-gradient-to-br from-[#F8FAFC] to-[#F1F5F9] rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl group-hover:scale-110 transition-transform duration-500 border-8 border-white">
                  <Building2 className="w-16 h-16 text-[#0077B5] opacity-20 group-hover:opacity-40 transition-opacity" />
                </div>
                <h3 className="text-3xl md:text-4xl font-black text-[#1D2226] mb-4 tracking-tight">No Companies Yet</h3>
                <p className="text-[#5E6B7E] mb-12 max-w-lg text-lg md:text-xl font-medium leading-relaxed">
                  Start your journey by creating a company profile. Post jobs, manage applicants, and build your employer brand.
                </p>
                <Button
                  onClick={() => setShowCompanyDialog(true)}
                  className="rounded-2xl bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] hover:opacity-90 text-white shadow-2xl hover:shadow-[0_20px_50px_rgba(131,58,180,0.3)] hover:-translate-y-1 active:scale-[0.98] transition-all duration-300 px-12 py-8 h-auto text-xl font-black border-none"
                >
                  <Plus className="w-7 h-7 mr-3" />
                  Create Company Profile
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-0 sm:px-0">
            {companies.map((company) => {
              const values: string[] = company.values || [];
              const getMeta = (key: string) => {
                const token = values.find((v) => v.startsWith(`__meta_${key}:`));
                if (!token) return undefined;
                return token.substring(token.indexOf(':') + 1);
              };
              const bannerUrl = getMeta('banner_url');
              const bannerStyle = getMeta('banner_style');
              let bannerGradient = "from-[#0077B5] via-[#833AB4] to-[#E1306C]";
              if (bannerStyle === "blue-teal") bannerGradient = "from-sky-400 via-cyan-500 to-teal-500";
              if (bannerStyle === "violet-purple") bannerGradient = "from-violet-500 via-purple-500 to-indigo-500";
              if (bannerStyle === "amber-orange") bannerGradient = "from-amber-400 via-orange-400 to-red-400";
              if (bannerStyle === "rose-pink") bannerGradient = "from-rose-400 via-pink-500 to-fuchsia-500";
              return (
              <Card key={company.id} className="group overflow-hidden border-0 sm:border border-gray-100 shadow-none sm:shadow-card hover:shadow-2xl transition-all duration-500 rounded-none sm:rounded-[2rem] bg-white/90 backdrop-blur-md flex flex-col hover:-translate-y-1">
                {/* Cover Banner */}
                <div className="h-40 w-full relative shrink-0 overflow-hidden">
                  {bannerUrl ? (
                    <div className="w-full h-full flex items-center justify-center bg-white">
                      <img
                        src={bannerUrl}
                        alt={`${company.name} banner`}
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-r ${bannerGradient}`} />
                  )}
                  <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors duration-500" />
                  <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] animate-gradient-shift" />
                  
                  {/* Top-right Edit/Delete Actions */}
                  <div className="absolute top-4 right-4 flex gap-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-y-[-10px] group-hover:translate-y-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(company)}
                      className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-md text-[#0077B5] hover:bg-[#0077B5] hover:text-white border border-white/50 shadow-sm transition-all duration-300"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingCompanyId(company.id)}
                      className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-md text-red-500 hover:bg-red-500 hover:text-white border border-white/50 shadow-sm transition-all duration-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <CardContent className="p-0 relative flex-1">
                  <div className="px-4 py-6 sm:px-8 sm:pb-8">
                    {/* Header: Logo + Info Layout */}
                    <div className="flex flex-col sm:flex-row gap-6 -mt-14 mb-6 relative z-10">
                      {/* Logo Container */}
                      <div className="relative shrink-0 mx-auto sm:mx-0 group/logo">
                        {company.logo_url ? (
                          <img
                            src={company.logo_url}
                            alt={company.name}
                            className="w-32 h-32 rounded-[2rem] object-cover border-[6px] border-white shadow-2xl bg-white group-hover/logo:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-32 h-32 rounded-[2rem] bg-gradient-to-br from-[#F8FAFC] to-[#F1F5F9] flex items-center justify-center border-[6px] border-white shadow-2xl group-hover/logo:scale-105 transition-transform duration-500">
                            <Building2 className="w-16 h-16 text-[#94A3B8]" />
                          </div>
                        )}
                        <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-500 border-4 border-white rounded-full shadow-lg animate-pulse" title="Active Company" />
                      </div>

                      {/* Name and Industry */}
                      <div className="flex-1 text-center sm:text-left pt-2 sm:pt-16">
                        <h3 className="text-2xl md:text-3xl font-black text-[#1D2226] mb-2 group-hover:text-[#0077B5] transition-colors line-clamp-1 tracking-tight">
                          {company.name}
                        </h3>
                        {company.industry && (
                          <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-gradient-to-r from-blue-50 to-indigo-50 text-[#0077B5] border border-blue-100/50 text-xs font-bold uppercase tracking-wider shadow-sm">
                            <span className="w-2 h-2 rounded-full bg-[#0077B5] mr-2 animate-pulse" />
                            {company.industry}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-8">
                      {/* Description */}
                      {company.description && (
                        <p className="text-[#5E6B7E] text-base leading-relaxed line-clamp-2 font-medium bg-gray-50/50 p-4 rounded-2xl border-l-4 border-[#0077B5]/30 italic">
                          "{company.description}"
                        </p>
                      )}

                      {/* Info Grid: Responsive layout */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {company.location && (
                          <div className="flex items-center gap-4 text-[#5E6B7E] p-3 rounded-xl hover:bg-white hover:shadow-sm transition-all duration-300 border border-transparent hover:border-gray-100">
                            <div className="p-2.5 rounded-xl bg-blue-50 text-[#0077B5] shadow-sm">
                              <MapPin className="w-5 h-5" />
                            </div>
                            <span className="font-semibold text-sm truncate">{company.location}</span>
                          </div>
                        )}
                        {company.employee_count && (
                          <div className="flex items-center gap-4 text-[#5E6B7E] p-3 rounded-xl hover:bg-white hover:shadow-sm transition-all duration-300 border border-transparent hover:border-gray-100">
                            <div className="p-2.5 rounded-xl bg-indigo-50 text-[#6366F1] shadow-sm">
                              <Users className="w-5 h-5" />
                            </div>
                            <span className="font-semibold text-sm">{company.employee_count} Employees</span>
                          </div>
                        )}
                        {company.founded_year && (
                          <div className="flex items-center gap-4 text-[#5E6B7E] p-3 rounded-xl hover:bg-white hover:shadow-sm transition-all duration-300 border border-transparent hover:border-gray-100">
                            <div className="p-2.5 rounded-xl bg-purple-50 text-[#8B5CF6] shadow-sm">
                              <Calendar className="w-5 h-5" />
                            </div>
                            <span className="font-semibold text-sm">Founded {company.founded_year}</span>
                          </div>
                        )}
                        {company.website && (
                          <div className="flex items-center gap-4 text-[#5E6B7E] p-3 rounded-xl hover:bg-white hover:shadow-sm transition-all duration-300 border border-transparent hover:border-gray-100">
                            <div className="p-2.5 rounded-xl bg-pink-50 text-[#EC4899] shadow-sm">
                              <Globe className="w-5 h-5" />
                            </div>
                            <a
                              href={company.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-bold text-sm text-[#0077B5] hover:underline truncate"
                            >
                              {company.website.replace(/^https?:\/\//, '')}
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons: Stacked on Mobile, Side-by-Side on Web */}
                      <div className="pt-4 flex flex-col lg:flex-row gap-4">
                        <Button
                          variant="outline"
                          className="flex-1 rounded-2xl border-2 border-[#0077B5]/20 text-[#0077B5] hover:bg-[#0077B5] hover:text-white hover:border-[#0077B5] transition-all duration-300 font-extrabold py-7 text-base shadow-sm hover:shadow-xl hover:-translate-y-1"
                          onClick={() => navigate(`/company/${company.id}`)}
                        >
                          View Profile
                        </Button>
                        <Button
                          className="flex-1 rounded-2xl bg-gradient-to-r from-[#0077B5] to-[#00A0DC] hover:from-[#005E93] hover:to-[#008CC9] text-white shadow-lg hover:shadow-2xl hover:-translate-y-1 active:scale-[0.98] transition-all duration-300 font-extrabold py-7 text-base border-none"
                          onClick={() => navigate(`/company/${company.id}/jobs`)}
                        >
                          <Briefcase className="w-6 h-6 mr-2" />
                          View Jobs
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )})}
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
      </div>
    </Layout>
  );
}
