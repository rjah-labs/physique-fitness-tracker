alter table public.supplements
  add column if not exists schedule_frequency text not null default 'weekly',
  add column if not exists schedule_anchor_date date;

alter table public.supplements
  drop constraint if exists supplements_schedule_frequency_check,
  add constraint supplements_schedule_frequency_check
    check (schedule_frequency in ('weekly', 'fortnightly', 'monthly')),
  drop constraint if exists supplements_schedule_anchor_check,
  add constraint supplements_schedule_anchor_check
    check (schedule_frequency = 'weekly' or schedule_anchor_date is not null);

comment on column public.supplements.schedule_frequency is
  'Recurrence pattern: selected weekdays, every fourteen days, or monthly.';

comment on column public.supplements.schedule_anchor_date is
  'First scheduled date for fortnightly and monthly recurrence patterns.';
