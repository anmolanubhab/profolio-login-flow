import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { 
  Building2, 
  MapPin, 
  Globe, 
  Users, 
  Calendar, 
  Briefcase,
  ExternalLink,
  Heart,
  Target
} from 'lucide-react';

interface Company {
  id: string;
  name: string;
  description: string | null;
  industry: string | null;
  location: string | null;
  website: string | null;
  logo_url: string | null;
  employee_count: string | null;
  founded_year: number | null;
  culture: string | null;
  values: string[] | null;
}

interface Job {
  id: string;
  title: string;
  location: string | null;
  employment_type: string | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  posted_at: string;
}

export default function CompanyProfile() {
  const { companyId } = useParams<{ companyId: string }>();
  const [company, setCompany] = useState<Company | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (companyId) {
      fetchCompanyData();
    }
  }, [companyId]);

  const fetchCompanyData = async () => {
    setLoading(true);
    try {
      // Fetch company details
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .maybeSingle();

      if (companyError) throw companyError;
      setCompany(companyData);

      // Fetch open jobs for this company
      if (companyData) {
        const { data: jobsData, error: jobsError } = await supabase
          .from('jobs')
          .select('id, title, location, employment_type, salary_min, salary_max, currency, posted_at')
          .eq('company_id', companyId)
          .eq('status', 'open')
          .order('posted_at', { ascending: false });

        if (jobsError) throw jobsError;
        setJobs(jobsData || []);
      }
    } catch (error) {
      console.error('Error fetching company data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatSalary = (min: number | null, max: number | null, currency: string | null) => {
    if (!min && !max) return null;
    const curr = currency || 'USD';
    if (min && max) return `${curr} ${min.toLocaleString()} - ${max.toLocaleString()}`;
    if (min) return `${curr} ${min.toLocaleString()}+`;
    return `Up to ${curr} ${max?.toLocaleString()}`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Layout>
    );
  }

  if (!company) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto py-16 px-4 text-center">
          <Building2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Company Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The company you're looking for doesn't exist or has been removed.
          </p>
          <Button asChild>
            <Link to="/jobs">Browse Jobs</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
        {/* Company Header */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-6">
              {company.logo_url ? (
                <img
                  src={company.logo_url}
                  alt={company.name}
                  className="w-24 h-24 rounded-xl object-cover border-2 border-border"
                />
              ) : (
                <div className="w-24 h-24 rounded-xl bg-muted flex items-center justify-center border-2 border-border">
                  <Building2 className="w-12 h-12 text-muted-foreground" />
                </div>
              )}
              
              <div className="flex-1">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">{company.name}</h1>
                    {company.industry && (
                      <Badge variant="secondary" className="mt-2">
                        {company.industry}
                      </Badge>
                    )}
                  </div>
                  
                  {company.website && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={company.website} target="_blank" rel="noopener noreferrer">
                        <Globe className="w-4 h-4 mr-2" />
                        Visit Website
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    </Button>
                  )}
                </div>

                <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
                  {company.location && (
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      <span>{company.location}</span>
                    </div>
                  )}
                  {company.employee_count && (
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>{company.employee_count} employees</span>
                    </div>
                  )}
                  {company.founded_year && (
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>Founded {company.founded_year}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {company.description && (
              <>
                <Separator className="my-6" />
                <div>
                  <h2 className="font-semibold text-foreground mb-2">About</h2>
                  <p className="text-muted-foreground whitespace-pre-wrap">{company.description}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Culture & Values */}
        {(company.culture || (company.values && company.values.length > 0)) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-primary" />
                Culture & Values
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {company.culture && (
                <div>
                  <h3 className="font-medium text-foreground mb-2 flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Our Culture
                  </h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">{company.culture}</p>
                </div>
              )}
              
              {company.values && company.values.length > 0 && (
                <div>
                  <h3 className="font-medium text-foreground mb-3">Our Values</h3>
                  <div className="flex flex-wrap gap-2">
                    {company.values.map((value, index) => (
                      <Badge key={index} variant="outline" className="text-sm py-1 px-3">
                        {value}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Open Jobs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" />
              Open Positions ({jobs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {jobs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No open positions at the moment.</p>
                <p className="text-sm">Check back later for new opportunities!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => (
                  <Link
                    key={job.id}
                    to={`/jobs?job=${job.id}`}
                    className="block p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-foreground truncate">{job.title}</h3>
                        <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                          {job.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {job.location}
                            </span>
                          )}
                          {job.employment_type && (
                            <Badge variant="secondary" className="text-xs">
                              {job.employment_type}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-sm shrink-0">
                        {formatSalary(job.salary_min, job.salary_max, job.currency) && (
                          <p className="font-medium text-foreground">
                            {formatSalary(job.salary_min, job.salary_max, job.currency)}
                          </p>
                        )}
                        <p className="text-muted-foreground text-xs mt-1">
                          Posted {formatDate(job.posted_at)}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
