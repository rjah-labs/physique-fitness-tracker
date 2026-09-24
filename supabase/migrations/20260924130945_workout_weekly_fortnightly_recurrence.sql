create function public.plan_workout_recurrence(p_date date,p_card uuid default null,p_count integer default 1,p_interval_weeks integer default 1) returns uuid language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid(); first_id uuid; i integer;
begin
 if u is null then raise exception 'Sign in required'; end if;
 if p_count is null or p_count<1 or p_count>104 then raise exception 'Choose a whole number from 1 to 104'; end if;
 if p_interval_weeks is null or p_interval_weeks not in (1,2) then raise exception 'Choose every week or every 2 weeks'; end if;
 first_id:=public.plan_workout_day(p_date,p_card,1);
 for i in 1..p_count-1 loop
  insert into public.workout_calendar(user_id,scheduled_on,card_id,kind)
  values(u,p_date+(7*p_interval_weeks*i),p_card,case when p_card is null then 'rest' else 'workout' end)
  on conflict(user_id,scheduled_on) do nothing;
 end loop;
 return first_id;
end $$;
revoke execute on function public.plan_workout_recurrence(date,uuid,integer,integer) from public,anon;
grant execute on function public.plan_workout_recurrence(date,uuid,integer,integer) to authenticated;
