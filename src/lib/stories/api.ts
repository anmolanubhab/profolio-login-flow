import { supabase } from '@/integrations/supabase/client';
import { secureUpload } from '@/lib/secure-upload';
import { backgroundById } from './constants';
import type {
  MusicTrack,
  StoryAuthorGroup,
  StoryDraft,
  StoryMusic,
  StoryOverlay,
  StoryPrivacy,
  StoryRecord,
} from './types';

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------
/* eslint-disable @typescript-eslint/no-explicit-any */
function mapRow(row: any): StoryRecord {
  return {
    id: row.id,
    user_id: row.user_id,
    kind: row.kind === 'text' ? 'text' : 'media',
    privacy: (row.privacy ?? 'public') as StoryPrivacy,
    media_url: row.media_url ?? null,
    media_type: row.media_type ?? null,
    media_width: row.media_width ?? null,
    media_height: row.media_height ?? null,
    thumbnail_url: row.thumbnail_url ?? null,
    duration_ms: row.duration_ms ?? null,
    trim: row.trim && typeof row.trim === 'object' ? row.trim : null,
    background: typeof row.background === 'string'
      ? backgroundById(row.background)
      : (row.background ?? null),
    font_style: row.font_style ?? null,
    caption: row.caption ?? null,
    overlays: Array.isArray(row.overlays) ? (row.overlays as StoryOverlay[]) : [],
    music: (row.music ?? null) as StoryMusic | null,
    alt_text: row.alt_text ?? null,
    alt_text_source: row.alt_text_source === 'custom' ? 'custom' : 'auto',
    ai_label: !!row.ai_label,
    is_archived: !!row.is_archived,
    created_at: row.created_at ?? new Date().toISOString(),
    expires_at: row.expires_at ?? new Date().toISOString(),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------
export async function getAuthUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getMyProfileId(userId: string): Promise<string | null> {
  const { data } = await supabase.from('profiles').select('id').eq('user_id', userId).maybeSingle();
  return data?.id ?? null;
}

// ---------------------------------------------------------------------------
// Grouping — shared by the tray and the viewer. RLS already enforces the
// audience rules, so anything that comes back here is something the caller
// is allowed to see.
// ---------------------------------------------------------------------------
export async function fetchActiveStoryGroups(userId: string): Promise<StoryAuthorGroup[]> {
  const [{ data: mutedRows }, { data: storyRows, error }] = await Promise.all([
    supabase.from('muted_story_authors').select('muted_user_id').eq('user_id', userId),
    supabase
      .from('stories')
      .select('*')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true }),
  ]);
  if (error) throw error;

  const muted = new Set((mutedRows ?? []).map((m) => m.muted_user_id));
  const rows = (storyRows ?? [])
    .map(mapRow)
    .filter((s) => s.user_id === userId || !muted.has(s.user_id));

  const authorIds = [...new Set(rows.map((s) => s.user_id))];
  const profileMap = new Map<string, { display_name: string | null; avatar_url: string | null }>();
  if (authorIds.length) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('user_id, display_name, avatar_url')
      .in('user_id', authorIds);
    (profs ?? []).forEach((p) => profileMap.set(p.user_id, { display_name: p.display_name, avatar_url: p.avatar_url }));
  }

  const groups = new Map<string, StoryAuthorGroup>();
  for (const s of rows) {
    if (!groups.has(s.user_id)) {
      groups.set(s.user_id, {
        userId: s.user_id,
        profile: profileMap.get(s.user_id) ?? null,
        stories: [],
        isSelf: s.user_id === userId,
      });
    }
    groups.get(s.user_id)!.stories.push(s);
  }

  return [...groups.values()].sort((a, b) => {
    if (a.isSelf) return -1;
    if (b.isSelf) return 1;
    const am = Math.max(...a.stories.map((s) => +new Date(s.created_at)));
    const bm = Math.max(...b.stories.map((s) => +new Date(s.created_at)));
    return bm - am;
  });
}

/** Direct fetch of a single story (used for archived/expired stories the
 *  owner can still open — RLS lets the owner read their own expired rows). */
export async function fetchStoryById(storyId: string): Promise<StoryRecord | null> {
  const { data, error } = await supabase.from('stories').select('*').eq('id', storyId).maybeSingle();
  if (error || !data) return null;
  return mapRow(data);
}

export async function fetchAuthorProfile(userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('user_id', userId)
    .maybeSingle();
  return data ?? null;
}

