import { useState, useEffect, useCallback } from 'react';
import { Search, Users, Briefcase, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatDisplayNameForViewer } from '@/lib/nameVisibility';

interface SearchResult {
  id: string;
  type: 'post' | 'person' | 'job';
  title: string;
  subtitle?: string;
}

export const SearchBar = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [myProfileId, setMyProfileId] = useState<string | null>(null);
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMyProfileId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('profiles').select('id').eq('user_id', user.id).single();
      if (data) {
        setMyProfileId(data.id);
        // Keep people I've blocked out of my own search results too -- my
        // own discovery experience, separate from the RLS-level rule that
        // stops a blocked person from finding me at all.
        const { data: blocked } = await supabase.from('blocked_users').select('blocked_user_id').eq('user_id', data.id);
        setBlockedIds((blocked || []).map((b) => b.blocked_user_id));
      }
    };
    fetchMyProfileId();
  }, []);

  const searchContent = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    const searchPattern = `%${searchQuery.toLowerCase()}%`;
    
    try {
      // Search posts
      const { data: posts } = await supabase
        .from('posts')
        .select('id, content, profiles!posts_profile_id_fkey(display_name)')
        .ilike('content', searchPattern)
        .limit(3);

      // Search people -- profile_discovery=false opts a profile out of
      // listing/search surfaces specifically (direct /profile/:id access is
      // unaffected, governed by profile_visibility alone).
      let peopleQuery = supabase
        .from('profiles')
        .select('id, display_name, profession, last_name_visibility')
        .eq('profile_discovery', true)
        .or(`display_name.ilike.${searchPattern},profession.ilike.${searchPattern}`);
      if (blockedIds.length > 0) {
        peopleQuery = peopleQuery.not('id', 'in', `(${blockedIds.join(',')})`);
      }
      const { data: people } = await peopleQuery.limit(3);

      // Batched, single query for which of these ≤3 results the viewer has
      // an accepted connection with -- needed for last_name_visibility's
      // 'connections_only' case. Cheap because `people` is capped at 3.
      const connectedIds = new Set<string>();
      if (myProfileId && people && people.length > 0) {
        const peopleIds = people.map((p) => p.id);
        const { data: conns } = await supabase
          .from('connections')
          .select('user_id, connection_id')
          .eq('status', 'accepted')
          .or(
            `and(user_id.eq.${myProfileId},connection_id.in.(${peopleIds.join(',')})),and(connection_id.eq.${myProfileId},user_id.in.(${peopleIds.join(',')}))`
          );
        (conns || []).forEach((c) => {
          connectedIds.add(c.user_id === myProfileId ? c.connection_id : c.user_id);
        });
      }

      // Search jobs
      const { data: jobs } = await supabase
        .from('jobs')
        .select('id, title, company_name, location')
        .or(`title.ilike.${searchPattern},company_name.ilike.${searchPattern}`)
        .limit(3);

      const combinedResults: SearchResult[] = [
        ...(posts || []).map(post => ({
          id: post.id,
          type: 'post' as const,
          title: post.content.substring(0, 60) + (post.content.length > 60 ? '...' : ''),
          subtitle: (post.profiles as any)?.display_name || 'Unknown',
        })),
        ...(people || []).map(person => ({
          id: person.id,
          type: 'person' as const,
          title: formatDisplayNameForViewer(person.display_name, {
            isOwner: person.id === myProfileId,
            visibility: person.last_name_visibility,
            isConnected: connectedIds.has(person.id),
          }) || 'User',
          subtitle: person.profession || 'No profession',
        })),
        ...(jobs || []).map(job => ({
          id: job.id,
          type: 'job' as const,
          title: job.title,
          subtitle: `${job.company_name || 'Company'} • ${job.location || 'Location'}`,
        })),
      ];

      setResults(combinedResults);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [myProfileId, blockedIds]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (query) {
        searchContent(query);
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [query, searchContent]);

  const handleSelect = (result: SearchResult) => {
    setQuery(result.title);
    setOpen(false);
    
    // Navigate based on type
    if (result.type === 'person') {
      navigate(`/profile/${result.id}`);
    } else if (result.type === 'job') {
      navigate('/jobs');
    } else if (result.type === 'post') {
      navigate('/dashboard');
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'person':
        return <Users className="h-4 w-4" />;
      case 'job':
        return <Briefcase className="h-4 w-4" />;
      case 'post':
        return <FileText className="h-4 w-4" />;
      default:
        return <Search className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'person':
        return 'People';
      case 'job':
        return 'Jobs';
      case 'post':
        return 'Posts';
      default:
        return '';
    }
  };

  // Group results by type
  const groupedResults = results.reduce((acc, result) => {
    const type = result.type;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  return (
    <Popover open={open && query.length > 0} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative w-full">
          <input
            className="nav-search-input"
            placeholder="Search posts, people, jobs..."
            aria-label="Search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => query.length > 0 && setOpen(true)}
          />
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[calc(100vw-2rem)] sm:w-[500px] p-0 bg-popover border border-border shadow-elegant" 
        align="start"
        sideOffset={8}
      >
        <Command className="bg-transparent">
          <CommandList className="max-h-[300px]">
            {loading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Searching...
              </div>
            ) : results.length === 0 ? (
              <CommandEmpty>No results found.</CommandEmpty>
            ) : (
              Object.entries(groupedResults).map(([type, items]) => (
                <CommandGroup 
                  key={type} 
                  heading={getTypeLabel(type)}
                  className="[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2"
                >
                  {items.map((result) => (
                    <CommandItem
                      key={result.id}
                      value={result.title}
                      onSelect={() => handleSelect(result)}
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-secondary/50 aria-selected:bg-secondary"
                    >
                      <div className="flex-shrink-0 text-muted-foreground">
                        {getIcon(result.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate text-foreground">
                          {result.title}
                        </div>
                        {result.subtitle && (
                          <div className="text-xs text-muted-foreground truncate">
                            {result.subtitle}
                          </div>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
