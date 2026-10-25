-- Runtime role for the API. It owns nothing and has no BYPASSRLS,
-- so row-level security policies always apply to it.
CREATE ROLE hestia_app LOGIN PASSWORD 'hestia_app' NOBYPASSRLS;

GRANT CONNECT ON DATABASE hestia TO hestia_app;
GRANT USAGE ON SCHEMA public TO hestia_app;

-- Tables and sequences created later by migrations (run as hestia).
ALTER DEFAULT PRIVILEGES FOR ROLE hestia IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hestia_app;
ALTER DEFAULT PRIVILEGES FOR ROLE hestia IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO hestia_app;