/** Unfollow a story author (followers graph keys on profiles.id). */
export async function unfollowAuthor(userId: string, authorUserId: string) {
  const [myProfileId, authorProfileId] = await Promise.all([
    getMyProfileId(userId),
    getMyProfileId(authorUserId),
  ]);
  if (!myProfileId || !authorProfileId) return;
  const { error } = await supabase
    .from('followers')
    .delete()
    .eq('follower_id', myProfileId)
    .eq('following_id', authorProfileId);
  if (error) throw error;
}

export async function fetchArchivedStories(userId: string): Promise<StoryRecord[]> {
  const { data, error } = await supabase
    .from('stories')
    .select('*')
    .eq('user_id', userId)
    .eq('is_archived', true)
    .lt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------
export async function createStory(draft: StoryDraft, userId: string): Promise<StoryRecord> {
  const { data: settings } = await supabase
    .from('story_settings')
    .select('archive_enabled')
    .eq('user_id', userId)
    .maybeSingle();
  const archiveEnabled = !!settings?.archive_enabled;

  let mediaUrl: string | null = null;
  let thumbnailUrl: string | null = null;

  if (draft.kind === 'media' && draft.mediaBlob) {
    const ext = draft.mediaType === 'video' ? 'mp4' : 'jpg';
    const mediaFile = new File([draft.mediaBlob], `story-${Date.now()}.${ext}`, {
      type: draft.mediaBlob.type || (draft.mediaType === 'video' ? 'video/mp4' : 'image/jpeg'),
    });
    const up = await secureUpload({
      bucket: 'stories',
      file: mediaFile,
      userId,
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime'],
      maxSize: 60 * 1024 * 1024,
    });
    if (!up.success || !up.url) throw new Error(up.error || 'Media upload failed');
    mediaUrl = up.url;

    if (draft.thumbnailBlob) {
      const thumbFile = new File([draft.thumbnailBlob], `story-thumb-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const thumbUp = await secureUpload({
        bucket: 'stories', file: thumbFile, userId,
        allowedTypes: ['image/jpeg'], maxSize: 5 * 1024 * 1024,
      });
      if (thumbUp.success && thumbUp.url) thumbnailUrl = thumbUp.url;
    }
  }

  const insertPayload = {
    user_id: userId,
    kind: draft.kind,
    privacy: draft.privacy,
    media_url: mediaUrl,
    media_type: draft.kind === 'media' ? draft.mediaType : null,
    media_width: draft.mediaWidth,
    media_height: draft.mediaHeight,
    thumbnail_url: thumbnailUrl,
    duration_ms: draft.durationMs,
    trim: draft.trim as unknown as never,
    background: draft.background as unknown as never,
    font_style: draft.fontStyle,
    caption: draft.caption,
    overlays: draft.overlays as unknown as never,
    music: draft.music as unknown as never,
    alt_text: draft.altTextSource === 'custom' ? draft.altText : null,
    alt_text_source: draft.altTextSource,
    ai_label: draft.aiLabel,
    is_archived: archiveEnabled,
  };

  const { data, error } = await supabase.from('stories').insert(insertPayload).select('*').single();
  if (error) {
    // best-effort cleanup of the just-uploaded object
    if (mediaUrl) await removeStorageObject(mediaUrl);
    if (thumbnailUrl) await removeStorageObject(thumbnailUrl);
    throw error;
  }

  if (draft.privacy === 'custom' && draft.customAudienceUserIds.length) {
    await supabase.from('story_audience').insert(
      draft.customAudienceUserIds.map((viewer_user_id) => ({ story_id: data.id, viewer_user_id })),
    );
  }

  return mapRow(data);
}

function storagePathFromPublicUrl(url: string): string | null {
  const marker = '/storage/v1/object/public/stories/';
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}

export async function removeStorageObject(publicUrl: string) {
  const path = storagePathFromPublicUrl(publicUrl);
  if (!path) return;
  await supabase.storage.from('stories').remove([path]).catch(() => {});
}

// ---------------------------------------------------------------------------
// Mutations on an existing story
// ---------------------------------------------------------------------------
export async function deleteStory(story: StoryRecord) {
  const { error } = await supabase.from('stories').delete().eq('id', story.id);
  if (error) throw error;
  if (story.media_url) await removeStorageObject(story.media_url);
  if (story.thumbnail_url) await removeStorageObject(story.thumbnail_url);
}

export async function saveStoryToArchive(storyId: string, archived: boolean) {
  const { error } = await supabase.from('stories').update({ is_archived: archived }).eq('id', storyId);
  if (error) throw error;
}

export async function updateStoryAltText(storyId: string, altText: string | null) {
  const { error } = await supabase
    .from('stories')
    .update({ alt_text: altText, alt_text_source: altText ? 'custom' : 'auto' })
    .eq('id', storyId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Views + reactions
// ---------------------------------------------------------------------------
export async function recordStoryView(storyId: string, viewerId: string) {
  await supabase.from('story_views').insert({ story_id: storyId, viewer_id: viewerId });
}

export async function fetchMyViewsAndReactions(storyIds: string[], userId: string) {
  if (!storyIds.length) return { seen: new Set<string>(), reactions: new Map<string, string>() };
  const [{ data: views }, { data: reacts }] = await Promise.all([
    supabase.from('story_views').select('story_id').eq('viewer_id', userId).in('story_id', storyIds),
    supabase.from('story_reactions').select('story_id, reaction_type').eq('user_id', userId).in('story_id', storyIds),
  ]);
  return {
    seen: new Set((views ?? []).map((v) => v.story_id as string)),
    reactions: new Map((reacts ?? []).map((r) => [r.story_id as string, r.reaction_type as string])),
  };
}

export async function setStoryReaction(storyId: string, userId: string, type: string | null) {
  if (type === null) {
    const { error } = await supabase.from('story_reactions').delete().eq('story_id', storyId).eq('user_id', userId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from('story_reactions')
    .upsert({ story_id: storyId, user_id: userId, reaction_type: type }, { onConflict: 'story_id,user_id' });
  if (error) throw error;
}

export interface SeenByViewer {
  viewerId: string;
  viewedAt: string;
  name: string;
  avatarUrl: string | null;
  reaction: string | null;
}

export async function fetchSeenBy(storyId: string): Promise<SeenByViewer[]> {
  const { data: views } = await supabase
    .from('story_views')
    .select('viewer_id, viewed_at')
    .eq('story_id', storyId)
    .order('viewed_at', { ascending: false });
  const viewerIds = [...new Set((views ?? []).map((v) => v.viewer_id).filter(Boolean) as string[])];
  if (!viewerIds.length) return [];
  const [{ data: profs }, { data: reacts }] = await Promise.all([
    supabase.from('profiles').select('user_id, display_name, avatar_url').in('user_id', viewerIds),
    supabase.from('story_reactions').select('user_id, reaction_type').eq('story_id', storyId),
  ]);
  const pmap = new Map((profs ?? []).map((p) => [p.user_id, p]));
  const rmap = new Map((reacts ?? []).map((r) => [r.user_id, r.reaction_type as string]));
  return (views ?? []).map((v) => ({
    viewerId: v.viewer_id as string,
    viewedAt: v.viewed_at as string,
    name: pmap.get(v.viewer_id as string)?.display_name ?? 'Someone',
    avatarUrl: pmap.get(v.viewer_id as string)?.avatar_url ?? null,
    reaction: rmap.get(v.viewer_id as string) ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Report / mute
// ---------------------------------------------------------------------------
export async function reportStory(storyId: string, reporterId: string, reason: string, description: string | null) {
  const { error } = await supabase
    .from('story_reports')
    .insert({ story_id: storyId, reporter_id: reporterId, reason, description });
  if (error && error.code !== '23505') throw error;
}

export async function muteAuthor(userId: string, mutedUserId: string) {
  const { error } = await supabase.from('muted_story_authors').insert({ user_id: userId, muted_user_id: mutedUserId });
  if (error && error.code !== '23505') throw error;
}

export async function unmuteAuthor(userId: string, mutedUserId: string) {
  const { error } = await supabase
    .from('muted_story_authors')
    .delete()
    .eq('user_id', userId)
    .eq('muted_user_id', mutedUserId);
  if (error) throw error;
}

export async function fetchMutedAuthors(userId: string) {
  const { data } = await supabase.from('muted_story_authors').select('muted_user_id').eq('user_id', userId);
  const ids = (data ?? []).map((m) => m.muted_user_id);
  if (!ids.length) return [] as { userId: string; name: string; avatarUrl: string | null }[];
  const { data: profs } = await supabase
    .from('profiles')
    .select('user_id, display_name, avatar_url')
    .in('user_id', ids);
  return (profs ?? []).map((p) => ({
    userId: p.user_id,
    name: p.display_name ?? 'User',
    avatarUrl: p.avatar_url ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Reply — reuses the DM system, with a structured story_id pointer.
// ---------------------------------------------------------------------------
export async function sendStoryReply(params: {
  senderId: string;
  authorId: string;
  storyId: string;
  text: string;
  sticker?: { id: string; label: string } | null;
}) {
  const { senderId, authorId, storyId, text, sticker } = params;
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .or(
      `and(participant_1.eq.${senderId},participant_2.eq.${authorId}),and(participant_1.eq.${authorId},participant_2.eq.${senderId})`,
    )
    .maybeSingle();

  let conversationId = existing?.id;
  if (!conversationId) {
    const { data: created, error } = await supabase
      .from('conversations')
      .insert({ participant_1: senderId, participant_2: authorId })
      .select('id')
      .single();
    if (error) throw error;
    conversationId = created.id;
  }

  const { error: msgErr } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: senderId,
    content: sticker ? `[Sticker] ${sticker.label}` : text,
    message_type: sticker ? 'sticker' : 'text',
    metadata: sticker ? { sticker_id: sticker.id, story_id: storyId } : { story_id: storyId },
    story_id: storyId,
  });
  if (msgErr) throw msgErr;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
export interface StorySettings {
  defaultPrivacy: StoryPrivacy;
  archiveEnabled: boolean;
}

export async function fetchStorySettings(userId: string): Promise<StorySettings> {
  const { data } = await supabase
    .from('story_settings')
    .select('default_privacy, archive_enabled')
    .eq('user_id', userId)
    .maybeSingle();
  return {
    defaultPrivacy: (data?.default_privacy ?? 'public') as StoryPrivacy,
    archiveEnabled: !!data?.archive_enabled,
  };
}

export async function upsertStorySettings(userId: string, patch: Partial<StorySettings>) {
  const row = {
    user_id: userId,
    updated_at: new Date().toISOString(),
    ...(patch.defaultPrivacy !== undefined ? { default_privacy: patch.defaultPrivacy } : {}),
    ...(patch.archiveEnabled !== undefined ? { archive_enabled: patch.archiveEnabled } : {}),
  };
  const { error } = await supabase.from('story_settings').upsert(row, { onConflict: 'user_id' });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Custom audience — connections the composer can pick from.
// ---------------------------------------------------------------------------
export interface AudienceCandidate {
  userId: string;
  name: string;
  avatarUrl: string | null;
}

export async function fetchConnectionCandidates(userId: string): Promise<AudienceCandidate[]> {
  const myProfileId = await getMyProfileId(userId);
  if (!myProfileId) return [];
  const { data: cons } = await supabase
    .from('connections')
    .select('user_id, connection_id, status')
    .eq('status', 'accepted')
    .or(`user_id.eq.${myProfileId},connection_id.eq.${myProfileId}`);
  const otherProfileIds = [
    ...new Set(
      (cons ?? []).map((c) => (c.user_id === myProfileId ? c.connection_id : c.user_id)),
    ),
  ];
  if (!otherProfileIds.length) return [];
  const { data: profs } = await supabase
    .from('profiles')
    .select('id, user_id, display_name, avatar_url')
    .in('id', otherProfileIds);
  return (profs ?? []).map((p) => ({
    userId: p.user_id,
    name: p.display_name ?? 'User',
    avatarUrl: p.avatar_url ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Music
// ---------------------------------------------------------------------------
export async function fetchMusicCatalog(): Promise<MusicTrack[]> {
  const { data, error } = await supabase
    .from('story_music_tracks')
    .select('id, title, artist, audio_url, duration_ms, cover_color, genre')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as MusicTrack[];
}

export async function fetchSavedMusicIds(userId: string): Promise<Set<string>> {
  const { data } = await supabase.from('story_saved_music').select('track_id').eq('user_id', userId);
  return new Set((data ?? []).map((r) => r.track_id as string));
}

export async function toggleSavedMusic(userId: string, trackId: string, save: boolean) {
  if (save) {
    const { error } = await supabase.from('story_saved_music').insert({ user_id: userId, track_id: trackId });
    if (error && error.code !== '23505') throw error;
  } else {
    const { error } = await supabase
      .from('story_saved_music')
      .delete()
      .eq('user_id', userId)
      .eq('track_id', trackId);
    if (error) throw error;
  }
}
