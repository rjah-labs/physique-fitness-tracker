alter table public.supplement_logs
  add column if not exists actual_taken_on date;

update public.supplement_logs
set actual_taken_on = scheduled_on
where status = 'taken' and actual_taken_on is null;

alter table public.supplement_logs
  drop constraint if exists supplement_logs_actual_taken_on_check,
  add constraint supplement_logs_actual_taken_on_check
    check (
      (status = 'taken' and actual_taken_on is not null)
      or (status = 'skipped' and actual_taken_on is null)
    );

create index if not exists supplement_logs_user_actual_taken_idx
  on public.supplement_logs (user_id, actual_taken_on)
  where actual_taken_on is not null;

comment on column public.supplement_logs.actual_taken_on is
  'Calendar date the dose was actually taken. scheduled_on remains the planned dose date.';
