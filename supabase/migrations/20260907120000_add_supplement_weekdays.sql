alter table public.supplements
  add column if not exists scheduled_weekdays smallint[] not null
    default array[0,1,2,3,4,5,6]::smallint[];

alter table public.supplements
  drop constraint if exists supplements_scheduled_weekdays_check,
  add constraint supplements_scheduled_weekdays_check check (
    cardinality(scheduled_weekdays) between 1 and 7
    and scheduled_weekdays <@ array[0,1,2,3,4,5,6]::smallint[]
  );

comment on column public.supplements.scheduled_weekdays is
  'Local weekdays when the supplement is scheduled: Sunday=0 through Saturday=6.';
