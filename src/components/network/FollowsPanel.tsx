import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertCircle,
  Check,
  MoreHorizontal,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { useFollowsList, type FollowsKind } from '@/hooks/network/useFollowsList';
import { useFollowCounts } from '@/hooks/network/useFollowCounts';
import { personName, type NetworkPerson } from '@/lib/network';

interface FollowsPanelProps {
  sub: FollowsKind;
  onSubChange: (sub: FollowsKind) => void;
  onOpenProfile?: (person: NetworkPerson) => void;
}

function followedAgo(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  try {
    return `Followed ${formatDistanceToNow(new Date(iso))} ago`;
  } catch {
    return undefined;
  }
}

export function FollowsPanel({ sub, onSubChange, onOpenProfile }: FollowsPanelProps) {
  const { counts } = useFollowCounts();
  const {
    people,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isBusy,
    follow,
    unfollow,
  } = useFollowsList(sub, '');

  const [pendingUnfollow, setPendingUnfollow] = useState<NetworkPerson | null>(null);

  const total = sub === 'following' ? counts.following_count : counts.followers_count;
  const subheader =
    sub === 'following'
      ? total > 0
        ? `You're following ${total} ${total === 1 ? 'person' : 'people'}`
        : "You're not following anyone yet"
      : total > 0
        ? `${total} ${total === 1 ? 'follower' : 'followers'}`
        : "You don't have any followers yet";

  const renderActions = (person: NetworkPerson) => {
    const busy = isBusy(person.id);
    const iFollow = sub === 'following' ? true : !!person.i_follow_them;

    const primary = iFollow ? (
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => setPendingUnfollow(person)}
        className="shrink-0 rounded-full"
        aria-label={`Unfollow ${personName(person)}`}
      >
        <UserCheck className="h-4 w-4" />
        <span className="ml-1.5 hidden sm:inline">Following</span>
      </Button>
    ) : (
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => follow(person)}
        className="shrink-0 rounded-full text-primary hover:text-primary"
        aria-label={`Follow ${personName(person)} back`}
      >
        <UserPlus className="h-4 w-4" />
        <span className="ml-1.5 hidden sm:inline">Follow back</span>
      </Button>
    );

    return (
      <>
        {primary}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              disabled={busy}
              aria-label={`More actions for ${personName(person)}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onOpenProfile?.(person)}>
              View profile
            </DropdownMenuItem>
            {iFollow ? (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={(e) => {
                  e.preventDefault();
                  setPendingUnfollow(person);
                }}
              >
                Unfollow
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => follow(person)}>Follow back</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    );
  };

  return (
    <Card className="border-0 bg-gradient-card shadow-card">
      <CardHeader className="gap-3 pb-3">
        <Tabs value={sub} onValueChange={(v) => onSubChange(v as FollowsKind)}>
          <TabsList className="grid w-full max-w-sm grid-cols-2">
            <TabsTrigger value="following">Following</TabsTrigger>
            <TabsTrigger value="followers">Followers</TabsTrigger>
          </TabsList>
        </Tabs>
        <p className="text-sm text-muted-foreground">{subheader}</p>
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
            title={`Couldn't load ${sub}`}
            description="Check your connection and try again."
            action={
              <Button variant="outline" onClick={() => refetch()}>
                Retry
              </Button>
            }
          />
        ) : people.length === 0 ? (
          <EmptyState
            icon={sub === 'following' ? UserPlus : Users}
            title={sub === 'following' ? "You aren't following anyone yet" : 'No followers yet'}
            description={
              sub === 'following'
                ? 'Follow people from their profile or the feed to see their updates here.'
                : 'When people follow you, they’ll show up here.'
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-border">
              {people.map((person) => (
                <li key={person.id}>
                  <PersonRow
                    person={person}
                    onOpenProfile={onOpenProfile}
                    meta={
                      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                        {sub === 'following' && person.they_follow_me && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                            <Check className="h-3 w-3" /> Follows you
                          </span>
                        )}
                        {sub === 'followers' && person.i_follow_them && (
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            You follow back
                          </span>
                        )}
                        {followedAgo(person.followed_at) && (
                          <span className="hidden truncate text-[11px] text-muted-foreground sm:inline">
                            {followedAgo(person.followed_at)}
                          </span>
                        )}
                      </span>
                    }
                    actions={renderActions(person)}
                  />
                </li>
              ))}
            </ul>

            {hasNextPage && (
              <div className="pt-4 text-center">
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? 'Loading…' : 'Show more results'}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>

      <AlertDialog
        open={!!pendingUnfollow}
        onOpenChange={(open) => !open && setPendingUnfollow(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Unfollow {pendingUnfollow ? personName(pendingUnfollow) : 'this person'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You’ll stop seeing their posts in your feed. You can follow them again anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingUnfollow) unfollow(pendingUnfollow);
                setPendingUnfollow(null);
              }}
            >
              Unfollow
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
