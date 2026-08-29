import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Briefcase, Image as ImageIcon, PenSquare, Video } from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { supabase } from '@/integrations/supabase/client';
import type { LucideIcon } from 'lucide-react';

interface MobileCreateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CreateAction {
  icon: LucideIcon;
  label: string;
  description: string;
  to: string;
}

/**
 * Bottom sheet opened by the mobile Create FAB. Every action routes into an
 * existing Profolio flow -- the full composer at /add-post (with a `compose`
 * hint for photo / video / poll) and the existing Post-a-Job dialog on /jobs.
 * No new creation surfaces.
 */
export function MobileCreateSheet({ open, onOpenChange }: MobileCreateSheetProps) {
  const navigate = useNavigate();
  const [canPostJob, setCanPostJob] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      if (!profile) return;
      // Same rule the Jobs page uses to show "Post a Job": you own a company.
      const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('owner_id', profile.id)
        .maybeSingle();
      if (!cancelled) setCanPostJob(!!company);
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const actions: CreateAction[] = [
    {
      icon: PenSquare,
      label: 'Write a post',
      description: 'Share an update, idea, or achievement',
      to: '/add-post',
    },
    {
      icon: ImageIcon,
      label: 'Photo',
      description: 'Post one or more photos',
      to: '/add-post?compose=photo',
    },
    {
      icon: Video,
      label: 'Video',
      description: 'Share a video with your network',
      to: '/add-post?compose=video',
    },
    {
      icon: BarChart3,
      label: 'Poll',
      description: 'Ask your network a question',
      to: '/add-post?compose=poll',
    },
    ...(canPostJob
      ? [
          {
            icon: Briefcase,
            label: 'Post a job',
            description: 'Open a role for your company',
            to: '/jobs?post=1',
          } as CreateAction,
        ]
      : []),
  ];

  const handleSelect = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rounded-t-2xl pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <DrawerHeader className="pb-2 text-left">
          <DrawerTitle>Create</DrawerTitle>
          <DrawerDescription>Choose what you want to share.</DrawerDescription>
        </DrawerHeader>

        <div className="px-2 pb-2">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => handleSelect(action.to)}
              className="flex w-full items-center gap-4 rounded-xl px-3 py-3 text-left transition-colors hover:bg-muted active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
                <action.icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block font-medium text-foreground">{action.label}</span>
                <span className="block truncate text-sm text-muted-foreground">
                  {action.description}
                </span>
              </span>
            </button>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
