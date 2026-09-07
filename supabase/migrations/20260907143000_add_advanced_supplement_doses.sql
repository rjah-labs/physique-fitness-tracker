alter table public.user_preferences
  add column if not exists advanced_supplement_tracking boolean not null default false;

alter table public.supplements
  add column if not exists concentration_mg_per_ml numeric,
  add column if not exists composition_notes text;

alter table public.supplements
  drop constraint if exists supplements_concentration_check,
  add constraint supplements_concentration_check check (
    concentration_mg_per_ml is null or concentration_mg_per_ml > 0
  );

alter table public.supplement_logs
  add column if not exists actual_dose_value numeric,
  add column if not exists actual_dose_unit text,
  add column if not exists preset_dose_value numeric,
  add column if not exists preset_dose_unit text,
  add column if not exists concentration_mg_per_ml numeric,
  add column if not exists composition_snapshot text;

alter table public.supplement_logs
  drop constraint if exists supplement_logs_actual_dose_check,
  add constraint supplement_logs_actual_dose_check check (
    actual_dose_value is null or actual_dose_value > 0
  ),
  drop constraint if exists supplement_logs_preset_dose_check,
  add constraint supplement_logs_preset_dose_check check (
    preset_dose_value is null or preset_dose_value > 0
  );

comment on column public.supplement_logs.preset_dose_value is
  'Immutable snapshot of the supplement preset when this daily record was created.';
comment on column public.supplement_logs.actual_dose_value is
  'Actual dose recorded for this occurrence; may differ from the preset without modifying it.';
