-- Reusable definitions, dated intentions, and immutable completed sessions.
create table public.workout_cards (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(name) between 1 and 100), notes text not null default '',
 items jsonb not null check(jsonb_typeof(items)='array'), source_key text,
 program_day integer, program_activated_at timestamptz, archived boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,source_key), unique(id,user_id)
);
create table public.workout_calendar (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 scheduled_on date not null, card_id uuid, kind text not null check(kind in ('workout','rest')),
 status text not null default 'planned' check(status in ('planned','completed','skipped','moved')),
 moved_to date, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,scheduled_on), unique(id,user_id),
 foreign key(card_id,user_id) references public.workout_cards(id,user_id),
 check((kind='workout' and card_id is not null) or (kind='rest' and card_id is null))
);
alter table public.workout_cards enable row level security;
alter table public.workout_calendar enable row level security;
revoke all on public.workout_cards,public.workout_calendar from anon,authenticated;
grant select,insert,update,delete on public.workout_cards,public.workout_calendar to authenticated;
create policy own_cards on public.workout_cards for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy own_calendar on public.workout_calendar for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
alter table public.workouts add column client_session_id uuid, add column calendar_entry_id uuid, add column card_id uuid;
create unique index workouts_client_session_unique on public.workouts(user_id,client_session_id) where client_session_id is not null;
alter table public.workouts add foreign key(calendar_entry_id,user_id) references public.workout_calendar(id,user_id);
alter table public.workouts add foreign key(card_id,user_id) references public.workout_cards(id,user_id);
create index workout_calendar_card_idx on public.workout_calendar(card_id,user_id);
create index workouts_calendar_idx on public.workouts(calendar_entry_id,user_id);
create index workouts_card_idx on public.workouts(card_id,user_id);

-- Import each approved program once. Never infer dates from the number of history rows.
create function public.ensure_workout_cards() returns void language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid(); p record; d jsonb; ex jsonb; item_list jsonb; card uuid; source text; first_date date; last_date date; day_date date; weekdays smallint[]; n integer:=0; total integer; was_imported boolean;
begin
 if u is null then raise exception 'Sign in required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text||'cards',0));
 select * into p from public.training_programs where user_id=u and status='active';
 if not found then return; end if;
 source:='program:'||p.activated_at::text||':';
 select exists(select 1 from public.workout_cards where user_id=u and source_key=source||'1') into was_imported;
 if was_imported then return; end if;
 for d in select value from jsonb_array_elements(p.plan->'days') loop
  item_list:='[]'::jsonb;
  for ex in select value from jsonb_array_elements(d->'exercises') loop
   item_list:=item_list||jsonb_build_array(jsonb_build_object('exercise',jsonb_build_object('id',ex->>'exerciseId','name',ex->>'name','group',coalesce(ex->>'group','Legs'),'equipment',coalesce(ex->>'equipment','Bodyweight'),'restSeconds',coalesce((ex->>'restSeconds')::int,90),'tracking',case when ex->>'exerciseId' in ('countermovement-jump','box-jump') then 'reps' else 'weight_reps' end,'intent',case when ex->>'exerciseId' in ('countermovement-jump','box-jump','trap-bar-jump','light-explosive-pull') then 'power' else 'hypertrophy' end,'coachingNotes',concat_ws(' ',case when ex->>'rir' is not null then 'RIR: '||(ex->>'rir')||'.' end,ex->>'notes')),'targetSets',(ex->>'sets')::int,'targetReps',ex->>'reps'));
  end loop;
  insert into public.workout_cards(user_id,name,notes,items,source_key,program_day,program_activated_at)
   values(u,d->>'name',coalesce(d->>'focus',''),item_list,source||(d->>'day'),(d->>'day')::int,p.activated_at) on conflict(user_id,source_key) do nothing;
 end loop;
 first_date:=coalesce((p.plan->>'startDate')::date,(p.activated_at at time zone coalesce(p.plan->>'timeZone','Australia/Brisbane'))::date);
 last_date:=greatest(first_date,(now() at time zone coalesce(p.plan->>'timeZone','Australia/Brisbane'))::date)+83;
 weekdays:=case when cardinality(p.schedule_days)>0 then p.schedule_days else array[1,3,5]::smallint[] end;
 total:=jsonb_array_length(p.plan->'days');
 if total=0 then return; end if;
 for day_date in select generate_series(first_date,last_date,'1 day'::interval)::date loop
  if extract(dow from day_date)::int=any(weekdays) then
   select id into card from public.workout_cards where user_id=u and source_key=source||((p.plan->'days'->(n%total))->>'day');
   insert into public.workout_calendar(user_id,scheduled_on,card_id,kind,status)
    values(u,day_date,card,'workout',case when exists(select 1 from public.workouts w where w.user_id=u and w.training_program_activated_at=p.activated_at and w.program_day=((p.plan->'days'->(n%total))->>'day')::int and (w.started_at at time zone coalesce(p.plan->>'timeZone','Australia/Brisbane'))::date=day_date and w.completed_at is not null) then 'completed' else 'planned' end)
    on conflict(user_id,scheduled_on) do nothing;
   n:=n+1;
  else
   insert into public.workout_calendar(user_id,scheduled_on,kind) values(u,day_date,'rest') on conflict(user_id,scheduled_on) do nothing;
  end if;
 end loop;
