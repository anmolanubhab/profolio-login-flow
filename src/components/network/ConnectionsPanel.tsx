import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { AlertCircle, MessageSquare, MoreHorizontal, Search, UserMinus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PersonRow, PersonRowSkeleton } from './PersonCard';
import { useConnections } from '@/hooks/network/useConnections';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { personName, type NetworkPerson } from '@/lib/network';

interface ConnectionsPanelProps {
  query: string;
  onQueryChange: (value: string) => void;
  onOpenProfile?: (person: NetworkPerson) => void;
}

export function ConnectionsPanel({ query, onQueryChange, onOpenProfile }: ConnectionsPanelProps) {
  const navigate = useNavigate();
  const debounced = useDebouncedValue(query.trim(), 300);
  const [pendingRemoval, setPendingRemoval] = useState<NetworkPerson | null>(null);

  const {
    connections,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isRemoving,
    remove,
  } = useConnections(debounced);

  return (
    <Card className="border-0 bg-gradient-card shadow-card">
      <CardHeader className="gap-3 pb-3">
        <CardTitle className="text-lg">
          Connections{!isLoading && !debounced ? ` (${connections.length}${hasNextPage ? '+' : ''})` : ''}
        </CardTitle>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search by name, headline, or location…"
            className="pl-9"
            aria-label="Search connections"
          />
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {isLoading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <PersonRowSkeleton key={i} />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            icon={AlertCircle}
            title="Couldn't load connections"
            description="Check your connection and try again."
            action={
              <Button variant="outline" onClick={() => refetch()}>
                Retry
              </Button>
            }
          />
        ) : connections.length === 0 ? (
          <EmptyState
            icon={Users}
            title={debounced ? 'No matching connections' : 'No connections yet'}
            description={
              debounced
                ? 'Try a different name or keyword.'
                : 'Connections you make will appear here.'
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-border">
              {connections.map((person) => (
                <li key={person.id}>
                  <PersonRow
                    person={person}
                    onOpenProfile={onOpenProfile}
                    meta={
                      person.connected_at
                        ? `Connected ${formatDistanceToNow(new Date(person.connected_at))} ago`
                        : undefined
                    }
                    actions={
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate('/connect')}
                        >
                          <MessageSquare className="h-4 w-4" />
                          <span className="ml-1 hidden sm:inline">Message</span>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={isRemoving(person.id)}
                              aria-label={`More actions for ${personName(person)}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onSelect={(e) => {
                                e.preventDefault();
                                setPendingRemoval(person);
                              }}
                            >
                              <UserMinus className="mr-2 h-4 w-4" />
                              Remove connection
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    }
                  />
                </li>
              ))}
            </ul>

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

      <AlertDialog
        open={!!pendingRemoval}
        onOpenChange={(open) => !open && setPendingRemoval(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {pendingRemoval ? personName(pendingRemoval) : 'connection'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You'll no longer be connected. You can send a new invitation later if you
              change your mind.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingRemoval) remove(pendingRemoval);
                setPendingRemoval(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
