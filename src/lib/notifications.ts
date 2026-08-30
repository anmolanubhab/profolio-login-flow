// Shared notification message/icon/link helpers -- previously duplicated
// near-verbatim between NotificationBell.tsx (the navbar dropdown) and
// Notifications.tsx (the full notifications page), which had drifted
// slightly out of sync (the page showed raw comment/message text, the
// dropdown didn't; the page recognized a 'certificate' type, the dropdown
// didn't). Consolidated here, keeping whichever behavior was more complete:
//   - comment / comment_reply: quote the actual comment text (from the page)
//   - message: show the actual message text (from the page)
//   - icon mapping: includes 'certificate' -> Award (from the page)
import {
  Bell,
  MessageCircle,
  UserPlus,
  Award,
  ThumbsUp,
  MessageSquare,
  Share2,
  Eye,
  Briefcase,
  Star,
  Repeat2,
  AtSign,
  Newspaper,
  type LucideIcon,
} from 'lucide-react';
import { REACTION_META, ReactionType } from '@/components/ReactionBar';
import { STAGE_LABELS, ApplicationStage } from '@/lib/applicationStages';

export interface NotificationPayload {
  sender_name?: string;
  sender_avatar?: string;
  message?: string;
  job_title?: string;
  post_id?: string;
  profile_id?: string;
  company_name?: string;
  location?: string;
  conversation_id?: string;
  connection_id?: string;
  skill_name?: string;
  endorser_id?: string;
  reactor_count?: number;
  latest_reaction_type?: ReactionType;
  reaction_type?: ReactionType;
  comment_id?: string;
  application_id?: string;
  from_stage?: ApplicationStage;
  to_stage?: ApplicationStage;
  candidate_name?: string;
  company_id?: string;
  insight_slug?: string;
  insight_title?: string;
  article_slug?: string;
  article_title?: string;
}

export interface NotificationLike {
  type: string;
  payload: NotificationPayload;
}

export const getNotificationIcon = (type: string): LucideIcon => {
  switch (type) {
    case 'like':
    case 'post_reaction':
    case 'comment_reaction':
      return ThumbsUp;
    case 'comment':
    case 'comment_reply':
      return MessageSquare;
    case 'comment_mention':
      return AtSign;
    case 'repost':
      return Repeat2;
    case 'share':
      return Share2;
    case 'connection_request':
    case 'connection_accepted':
      return UserPlus;
    case 'profile_view':
    case 'profile_save':
      return Eye;
    case 'new_job':
    case 'application_stage_changed':
    case 'job_application_received':
      return Briefcase;
    case 'message':
      return MessageCircle;
    case 'certificate':
      return Award;
    case 'skill_endorsement':
      return Star;
    case 'insight_published':
    case 'insight_new_subscriber':
      return Newspaper;
    default:
      return Bell;
  }
};

export const getNotificationMessage = (notification: NotificationLike): string => {
  const { type, payload } = notification;
  const senderName = payload?.sender_name || 'Someone';

  switch (type) {
    case 'like':
      return `${senderName} liked your post`;
    case 'post_reaction': {
      // Bundled: "Rahul celebrated your post." for the first reactor,
      // "5 people reacted to your post." once more people pile on -- never
      // one notification per reaction (see notify_post_reaction()).
      const count = payload?.reactor_count || 1;
      if (count > 1) {
        return `${count} people reacted to your post`;
      }
      const reactionType = payload?.latest_reaction_type;
      const verb = reactionType ? REACTION_META[reactionType].verb : 'reacted to';
      return `${senderName} ${verb} your post`;
    }
    case 'comment':
      return payload?.message ? `${senderName} commented: "${payload.message}"` : `${senderName} commented on your post`;
    case 'comment_reply':
      return payload?.message ? `${senderName} replied: "${payload.message}"` : `${senderName} replied to your comment`;
    case 'comment_reaction': {
      const rt = payload?.reaction_type;
      const verb = rt ? REACTION_META[rt].verb : 'reacted to';
      return `${senderName} ${verb} your comment`;
    }
    case 'comment_mention':
      return payload?.message
        ? `${senderName} mentioned you: "${payload.message}"`
        : `${senderName} mentioned you in a comment`;
    case 'repost':
      return payload?.message
        ? `${senderName} reposted your post: "${payload.message}"`
        : `${senderName} reposted your post`;
    case 'share':
      return `${senderName} shared your post`;
    case 'connection_request':
      return `${senderName} sent you a connection request`;
    case 'connection_accepted':
      return `${senderName} accepted your connection request`;
    case 'profile_view':
      return `${senderName} viewed your profile`;
    case 'profile_save':
      return `${senderName} saved your profile`;
    case 'new_job':
      return `New job posted: ${payload?.job_title || 'Check it out'}`;
    case 'job_application_received':
      return `${payload?.candidate_name || 'A candidate'} applied to ${payload?.job_title || 'your job posting'}`;
    case 'application_stage_changed': {
      const stageLabel = payload?.to_stage ? STAGE_LABELS[payload.to_stage] : 'updated';
      const jobPart = payload?.job_title ? `Your ${payload.job_title} application` : 'Your application';
      const companyPart = payload?.company_name ? ` at ${payload.company_name}` : '';
      return `${jobPart}${companyPart} is now "${stageLabel}"`;
    }
    case 'message':
      return payload?.message ? `${senderName}: ${payload.message}` : `${senderName} sent you a message`;
    case 'skill_endorsement':
      return `${senderName} endorsed your ${payload?.skill_name || 'skill'}`;
    case 'insight_published':
      return payload?.article_title
        ? `${senderName} published “${payload.article_title}” in ${payload?.insight_title || 'an Insight'}`
        : `${senderName} published a new Insight`;
    case 'insight_new_subscriber':
      return `${senderName} is now following ${payload?.insight_title || 'your Insight'}`;
    default:
      return payload?.message || 'New notification';
  }
};

export const getNotificationLink = (notification: NotificationLike): string => {
  const { type, payload } = notification;

  switch (type) {
    case 'like':
    case 'post_reaction':
    case 'comment':
    case 'comment_reply':
    case 'comment_reaction':
    case 'comment_mention':
    case 'repost':
    case 'share':
      return `/dashboard?post=${payload?.post_id}`;
    case 'connection_request':
    case 'connection_accepted':
      return '/notifications';
    case 'profile_view':
    case 'profile_save':
    case 'skill_endorsement':
      return '/profile';
    case 'new_job':
      return '/jobs';
    case 'application_stage_changed':
      return '/dashboard?tab=applications';
    case 'job_application_received':
      return payload?.company_id ? `/company/${payload.company_id}` : '/dashboard';
    case 'message':
      return '/connect';
    case 'insight_published':
      return payload?.insight_slug && payload?.article_slug
        ? `/insights/${payload.insight_slug}/${payload.article_slug}`
        : '/insights';
    case 'insight_new_subscriber':
      return payload?.insight_slug ? `/insights/${payload.insight_slug}` : '/insights';
    default:
      return '/notifications';
  }
};