end $$;

-- A calendar change is atomic, preserves finished dates, and never overwrites recurrence exceptions.
create function public.plan_workout_day(p_date date,p_card uuid default null,p_weeks integer default 1) returns uuid language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid(); result uuid; i integer; existing public.workout_calendar;
begin
 if u is null then raise exception 'Sign in required'; end if;
 if p_weeks<1 or p_weeks>12 then raise exception 'Choose 1 to 12 weeks'; end if;
 if p_card is not null and not exists(select 1 from public.workout_cards where id=p_card and user_id=u and not archived) then raise exception 'Workout card unavailable'; end if;
 select * into existing from public.workout_calendar where user_id=u and scheduled_on=p_date for update;
 if existing.status='completed' then raise exception 'This date is completed. Start an extra workout instead.'; end if;
 insert into public.workout_calendar(user_id,scheduled_on,card_id,kind) values(u,p_date,p_card,case when p_card is null then 'rest' else 'workout' end)
 on conflict(user_id,scheduled_on) do update set card_id=excluded.card_id,kind=excluded.kind,status='planned',moved_to=null,updated_at=now() where workout_calendar.status<>'completed' returning id into result;
 if result is null then raise exception 'This date is completed'; end if;
 for i in 1..p_weeks-1 loop
  insert into public.workout_calendar(user_id,scheduled_on,card_id,kind) values(u,p_date+7*i,p_card,case when p_card is null then 'rest' else 'workout' end) on conflict(user_id,scheduled_on) do nothing;
 end loop;
 return result;
end $$;
create function public.move_workout_day(p_id uuid,p_date date) returns void language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid(); e public.workout_calendar;
begin
 select * into e from public.workout_calendar where id=p_id and user_id=u for update;
 if not found or e.status<>'planned' then raise exception 'Only planned sessions can be moved'; end if;
 if e.scheduled_on=p_date then return; end if;
 if exists(select 1 from public.workout_calendar where user_id=u and scheduled_on=p_date) then raise exception 'That date already has a plan. Clear it first or choose another date.'; end if;
 insert into public.workout_calendar(user_id,scheduled_on,card_id,kind) values(u,p_date,e.card_id,e.kind);
 update public.workout_calendar set status='moved',moved_to=p_date,updated_at=now() where id=p_id and user_id=u;
end $$;

