# Supabase integration plan

No Supabase project or credentials are required for v0.1.

Recommended tables:

- `profiles`: one row per authenticated user.
- `body_check_ins`: date, weight and notes.
- `body_measurements`: check-in id, measurement key, value and unit.
- `workouts`: date, title, status and notes.
- `workout_sets`: workout id, exercise, set number, reps and load.
- `goals`: metric key, target value, target date and status.

All user-owned tables should include `user_id uuid references auth.users(id)` and Row Level Security policies restricting access to `auth.uid() = user_id`.

Implementation sequence:

1. Add Supabase Auth.
2. Create tables and RLS policies.
3. Add a `SupabaseFitnessRepository` implementing `FitnessRepository`.
4. Select it when environment variables are present; retain the local adapter for development and offline-first behavior.
