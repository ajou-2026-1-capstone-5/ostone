DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN;
  END IF;

  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'airflow_user') THEN
    CREATE ROLE airflow_user LOGIN;
  END IF;
END
$$;

ALTER ROLE app_user WITH LOGIN PASSWORD :'app_db_password';
ALTER ROLE airflow_user WITH LOGIN PASSWORD :'airflow_db_password';

CREATE EXTENSION IF NOT EXISTS vector;

CREATE SCHEMA IF NOT EXISTS airflow;

ALTER ROLE app_user SET search_path TO app, corpus, pack, review, pipeline, runtime, public;
ALTER ROLE airflow_user SET search_path TO airflow, public;

GRANT CONNECT ON DATABASE :"db_name" TO app_user;
GRANT CREATE ON DATABASE :"db_name" TO app_user;
GRANT CONNECT ON DATABASE :"db_name" TO airflow_user;

GRANT USAGE, CREATE ON SCHEMA public TO app_user;
GRANT USAGE, CREATE ON SCHEMA airflow TO airflow_user;

ALTER DEFAULT PRIVILEGES FOR ROLE airflow_user IN SCHEMA airflow GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO airflow_user;
ALTER DEFAULT PRIVILEGES FOR ROLE airflow_user IN SCHEMA airflow GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO airflow_user;
