-- Existing credential users chose their current password before the mandatory
-- first-access policy existed. Only newly provisioned users remain pending.
UPDATE "users" AS "u"
SET "password_changed_at" = COALESCE("u"."created_at", CURRENT_TIMESTAMP)
WHERE "u"."password_changed_at" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "auth_accounts" AS "a"
    WHERE "a"."user_id" = "u"."id"
      AND "a"."provider_id" = 'credential'
      AND "a"."password" IS NOT NULL
  );
