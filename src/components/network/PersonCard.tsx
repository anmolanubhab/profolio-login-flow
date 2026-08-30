import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  mutualLabel,
  personInitial,
  personName,
  personSubtitle,
  type NetworkPerson,
} from '@/lib/network';

interface PersonCardProps {
  person: NetworkPerson;
  /** Action buttons rendered at the bottom of the card. */
  actions?: ReactNode;
  /** Optional element in the top-right corner (e.g. a dismiss button). */
  corner?: ReactNode;
  onOpenProfile?: (person: NetworkPerson) => void;
}

/** Grid card used in "Grow" / "People you may know". */
export function PersonCard({ person, actions, corner, onOpenProfile }: PersonCardProps) {
  const name = personName(person);
  const subtitle = personSubtitle(person);
  const mutual = mutualLabel(person.mutual_count);

  const handleOpen = (e: React.MouseEvent) => {
    if (onOpenProfile) {
      e.preventDefault();
      onOpenProfile(person);
    }
  };

  return (
    <Card className="relative flex flex-col border-0 bg-gradient-card shadow-card transition-smooth hover:shadow-elegant">
      {corner && <div className="absolute right-2 top-2 z-10">{corner}</div>}
      <CardContent className="flex flex-1 flex-col items-center px-4 pb-4 pt-6 text-center">
        <Link
          to={`/profile/${person.id}`}
          onClick={handleOpen}
          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={`Open ${name}'s profile`}
        >
          <Avatar className="h-20 w-20 border-4 border-background shadow-elegant">
            <AvatarImage src={person.avatar_url ?? undefined} alt="" />
            <AvatarFallback className="bg-primary text-lg font-bold text-primary-foreground">
              {personInitial(person)}
            </AvatarFallback>
          </Avatar>
        </Link>

        <div className="mt-3 w-full space-y-1">
          <Link
            to={`/profile/${person.id}`}
            onClick={handleOpen}
            className="block truncate text-base font-semibold text-foreground hover:underline"
          >
            {name}
          </Link>
          {subtitle && (
            <p className="line-clamp-2 text-sm text-muted-foreground">{subtitle}</p>
          )}
          {person.location && (
            <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{person.location}</span>
            </p>
          )}
          {mutual && (
            <p className="flex items-center justify-center gap-1 pt-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3 shrink-0" />
              {mutual}
            </p>
          )}
        </div>

        {actions && <div className="mt-4 w-full">{actions}</div>}
      </CardContent>
    </Card>
  );
}

interface PersonRowProps {
  person: NetworkPerson;
  actions?: ReactNode;
  /** Small muted line shown under the subtitle (e.g. "Connected 2 days ago"). */
  meta?: ReactNode;
  /** Optional invitation note, rendered as its own quoted block. */
  note?: string | null;
  onOpenProfile?: (person: NetworkPerson) => void;
}

/** Horizontal list row used in Invitations / Connections. */
export function PersonRow({ person, actions, meta, note, onOpenProfile }: PersonRowProps) {
  const name = personName(person);
  const subtitle = personSubtitle(person);
  const mutual = mutualLabel(person.mutual_count);

  const handleOpen = (e: React.MouseEvent) => {
    if (onOpenProfile) {
      e.preventDefault();
      onOpenProfile(person);
    }
  };

  return (
    <div className="flex items-center gap-3 py-3">
      <Link
        to={`/profile/${person.id}`}
        onClick={handleOpen}
        className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={`Open ${name}'s profile`}
      >
        <Avatar className="h-14 w-14">
          <AvatarImage src={person.avatar_url ?? undefined} alt="" />
          <AvatarFallback className="bg-primary font-bold text-primary-foreground">
            {personInitial(person)}
          </AvatarFallback>
        </Avatar>
      </Link>

      <div className="min-w-0 flex-1">
        <Link
          to={`/profile/${person.id}`}
          onClick={handleOpen}
          className="block truncate font-semibold text-foreground hover:underline"
        >
          {name}
        </Link>
        {subtitle && (
          <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
        )}
        {mutual && <p className="truncate text-xs text-muted-foreground">{mutual}</p>}
        {meta && <p className="truncate text-xs text-muted-foreground">{meta}</p>}
        {note && (
          <p className="mt-1 line-clamp-3 rounded-md bg-muted/60 px-2 py-1 text-xs italic text-foreground">
            “{note}”
          </p>
        )}
      </div>

      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PersonCardSkeleton() {
  return (
    <Card className="border-0 bg-gradient-card shadow-card">
      <CardContent className="flex flex-col items-center px-4 pb-4 pt-6">
        <Skeleton className="h-20 w-20 rounded-full" />
        <Skeleton className="mt-3 h-4 w-3/4" />
        <Skeleton className="mt-2 h-3 w-full" />
        <Skeleton className="mt-2 h-3 w-1/2" />
        <Skeleton className="mt-4 h-9 w-full rounded-md" />
      </CardContent>
    </Card>
  );
}

export function PersonRowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3">
      <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <Skeleton className="h-9 w-24 rounded-md" />
    </div>
  );
}
