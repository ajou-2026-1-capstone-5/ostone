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

CREATE SCHEMA IF NOT EXISTS app AUTHORIZATION app_user;
CREATE SCHEMA IF NOT EXISTS corpus AUTHORIZATION app_user;
CREATE SCHEMA IF NOT EXISTS pack AUTHORIZATION app_user;
CREATE SCHEMA IF NOT EXISTS review AUTHORIZATION app_user;
CREATE SCHEMA IF NOT EXISTS pipeline AUTHORIZATION app_user;
CREATE SCHEMA IF NOT EXISTS runtime AUTHORIZATION app_user;
CREATE SCHEMA IF NOT EXISTS airflow AUTHORIZATION airflow_user;

ALTER SCHEMA app OWNER TO app_user;
ALTER SCHEMA corpus OWNER TO app_user;
ALTER SCHEMA pack OWNER TO app_user;
ALTER SCHEMA review OWNER TO app_user;
ALTER SCHEMA pipeline OWNER TO app_user;
ALTER SCHEMA runtime OWNER TO app_user;
ALTER SCHEMA airflow OWNER TO airflow_user;

ALTER ROLE app_user SET search_path TO app, corpus, pack, review, pipeline, runtime, public;
ALTER ROLE airflow_user SET search_path TO airflow, public;

GRANT CONNECT, CREATE ON DATABASE :"db_name" TO app_user;
GRANT CONNECT ON DATABASE :"db_name" TO airflow_user;

GRANT USAGE, CREATE ON SCHEMA app, corpus, pack, review, pipeline, runtime TO app_user;
GRANT USAGE, CREATE ON SCHEMA airflow TO airflow_user;

ALTER DEFAULT PRIVILEGES FOR ROLE app_user IN SCHEMA app, corpus, pack, review, pipeline, runtime GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES FOR ROLE app_user IN SCHEMA app, corpus, pack, review, pipeline, runtime GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO app_user;
ALTER DEFAULT PRIVILEGES FOR ROLE airflow_user IN SCHEMA airflow GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO airflow_user;
ALTER DEFAULT PRIVILEGES FOR ROLE airflow_user IN SCHEMA airflow GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO airflow_user;
