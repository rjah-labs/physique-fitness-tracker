alter table public.workout_exercises
  add column if not exists notes text;

comment on column public.workout_exercises.notes is
  'Optional user-authored note captured for this exercise in this completed workout.';
