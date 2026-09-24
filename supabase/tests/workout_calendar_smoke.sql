-- Execute inside a transaction as an authenticated test account, then ROLLBACK.
do $$
declare u uuid:=auth.uid(); card uuid; plan uuid; session uuid:=gen_random_uuid(); first_result uuid; again uuid; payload jsonb; before_count int; n int; fail_session uuid:=gen_random_uuid();
begin
 if u is null then raise exception 'Set an authenticated test account first'; end if;
 insert into public.workout_cards(user_id,name,items) values(u,'Calendar verification','[{"exercise":{"id":"test","name":"Test exercise"},"targetSets":1,"targetReps":"8"}]') returning id into card;
 plan:=public.plan_workout_day('2099-01-01',card,4);
 select count(*) into n from public.workout_calendar where user_id=u and card_id=card;
 if n<>4 then raise exception 'Weekly repeat failed'; end if;
 perform public.plan_workout_day('2099-01-01',card,4);
 select count(*) into n from public.workout_calendar where user_id=u and card_id=card;
 if n<>4 then raise exception 'Repeating duplicated dates'; end if;
 perform public.move_workout_day(plan,'2099-01-02');
 if not exists(select 1 from public.workout_calendar where id=plan and status='moved' and moved_to='2099-01-02') then raise exception 'Original move date lost'; end if;
 select id into plan from public.workout_calendar where user_id=u and scheduled_on='2099-01-02';
 payload:=jsonb_build_object('id',session,'name','Calendar verification','startedAt',now(),'cardId',card,'calendarEntryId',plan,'items',jsonb_build_array(jsonb_build_object('exercise',jsonb_build_object('id','test','name','Test exercise'),'notes','Verified note','sets',jsonb_build_array(jsonb_build_object('weight',20,'reps',8,'done',true),jsonb_build_object('weight',20,'reps',8,'done',false)))));
 perform public.save_workout_draft(payload);
 first_result:=public.finish_workout_session(payload);again:=public.finish_workout_session(payload);
 if first_result<>again then raise exception 'Retry created a duplicate'; end if;
 select count(*) into n from public.workout_sets where workout_id=first_result;
 if n<>1 then raise exception 'Unchecked sets were saved'; end if;
 if not exists(select 1 from public.workout_calendar where id=plan and status='completed') then raise exception 'Plan not completed'; end if;
 perform public.save_workout_draft(payload);
 if exists(select 1 from public.active_workout_drafts d where user_id=u and d.session->>'id'=payload->>'id') then raise exception 'Completed draft resurrected'; end if;
 begin
  perform public.plan_workout_day('2099-01-02',card);
  raise exception 'Completed date was overwritten';
 exception when raise_exception then if sqlerrm='Completed date was overwritten' then raise; end if;
 end;
 select count(*) into before_count from public.workouts where user_id=u;
 payload:=jsonb_set(payload-'calendarEntryId','{id}',to_jsonb(fail_session));
 payload:=jsonb_set(payload,'{items,0,sets,0,weight}','-1');
 begin
  perform public.finish_workout_session(payload);
  raise exception 'Invalid set was accepted';
 exception when check_violation then null;
 end;
 select count(*) into n from public.workouts where user_id=u;
 if n<>before_count then raise exception 'Partial workout survived rollback'; end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
 if exists(select 1 from public.workout_cards where id=card) or exists(select 1 from public.workout_calendar where id=plan) then raise exception 'Cross-account read allowed'; end if;
 begin
  insert into public.workout_cards(user_id,name,items) values(u,'Forbidden','[]');
  raise exception 'Cross-account write allowed';
 exception when insufficient_privilege then null;
 end;
 perform set_config('request.jwt.claim.sub',u::text,true);
 raise notice 'PASS: recurrence, reschedule, atomic finish, retry, draft guard, completed-date protection, RLS isolation';
end $$;
