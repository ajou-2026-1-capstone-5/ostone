CREATE SCHEMA IF NOT EXISTS app;
CREATE SCHEMA IF NOT EXISTS airflow;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN PASSWORD :'app_db_password';
  ELSE
    ALTER ROLE app_user WITH LOGIN PASSWORD :'app_db_password';
  END IF;

  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'airflow_user') THEN
    CREATE ROLE airflow_user LOGIN PASSWORD :'airflow_db_password';
  ELSE
    ALTER ROLE airflow_user WITH LOGIN PASSWORD :'airflow_db_password';
  END IF;
END
$$;

ALTER SCHEMA app OWNER TO app_user;
ALTER SCHEMA airflow OWNER TO airflow_user;

ALTER ROLE app_user SET search_path TO app, public;
ALTER ROLE airflow_user SET search_path TO airflow, public;

GRANT CONNECT ON DATABASE ostone TO app_user;
GRANT CONNECT ON DATABASE ostone TO airflow_user;

GRANT USAGE, CREATE ON SCHEMA app TO app_user;
GRANT USAGE, CREATE ON SCHEMA airflow TO airflow_user;

ALTER DEFAULT PRIVILEGES FOR ROLE app_user IN SCHEMA app GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES FOR ROLE app_user IN SCHEMA app GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO app_user;
ALTER DEFAULT PRIVILEGES FOR ROLE airflow_user IN SCHEMA airflow GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO airflow_user;
ALTER DEFAULT PRIVILEGES FOR ROLE airflow_user IN SCHEMA airflow GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO airflow_user;
