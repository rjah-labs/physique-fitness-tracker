alter table public.supplements
  drop constraint if exists supplements_dose_unit_check;

alter table public.supplements
  add constraint supplements_dose_unit_check
  check (dose_unit = any (array[
    'mg'::text,
    'g'::text,
    'mcg'::text,
    'ml'::text,
    'units'::text,
    'capsule'::text,
    'capsules'::text,
    'tablet'::text,
    'tablets'::text,
    'scoop'::text,
    'scoops'::text
  ]));
