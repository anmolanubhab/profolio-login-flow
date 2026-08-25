import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  ChevronLeft,
  Search,
  MapPin,
  Sparkles,
  Users,
  AlertTriangle,
  ShieldOff,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface CandidateResult {
  profile_id: string;
  full_name: string | null;
  headline: string | null;
  location: string | null;
  years_experience: number | null;
  skills: string[] | null;
  open_to_work: boolean;
}

type PageState = 'loading' | 'unauthorized' | 'ready' | 'error';

export default function CandidateSearch() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(null);
  const [pageState, setPageState] = useState<PageState>('loading');
  const [companyName, setCompanyName] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [skillsInput, setSkillsInput] = useState('');

  const [results, setResults] = useState<CandidateResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const runSearch = useCallback(async () => {
    if (!companyId) return;
    setSearching(true);
    setSearchError(null);
    try {
      const skills = skillsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const { data, error } = await supabase.rpc('search_candidates', {
        p_company_id: companyId,
        p_query: query.trim() || null,
        p_location: location.trim() || null,
        p_required_skills: skills.length > 0 ? skills : null,
      });

      if (error) {
        setSearchError("Unable to search candidates right now. Please try again.");
        setResults([]);
        return;
      }

      setResults((data as CandidateResult[]) || []);
      setHasSearched(true);
    } catch {
      setSearchError('Unable to search candidates right now. Please try again.');
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [companyId, query, location, skillsInput]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      if (!companyId) {
        navigate('/companies');
        return;
      }

      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        navigate('/');
        return;
      }
      if (cancelled) return;
      setUser(currentUser);

      // Company context comes only from the URL -- there is no arbitrary
      // client-chosen company. The RPC independently re-verifies this same
      // authorization; this check only decides what the page shows.
      const [{ data: authorized }, { data: company }] = await Promise.all([
        supabase.rpc('is_authorized_search_recruiter', { _company_id: companyId }),
        supabase.from('companies').select('name').eq('id', companyId).maybeSingle(),
      ]);

      if (cancelled) return;
      setCompanyName(company?.name ?? null);

      if (!authorized) {
        setPageState('unauthorized');
        return;
      }

      setPageState('ready');
    };

    init();
    // Switching companies (a different :companyId) must clear any prior
    // results and re-evaluate authorization from scratch -- never carry a
    // previous company's candidates over.
    setResults([]);
    setHasSearched(false);
    setQuery('');
    setLocation('');
    setSkillsInput('');

    return () => {
      cancelled = true;
    };
  }, [companyId, navigate]);

  // Debounced text search -- mirrors the existing SearchBar convention.
  useEffect(() => {
    if (pageState !== 'ready') return;
    const debounce = setTimeout(() => {
      runSearch();
    }, 350);
    return () => clearTimeout(debounce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageState, query, location, skillsInput]);

  const handleBack = () => navigate(`/company/${companyId}`);

  if (pageState === 'loading') {
    return (
      <Layout user={user} fullWidth>
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  if (pageState === 'unauthorized') {
    return (
      <Layout user={user} fullWidth>
        <div className="w-full max-w-2xl mx-auto py-16 px-4 text-center">
          <ShieldOff className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">No recruiter access</h1>
          <p className="text-muted-foreground mb-6">
            You don't have recruiter access for this company.
          </p>
          <Button variant="outline" onClick={handleBack}>Back to company</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} fullWidth>
      <div className="w-full max-w-3xl mx-auto px-2 sm:px-0">
        <div className="flex items-center gap-2 py-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleBack} aria-label="Back to company">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-foreground">Find Candidates</h1>
            {companyName && <p className="text-xs text-muted-foreground truncate">{companyName}</p>}
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Search profiles from people who have allowed recruiters to discover them.
        </p>

        <Card className="bg-card shadow-card border-0 mb-4">
          <CardContent className="p-4 sm:p-5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5 sm:col-span-1">
                <Label htmlFor="candidate-query">Search</Label>
                <Input
                  id="candidate-query"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Name, headline, skills…"
                  icon={<Search className="h-4 w-4" />}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="candidate-location">Location</Label>
                <Input
                  id="candidate-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Bangalore"
                  icon={<MapPin className="h-4 w-4" />}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="candidate-skills">Skills</Label>
                <Input
                  id="candidate-skills"
                  value={skillsInput}
                  onChange={(e) => setSkillsInput(e.target.value)}
                  placeholder="Comma separated"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {searching && (
          <div className="py-10 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        )}

        {!searching && searchError && (
          <Card className="bg-card shadow-card border-0">
            <CardContent className="py-8 flex flex-col items-center text-center gap-3">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-muted-foreground">{searchError}</p>
              <Button variant="outline" onClick={runSearch}>Try again</Button>
            </CardContent>
          </Card>
        )}

        {!searching && !searchError && hasSearched && results.length === 0 && (
          <Card className="bg-card shadow-card border-0">
            <CardContent className="py-10 flex flex-col items-center text-center gap-2">
              <Users className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">No candidates found</p>
              <p className="text-xs text-muted-foreground">Try a different search or location.</p>
            </CardContent>
          </Card>
        )}

        {!searching && !searchError && !hasSearched && results.length === 0 && (
          <Card className="bg-card shadow-card border-0">
            <CardContent className="py-10 flex flex-col items-center text-center gap-2">
              <Search className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Search for candidates</p>
              <p className="text-xs text-muted-foreground">
                Use the search and filters above to find people who have allowed recruiters to discover them.
              </p>
            </CardContent>
          </Card>
        )}

        {!searching && !searchError && results.length > 0 && (
          <div className="space-y-2">
            {results.map((r) => (
              <Card key={r.profile_id} className="bg-card shadow-card border-0">
                <CardContent className="p-4 sm:p-5 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground truncate">{r.full_name || 'Profolio user'}</p>
                      {r.open_to_work && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/10 text-success text-[11px] font-semibold px-2 py-0.5 border border-success/20">
                          <Sparkles className="h-3 w-3" />
                          Open to work
                        </span>
                      )}
                    </div>
                    {r.headline && <p className="text-sm text-primary font-medium mt-0.5">{r.headline}</p>}
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {r.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {r.location}
                        </span>
                      )}
                      {typeof r.years_experience === 'number' && (
                        <span>{r.years_experience} yrs experience</span>
                      )}
                    </div>
                    {r.skills && r.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {r.skills.slice(0, 6).map((skill) => (
                          <Badge key={skill} variant="secondary" className="text-[10px] font-normal">
                            {skill}
                          </Badge>
                        ))}
                        {r.skills.length > 6 && (
                          <Badge variant="outline" className="text-[10px] font-normal">
                            +{r.skills.length - 6} more
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  <Button variant="outline" size="sm" className="shrink-0" asChild>
                    <Link to={`/company/${companyId}/candidates/${r.profile_id}`}>View profile</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
