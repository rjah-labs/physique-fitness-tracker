create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
revoke all on public.app_admins from public, anon;
grant select on public.app_admins to authenticated;
create policy "Admins can verify their own access" on public.app_admins for select to authenticated using ((select auth.uid()) = user_id);
insert into public.app_admins (user_id) select id from auth.users where lower(email) = 'robert.j.hilder@gmail.com' on conflict (user_id) do nothing;

create table if not exists public.app_user_activity (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  launch_count bigint not null default 1 check (launch_count > 0),
  standalone_launches bigint not null default 0 check (standalone_launches >= 0),
  last_launch_standalone boolean not null default false
);
create index if not exists app_user_activity_last_seen_idx on public.app_user_activity (last_seen_at desc);
alter table public.app_user_activity enable row level security;
revoke all on public.app_user_activity from public, anon;
grant select, insert, update on public.app_user_activity to authenticated;
create policy "Users can read their own app activity" on public.app_user_activity for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create their own app activity" on public.app_user_activity for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own app activity" on public.app_user_activity for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create or replace function public.record_app_launch(is_standalone boolean default false) returns void language plpgsql security invoker set search_path = '' as $$
declare caller_id uuid := (select auth.uid());
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  insert into public.app_user_activity (user_id,first_seen_at,last_seen_at,launch_count,standalone_launches,last_launch_standalone)
  values (caller_id,now(),now(),1,case when is_standalone then 1 else 0 end,is_standalone)
  on conflict (user_id) do update set last_seen_at=excluded.last_seen_at,launch_count=public.app_user_activity.launch_count+1,standalone_launches=public.app_user_activity.standalone_launches+case when excluded.last_launch_standalone then 1 else 0 end,last_launch_standalone=excluded.last_launch_standalone;
end; $$;
revoke execute on function public.record_app_launch(boolean) from public, anon;
grant execute on function public.record_app_launch(boolean) to authenticated;

create or replace function public.get_owner_analytics() returns jsonb language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := (select auth.uid()); result jsonb;
begin
  if caller_id is null or not exists (select 1 from public.app_admins where user_id=caller_id) then raise exception 'Owner access required' using errcode='42501'; end if;
  select jsonb_build_object('registered_users',(select count(*) from auth.users),'tracked_users',(select count(*) from public.app_user_activity),'active_7d',(select count(*) from public.app_user_activity where last_seen_at>=now()-interval '7 days'),'active_30d',(select count(*) from public.app_user_activity where last_seen_at>=now()-interval '30 days'),'installed_users',(select count(*) from public.app_user_activity where standalone_launches>0),'total_launches',(select coalesce(sum(launch_count),0) from public.app_user_activity),'body_check_ins',(select count(*) from public.body_check_ins),'completed_workouts',(select count(*) from public.workouts where completed_at is not null),'generated_at',now()) into result;
  return result;
end; $$;
revoke execute on function public.get_owner_analytics() from public, anon;
grant execute on function public.get_owner_analytics() to authenticated;
