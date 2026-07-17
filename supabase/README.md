# Supabase migrations

`migrations/20260717000000_rls_policy_scaffold.sql` is a **starting-point** RLS policy set, not a verified fix. It was generated from the ownership checks already in the Express controllers — it has not been run against, or confirmed to match, the live Supabase schema.

Before relying on it:
1. Run `supabase db pull` against the real project first, to see what (if anything) currently exists — don't apply this blind.
2. Confirm table/column names match your actual schema.
3. Apply to a staging project and exercise the app end-to-end before touching production.
4. From now on, any policy change made in the Supabase dashboard should also be captured here via `supabase db pull` / a new migration file, so RLS state stays in version control instead of living only in the dashboard.
