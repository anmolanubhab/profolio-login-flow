-- Add visibility-related columns to profiles, if they don't already exist
alter table public.profiles add column if not exists profile_view_visibility text default 'public';
alter table public.profiles add column if not exists email_visibility text default 'only_me';
alter table public.profiles add column if not exists connections_visibility text default 'connections';
alter table public.profiles add column if not exists following_visibility text default 'anyone';
alter table public.profiles add column if not exists lastname_visibility text default 'connections';
alter table public.profiles add column if not exists discovery_by_email boolean default true;
alter table public.profiles add column if not exists discovery_by_phone boolean default true;
alter table public.profiles add column if not exists active_status_visibility text default 'connections';
alter table public.profiles add column if not exists notify_job_changes boolean default true;
alter table public.profiles add column if not exists notify_news boolean default true;
alter table public.profiles add column if not exists allow_mentions boolean default true;
alter table public.profiles add column if not exists allow_followers boolean default true;
alter table public.profiles add column if not exists follower_visibility text default 'everyone';

comment on column public.profiles.profile_view_visibility is 'Who can see full profile: public | connections | private';
comment on column public.profiles.email_visibility is 'Who can see or download email: only_me | connections | public';
comment on column public.profiles.connections_visibility is 'Who can see your connections: only_me | connections | public';
comment on column public.profiles.following_visibility is 'Who can see members you follow: only_me | connections | anyone';
comment on column public.profiles.lastname_visibility is 'Who can see your last name: only_me | connections | public';
comment on column public.profiles.discovery_by_email is 'Allow discovery using email';
comment on column public.profiles.discovery_by_phone is 'Allow discovery using phone number';
comment on column public.profiles.active_status_visibility is 'Show active status to: no_one | connections | everyone';
comment on column public.profiles.notify_job_changes is 'Notify connections on job changes';
comment on column public.profiles.notify_news is 'Notify connections when in news';
comment on column public.profiles.allow_mentions is 'Allow others to mention you';
comment on column public.profiles.allow_followers is 'Allow others to follow you';
comment on column public.profiles.follower_visibility is 'Follower restriction: everyone | connections';
