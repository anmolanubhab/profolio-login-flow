-- Phase 6B — Poll duration + expiration + server-side vote hardening.
--
-- Additive only. Existing polls have expires_at = NULL and stay open forever
-- (unchanged behaviour). Does NOT touch Phase 1-5 job matching or the frozen
-- Phase 5 email infrastructure.
--
-- Existing schema already provides: polls(post_id UNIQUE, question),
-- poll_options(poll_id, option_text, position), poll_votes(poll_id, option_id,
-- user_id) with UNIQUE(poll_id, user_id) [one vote per user], every FK
-- ON DELETE CASCADE [clean deletion], public SELECT + owner-only INSERT RLS,
-- and NO update/delete policy on poll_votes [votes are immutable]. This
-- migration adds the missing pieces: a real expiration timestamp, length
-- guards, and a BEFORE INSERT guard so a client that bypasses the UI still
-- cannot vote on an ended poll or for an option from another poll.

-- ------------------------------------------------------------ polls.expires_at
alter table public.polls add column if not exists expires_at timestamptz;
comment on column public.polls.expires_at is
  'Poll close time. NULL = never expires. Enforced server-side on vote insert.';

create index if not exists idx_polls_expires_at
  on public.polls (expires_at) where expires_at is not null;

-- ------------------------------------------------------------ length guards
-- NOT VALID: applies to new/changed rows only, existing rows are left as-is.
alter table public.polls drop constraint if exists polls_question_len;
alter table public.polls add constraint polls_question_len
  check (char_length(btrim(question)) between 1 and 200) not valid;

alter table public.poll_options drop constraint if exists poll_options_text_len;
alter table public.poll_options add constraint poll_options_text_len
  check (char_length(btrim(option_text)) between 1 and 80) not valid;

-- ------------------------------------------------------------ vote guard
create or replace function public.validate_poll_vote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expires timestamptz;
  v_option_ok boolean;
begin
  select expires_at into v_expires from public.polls where id = NEW.poll_id;
  if not found then
    raise exception 'Poll not found' using errcode = 'check_violation';
  end if;
  if v_expires is not null and v_expires <= now() then
    raise exception 'This poll has ended' using errcode = 'check_violation';
  end if;

  select exists (
    select 1 from public.poll_options
    where id = NEW.option_id and poll_id = NEW.poll_id
  ) into v_option_ok;
  if not v_option_ok then
    raise exception 'Option does not belong to this poll' using errcode = 'check_violation';
  end if;

  return NEW;
end;
$$;

revoke all on function public.validate_poll_vote() from public, anon, authenticated;

drop trigger if exists on_poll_vote_validate on public.poll_votes;
create trigger on_poll_vote_validate
  before insert on public.poll_votes
  for each row execute function public.validate_poll_vote();

-- ------------------------------------------------------------ create_poll_post
-- Merge the two prior overloads into one signature with an optional duration.
-- p_duration ∈ {'1_day','3_days','1_week','2_weeks'} (anything else / NULL =>
-- no expiry). Also trims options, drops blanks, and rejects duplicates
-- (case-insensitive) and over-long question/options — none of which the old
-- function did.
drop function if exists public.create_poll_post(text, text[]);
drop function if exists public.create_poll_post(text, text[], uuid, text, text);

create or replace function public.create_poll_post(
  p_content text,
  p_options text[],
  p_duration text default null,
  p_company_id uuid default null,
  p_company_name text default null,
  p_company_logo text default null
)
returns uuid
language plpgsql
set search_path to 'public'
as $$
declare
  new_post_id uuid;
  new_poll_id uuid;
  opt text;
  opt_norm text;
  opt_position int := 0;
  cleaned text[] := '{}';
  seen text[] := '{}';
  v_expires timestamptz;
begin
  if p_content is null or char_length(btrim(p_content)) = 0 then
    raise exception 'Poll question cannot be empty';
  end if;
  if char_length(btrim(p_content)) > 200 then
    raise exception 'Poll question is too long (max 200 characters)';
  end if;

  foreach opt in array coalesce(p_options, '{}') loop
    opt := btrim(opt);
    continue when opt = '';
    if char_length(opt) > 80 then
      raise exception 'A poll option is too long (max 80 characters)';
    end if;
    opt_norm := lower(opt);
    if opt_norm = any(seen) then
      raise exception 'Poll options must be unique';
    end if;
    seen := seen || opt_norm;
    cleaned := cleaned || opt;
  end loop;

  if array_length(cleaned, 1) is null or array_length(cleaned, 1) < 2 then
    raise exception 'A poll needs at least 2 options';
  end if;
  if array_length(cleaned, 1) > 6 then
    raise exception 'A poll can have at most 6 options';
  end if;

  v_expires := case lower(coalesce(p_duration, ''))
    when '1_day'   then now() + interval '1 day'
    when '3_days'  then now() + interval '3 days'
    when '1_week'  then now() + interval '7 days'
    when '2_weeks' then now() + interval '14 days'
    else null
  end;

  if p_company_id is not null then
    insert into public.posts (content, user_id, post_type, posted_as, company_id, company_name, company_logo)
    values (p_content, auth.uid(), 'poll', 'company', p_company_id, p_company_name, p_company_logo)
    returning id into new_post_id;
  else
    insert into public.posts (content, user_id, post_type)
    values (p_content, auth.uid(), 'poll')
    returning id into new_post_id;
  end if;

  insert into public.polls (post_id, question, expires_at)
  values (new_post_id, p_content, v_expires)
  returning id into new_poll_id;

  foreach opt in array cleaned loop
    insert into public.poll_options (poll_id, option_text, position)
    values (new_poll_id, opt, opt_position);
    opt_position := opt_position + 1;
  end loop;

  return new_post_id;
end;
$$;

revoke all on function public.create_poll_post(text, text[], text, uuid, text, text) from public, anon;
grant execute on function public.create_poll_post(text, text[], text, uuid, text, text) to authenticated, service_role;
