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
    db_username            = "app_user"
    db_password            = var.app_db_password
    jwt_secret             = var.jwt_secret
    airflow_api_username   = var.airflow_api_username
    airflow_api_password   = var.airflow_api_password
    app_db_password        = var.app_db_password
    airflow_db_password    = var.airflow_db_password
    airflow_webhook_secret = var.airflow_webhook_secret
    omlx_api_key           = var.omlx_api_key
  })
}
