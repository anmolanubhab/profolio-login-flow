import { formatDistanceToNow } from 'date-fns';
import { AlertCircle, Check, Inbox, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { PersonRow, PersonRowSkeleton } from './PersonCard';
import { useInvitations } from '@/hooks/network/useInvitations';
import type { NetworkPerson } from '@/lib/network';

type Sub = 'received' | 'sent';

interface InvitationsPanelProps {
  sub: Sub;
  onSubChange: (sub: Sub) => void;
  onOpenProfile?: (person: NetworkPerson) => void;
}

function timeAgo(iso: string): string {
  try {
    return `${formatDistanceToNow(new Date(iso))} ago`;
  } catch {
    return '';
  }
}

export function InvitationsPanel({ sub, onSubChange, onOpenProfile }: InvitationsPanelProps) {
  const { received, sent, isLoading, isError, refetch, isBusy, accept, decline, withdraw } =
    useInvitations();

  return (
    <Card className="border-0 bg-gradient-card shadow-card">
      <CardHeader className="gap-3 pb-3">
        <CardTitle className="text-lg">Manage invitations</CardTitle>
        <Tabs value={sub} onValueChange={(v) => onSubChange(v as Sub)}>
          <TabsList className="grid w-full max-w-sm grid-cols-2">
            <TabsTrigger value="received">
              Received{received.length ? ` (${received.length})` : ''}
            </TabsTrigger>
            <TabsTrigger value="sent">
              Sent{sent.length ? ` (${sent.length})` : ''}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent className="pt-0">
        {isLoading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 4 }).map((_, i) => (
              <PersonRowSkeleton key={i} />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            icon={AlertCircle}
            title="Couldn't load invitations"
            description="Check your connection and try again."
            action={
              <Button variant="outline" onClick={() => refetch()}>
                Retry
              </Button>
            }
          />
        ) : sub === 'received' ? (
          received.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No pending invitations"
              description="When someone invites you to connect, it'll show up here."
            />
          ) : (
            <ul className="divide-y divide-border">
              {received.map((inv) => (
                <li key={inv.id}>
                  <PersonRow
                    person={inv.person}
                    onOpenProfile={onOpenProfile}
                    meta={timeAgo(inv.created_at)}
                    actions={
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isBusy(inv.id)}
                          onClick={() => decline(inv)}
                          aria-label="Ignore invitation"
                        >
                          <X className="h-4 w-4" />
                          <span className="ml-1 hidden sm:inline">Ignore</span>
                        </Button>
                        <Button
                          size="sm"
                          disabled={isBusy(inv.id)}
                          onClick={() => accept(inv)}
                          aria-label="Accept invitation"
                        >
                          <Check className="h-4 w-4" />
                          <span className="ml-1 hidden sm:inline">Accept</span>
                        </Button>
                      </>
                    }
                  />
                </li>
              ))}
            </ul>
          )
        ) : sent.length === 0 ? (
          <EmptyState
            icon={Send}
            title="No sent invitations"
            description="Invitations you send that are still pending will appear here."
          />
        ) : (
          <ul className="divide-y divide-border">
            {sent.map((inv) => (
              <li key={inv.id}>
                <PersonRow
                  person={inv.person}
                  onOpenProfile={onOpenProfile}
                  meta={`Sent ${timeAgo(inv.created_at)}`}
                  actions={
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isBusy(inv.id)}
                      onClick={() => withdraw(inv)}
                    >
                      Withdraw
                    </Button>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
