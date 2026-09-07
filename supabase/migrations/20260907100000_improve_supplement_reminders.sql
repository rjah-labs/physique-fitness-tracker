alter table public.supplements
  add column if not exists reminder_enabled boolean not null default true,
  add column if not exists follow_up_minutes integer;

alter table public.supplements
  drop constraint if exists supplements_follow_up_minutes_check,
  add constraint supplements_follow_up_minutes_check
    check (follow_up_minutes is null or follow_up_minutes in (15, 30, 60, 90, 120));

create index if not exists supplement_logs_user_date_idx
  on public.supplement_logs (user_id, scheduled_on desc);

comment on column public.supplements.reminder_enabled is
  'Per-supplement reminder preference. Global device notifications must also be explicitly enabled.';
comment on column public.supplements.follow_up_minutes is
  'Optional follow-up reminder delay when the scheduled item remains unrecorded.';

grant select, insert, update, delete on table public.supplements to authenticated;
grant select, insert, update, delete on table public.supplement_logs to authenticated;
