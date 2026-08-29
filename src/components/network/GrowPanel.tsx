import { AlertCircle, Search, UserSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { PersonCard, PersonCardSkeleton } from './PersonCard';
import { ConnectButton } from './ConnectButton';
import { usePeopleSearch } from '@/hooks/network/usePeopleSearch';
import { useCurrentProfileId } from '@/hooks/network/useCurrentProfileId';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import type { NetworkPerson } from '@/lib/network';

interface GrowPanelProps {
  query: string;
  onQueryChange: (value: string) => void;
  onOpenProfile?: (person: NetworkPerson) => void;
}

export function GrowPanel({ query, onQueryChange, onOpenProfile }: GrowPanelProps) {
  const { data: myProfileId } = useCurrentProfileId();
  const debounced = useDebouncedValue(query.trim(), 300);
  const {
    people,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = usePeopleSearch(debounced);

  return (
    <Card className="border-0 bg-gradient-card shadow-card">
      <CardHeader className="gap-3 pb-3">
        <CardTitle className="text-lg">
          {debounced ? 'Search results' : 'People on Profolio'}
        </CardTitle>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search people by name, headline, or location…"
            className="pl-9"
            aria-label="Search people"
          />
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <PersonCardSkeleton key={i} />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            icon={AlertCircle}
            title="Couldn't load people"
            description="Check your connection and try again."
            action={
              <Button variant="outline" onClick={() => refetch()}>
                Retry
              </Button>
            }
          />
        ) : people.length === 0 ? (
          <EmptyState
            icon={UserSearch}
            title={debounced ? 'No people found' : 'Nobody to show yet'}
            description={
              debounced
                ? `No profiles match "${debounced}".`
                : 'Check back later as more people join.'
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {people.map((person) => (
                <PersonCard
                  key={person.id}
                  person={person}
                  onOpenProfile={onOpenProfile}
                  actions={
                    myProfileId ? (
                      <ConnectButton
                        person={person}
                        myProfileId={myProfileId}
                        relationship={person.relationship}
                        requestId={person.request_id}
                        className="w-full"
                      />
                    ) : null
                  }
                />
              ))}
            </div>

            {hasNextPage && (
              <div className="pt-4 text-center">
                <Button
                  variant="outline"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? 'Loading…' : 'Show more'}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
