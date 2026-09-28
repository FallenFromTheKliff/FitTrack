-- This migration duplicated the original User/Role/RefreshToken tables that
-- were already created earlier in the history. Keeping it as a no-op allows a
-- fresh database to replay the full migration chain without colliding on
-- duplicate relations.
SELECT 1;
