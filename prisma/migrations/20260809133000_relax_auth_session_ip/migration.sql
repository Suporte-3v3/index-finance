-- Better Auth may omit the client address (for example, in local requests) and
-- represents that state as an empty string. VARCHAR accepts both real addresses
-- and that empty fallback; IP validation remains an application/proxy concern.
ALTER TABLE "user_sessions"
ALTER COLUMN "ip_address" TYPE VARCHAR(64)
USING "ip_address"::text;
