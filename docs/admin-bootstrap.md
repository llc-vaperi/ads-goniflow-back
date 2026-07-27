# Admin bootstrap

The first owner is created once, after all Supabase migrations have been
applied. Use the Supabase SQL Editor with the UUID of an existing authenticated
user:

```sql
select public.bootstrap_first_admin_owner(
  '00000000-0000-0000-0000-000000000000'::uuid
);
```

Replace the sample UUID with the user's real Supabase Auth user ID. The
application already displays this ID in account settings.

After the first owner exists:

- additional owners, admins, and viewers must be managed through the admin API;
- a second bootstrap call is rejected;
- the last active owner cannot be deactivated or demoted;
- every membership change is written to `admin_audit_log`.

Admin roles:

- `owner`: manage admin memberships and access all admin data;
- `admin`: access operational admin data and the audit log;
- `viewer`: read basic admin membership data only.

Never expose the Supabase service-role key to the browser or use it in a
frontend request.
