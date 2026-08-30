create table public.active_workout_drafts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session jsonb not null,
  updated_at timestamptz not null default now(),
  constraint active_workout_drafts_session_object check (jsonb_typeof(session) = 'object')
);

alter table public.active_workout_drafts enable row level security;

revoke all on table public.active_workout_drafts from anon;
grant select, insert, update, delete on table public.active_workout_drafts to authenticated;

create policy "Users can read their own active workout"
on public.active_workout_drafts for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own active workout"
on public.active_workout_drafts for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own active workout"
on public.active_workout_drafts for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own active workout"
on public.active_workout_drafts for delete
to authenticated
using ((select auth.uid()) = user_id);
