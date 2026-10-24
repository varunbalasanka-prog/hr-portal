-- A super admin sits above admin. Added on its own because a new enum value can't be used in the same transaction.
alter type user_role add value if not exists 'superadmin';
