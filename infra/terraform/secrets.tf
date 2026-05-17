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
    db_username         = var.db_master_username
    db_password         = var.db_master_password
    jwt_secret          = var.jwt_secret
    app_db_password     = var.app_db_password
    airflow_db_password = var.airflow_db_password
  })
}