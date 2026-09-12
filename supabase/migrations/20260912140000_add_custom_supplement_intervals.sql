alter table public.supplements
  add column if not exists schedule_interval_days integer;

alter table public.supplements
  drop constraint if exists supplements_schedule_frequency_check,
  add constraint supplements_schedule_frequency_check
    check (schedule_frequency in ('weekly', 'fortnightly', 'monthly', 'custom')),
  drop constraint if exists supplements_schedule_anchor_check,
  add constraint supplements_schedule_anchor_check
    check (schedule_frequency = 'weekly' or schedule_anchor_date is not null),
  add constraint supplements_schedule_interval_days_check
    check (
      (schedule_frequency = 'custom' and schedule_interval_days between 1 and 3650)
      or (schedule_frequency <> 'custom' and schedule_interval_days is null)
    );

comment on column public.supplements.schedule_interval_days is
  'Custom recurrence interval in days. The first due date is one complete interval after schedule_anchor_date.';
