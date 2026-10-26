\set ON_ERROR_STOP on
\set app_password `cat /run/secrets/db-app-password`
SELECT format('CREATE ROLE dorsum_app LOGIN PASSWORD %L', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dorsum_app') \gexec
SELECT format('ALTER ROLE dorsum_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L', :'app_password') \gexec
REVOKE ALL ON DATABASE dorsum FROM PUBLIC;
GRANT CONNECT ON DATABASE dorsum TO dorsum_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO dorsum_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO dorsum_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO dorsum_app;
ALTER DEFAULT PRIVILEGES FOR ROLE dorsum_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO dorsum_app;
ALTER DEFAULT PRIVILEGES FOR ROLE dorsum_owner IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO dorsum_app;
REVOKE UPDATE, DELETE, TRUNCATE ON "AuditEvent" FROM dorsum_app;
REVOKE ALL ON "_prisma_migrations" FROM dorsum_app;
ALTER ROLE dorsum_app SET statement_timeout = '20s';
ALTER ROLE dorsum_app SET idle_in_transaction_session_timeout = '30s';