-- One transaction and a stable session ID make retries safe, even after losing a network response.
create function public.finish_workout_session(p_session jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid(); session_id uuid:=(p_session->>'id')::uuid; workout uuid; exercise uuid; item jsonb; logged jsonb; exercise_order integer:=0; set_no integer; calendar_id uuid:=(p_session->>'calendarEntryId')::uuid; card uuid:=(p_session->>'cardId')::uuid; cal public.workout_calendar;
begin
 if u is null or session_id is null then raise exception 'Sign in and session ID required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text||session_id::text,0));
 select id into workout from public.workouts where user_id=u and client_session_id=session_id;
 if found then return workout; end if;
 if not exists(select 1 from jsonb_array_elements(p_session->'items') a cross join lateral jsonb_array_elements(a->'sets') s where (s->>'done')::boolean) then raise exception 'Mark at least one set done'; end if;
 if card is not null and not exists(select 1 from public.workout_cards where id=card and user_id=u) then raise exception 'Workout card unavailable'; end if;
 if calendar_id is not null then
  select * into cal from public.workout_calendar where id=calendar_id and user_id=u for update;
  if not found or cal.status<>'planned' or cal.kind<>'workout' or cal.card_id is distinct from card then raise exception 'The calendar plan changed. Save this as an extra workout.'; end if;
 end if;
 workout:=gen_random_uuid();
 insert into public.workouts(id,user_id,name,started_at,completed_at,program_day,training_program_activated_at,client_session_id,calendar_entry_id,card_id)
 values(workout,u,left(coalesce(nullif(trim(p_session->>'name'),''),'Workout'),100),(p_session->>'startedAt')::timestamptz,null,(p_session->>'programDay')::int,(p_session->>'programActivatedAt')::timestamptz,session_id,calendar_id,card);
 for item in select value from jsonb_array_elements(p_session->'items') loop
  exercise:=gen_random_uuid();
  insert into public.workout_exercises(id,user_id,workout_id,exercise_id,exercise_name,sort_order,notes) values(exercise,u,workout,item->'exercise'->>'id',item->'exercise'->>'name',exercise_order,nullif(left(item->>'notes',1000),''));
  exercise_order:=exercise_order+1; set_no:=0;
  for logged in select value from jsonb_array_elements(item->'sets') where (value->>'done')::boolean loop
   set_no:=set_no+1;
   insert into public.workout_sets(user_id,workout_id,workout_exercise_id,set_number,weight_kg,reps,completed) values(u,workout,exercise,set_no,coalesce((logged->>'weight')::numeric,0),coalesce((logged->>'reps')::int,0),true);
  end loop;
 end loop;
 update public.workouts set completed_at=now() where id=workout and user_id=u;
 if calendar_id is not null then update public.workout_calendar set status='completed',updated_at=now() where id=calendar_id and user_id=u; end if;
 delete from public.active_workout_drafts where user_id=u and (session->>'id'=session_id::text or session->>'startedAt'=p_session->>'startedAt');
 return workout;
end $$;
create function public.save_workout_draft(p_session jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid(); session_id uuid:=(p_session->>'id')::uuid;
begin
 if u is null or session_id is null then raise exception 'Sign in and session ID required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text||session_id::text,0));
 if exists(select 1 from public.workouts where user_id=u and client_session_id=session_id) then return; end if;
 insert into public.active_workout_drafts(user_id,session,updated_at) values(u,p_session,now()) on conflict(user_id) do update set session=excluded.session,updated_at=now();
end $$;
revoke execute on function public.ensure_workout_cards(),public.plan_workout_day(date,uuid,integer),public.move_workout_day(uuid,date),public.finish_workout_session(jsonb),public.save_workout_draft(jsonb) from public,anon;
grant execute on function public.ensure_workout_cards(),public.plan_workout_day(date,uuid,integer),public.move_workout_day(uuid,date),public.finish_workout_session(jsonb),public.save_workout_draft(jsonb) to authenticated;
