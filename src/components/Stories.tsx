import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { StoryComposer } from '@/components/stories/StoryComposer';
import { fetchActiveStoryGroups, fetchStorySettings, getAuthUser } from '@/lib/stories/api';
import type { StoryAuthorGroup } from '@/lib/stories/types';

const Stories = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<StoryAuthorGroup[]>([]);
  const [me, setMe] = useState<{ id: string; name: string; avatar: string | null } | null>(null);
  const [defaultPrivacy, setDefaultPrivacy] = useState<'public' | 'friends' | 'custom'>('public');
  const [showComposer, setShowComposer] = useState(false);

  const load = useCallback(async () => {
    const user = await getAuthUser();
    if (!user) return;
    const [profileRes, settings] = await Promise.all([
      supabase.from('profiles').select('display_name, avatar_url').eq('user_id', user.id).maybeSingle(),
      fetchStorySettings(user.id),
    ]);
    setMe({
      id: user.id,
      name: profileRes.data?.display_name ?? 'You',
      avatar: profileRes.data?.avatar_url ?? null,
    });
    setDefaultPrivacy(settings.defaultPrivacy);
    try {
      setGroups(await fetchActiveStoryGroups(user.id));
    } catch (e) {
      console.error('Error fetching stories:', e);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const own = me ? groups.find((g) => g.userId === me.id) : undefined;
  const others = groups.filter((g) => g.userId !== me?.id);

  return (
    <>
      <div className="rounded-xl border border-border bg-card shadow-card overflow-x-auto">
        <div className="flex gap-2 sm:gap-2.5 p-3">
          <div className="relative shrink-0 w-[76px] h-[128px] sm:w-24 sm:h-[158px]">
            <button
              onClick={() => {
                if (own && own.stories.length > 0) navigate(`/story/${own.stories[own.stories.length - 1].id}`);
                else setShowComposer(true);
              }}
              className="relative h-full w-full rounded-xl overflow-hidden group"
            >
              {me?.avatar ? (
                <img src={me.avatar} alt="" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/60" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/0 to-black/10 group-hover:from-black/55 transition-colors" />
              {!(own && own.stories.length) && (
                <div className="absolute left-1/2 -translate-x-1/2 top-[64%] sm:top-[68%] w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-background border-2 border-card shadow-md flex items-center justify-center">
                  <Plus className="h-4 w-4 sm:h-5 sm:w-5 text-primary" strokeWidth={2.5} />
                </div>
              )}
              <div className="absolute bottom-0 inset-x-0 bg-card py-1.5 sm:py-2">
                <span className="text-[10px] sm:text-[12px] font-semibold text-foreground">
                  {own && own.stories.length ? 'Your Story' : 'Add Story'}
                </span>
              </div>
            </button>
            {own && own.stories.length > 0 && (
              <button
                onClick={() => setShowComposer(true)}
                aria-label="Add another story"
                className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-card"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
            )}
          </div>

          {others.map((g) => {
            const first = g.stories[0];
            return (
              <button
                key={g.userId}
                onClick={() => navigate(`/story/${first.id}`)}
                className="relative shrink-0 w-[76px] h-[128px] sm:w-24 sm:h-[158px] rounded-xl overflow-hidden group"
              >
                {first.kind === 'text' ? (
                  <div className="absolute inset-0" style={{ background: first.background?.css ?? '#1e293b' }} />
                ) : first.media_type === 'video' ? (
                  <video
                    src={first.media_url ?? undefined}
                    poster={first.thumbnail_url ?? undefined}
                    muted playsInline preload="metadata"
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                ) : (
                  <img
                    src={first.thumbnail_url ?? first.media_url ?? undefined}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/20" />
                <Avatar className="absolute top-2 left-2 h-7 w-7 sm:h-8 sm:w-8 ring-2 ring-primary">
                  <AvatarImage src={g.profile?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[10px]">{g.profile?.display_name?.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>
                <span className="absolute bottom-1.5 sm:bottom-2 inset-x-1.5 text-[10px] sm:text-[12px] font-semibold text-white text-left line-clamp-2 leading-tight drop-shadow">
                  {g.profile?.display_name || 'User'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {showComposer && me && (
        <StoryComposer
          userId={me.id}
          authorName={me.name}
          authorAvatar={me.avatar}
          defaultPrivacy={defaultPrivacy}
          onClose={() => setShowComposer(false)}
          onPublished={(id) => { setShowComposer(false); load().then(() => navigate(`/story/${id}`)); }}
        />
      )}
    </>
  );
};

export default Stories;
