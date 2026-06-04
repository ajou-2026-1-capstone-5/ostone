resource "aws_secretsmanager_secret" "app" {
  name        = "/prod/ostone/app"
  description = "Application secrets for ostone prod environment"

  recovery_window_in_days = 7

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-app-secrets"
  })
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id

  secret_string = jsonencode({
    db_username          = "app_user"
    db_password          = var.app_db_password
    jwt_secret           = var.jwt_secret
    airflow_api_username = var.airflow_api_username
    airflow_api_password = var.airflow_api_password
    app_db_password      = var.app_db_password
    airflow_db_password  = var.airflow_db_password
    airflow_sql_alchemy_conn = format(
      "postgresql+psycopg2://airflow_user:%s@%s:5432/%s",
      var.airflow_db_password,
      aws_db_instance.postgres.address,
      var.db_name
    )
    airflow_sql_alchemy_conn_async = format(
      "postgresql+asyncpg://airflow_user:%s@%s:5432/%s",
      var.airflow_db_password,
      aws_db_instance.postgres.address,
      var.db_name
    )
    airflow_webhook_secret         = var.airflow_webhook_secret
    airflow_fernet_key             = var.airflow_fernet_key
    airflow_api_secret_key         = var.airflow_api_secret_key
    airflow_api_auth_jwt_secret    = var.airflow_api_auth_jwt_secret
    airflow_simple_admin_password  = var.airflow_simple_admin_password
    airflow_simple_viewer_password = var.airflow_simple_viewer_password
    llm_runtime_api_key            = var.llm_runtime_api_key
    toss_secret_key                = var.toss_secret_key
    toss_webhook_secret            = var.toss_webhook_secret
    toss_billing_key_encryption_key = var.toss_billing_key_encryption_key
  })
}

resource "aws_secretsmanager_secret" "db_admin" {
  name        = "/prod/ostone/db-admin"
  description = "Database admin credentials used only by the production bootstrap task"

  recovery_window_in_days = 7

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-db-admin-secrets"
  })
}

resource "aws_secretsmanager_secret_version" "db_admin" {
  secret_id = aws_secretsmanager_secret.db_admin.id

  secret_string = jsonencode({
    db_master_username = var.db_master_username
    db_master_password = var.db_master_password
  })
}
