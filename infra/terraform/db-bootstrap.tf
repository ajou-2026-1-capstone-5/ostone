resource "aws_cloudwatch_log_group" "db_bootstrap" {
  name              = "/ecs/${local.name_prefix}-db-bootstrap"
  retention_in_days = 14

  tags = {
    Name = "${local.name_prefix}-db-bootstrap-logs"
  }
}

resource "aws_iam_role" "ecs_db_bootstrap_execution" {
  name                 = "${local.name_prefix}-ecs-db-bootstrap-execution-role"
  assume_role_policy   = data.aws_iam_policy_document.ecs_tasks_assume_role.json
  permissions_boundary = var.permissions_boundary_arn

  tags = {
    Name = "${local.name_prefix}-ecs-db-bootstrap-execution-role"
  }
}

resource "aws_iam_role_policy_attachment" "ecs_db_bootstrap_execution_managed" {
  role       = aws_iam_role.ecs_db_bootstrap_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "ecs_db_bootstrap_execution" {
  statement {
    sid = "WriteBootstrapLogs"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]
    resources = ["${aws_cloudwatch_log_group.db_bootstrap.arn}:*"]
  }

  statement {
    sid       = "ReadBootstrapSecrets"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.app.arn, aws_secretsmanager_secret.db_admin.arn]
  }
}

resource "aws_iam_role_policy" "ecs_db_bootstrap_execution" {
  name   = "${local.name_prefix}-ecs-db-bootstrap-execution-policy"
  role   = aws_iam_role.ecs_db_bootstrap_execution.id
  policy = data.aws_iam_policy_document.ecs_db_bootstrap_execution.json
}

resource "aws_ecs_task_definition" "db_bootstrap" {
  family                   = "${local.name_prefix}-db-bootstrap"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.ecs_db_bootstrap_execution.arn

  container_definitions = jsonencode([
    {
      name      = "db-bootstrap"
      image     = "public.ecr.aws/docker/library/postgres:16"
      essential = true

      environment = [
        {
          name  = "DB_HOST"
          value = aws_db_instance.postgres.address
        },
        {
          name  = "DB_NAME"
          value = var.db_name
        },
        {
          name  = "DB_MASTER_USERNAME"
          value = var.db_master_username
        }
      ]

      secrets = [
        {
          name      = "PGPASSWORD"
          valueFrom = "${aws_secretsmanager_secret.db_admin.arn}:db_master_password::"
        },
        {
          name      = "APP_DB_PASSWORD"
          valueFrom = "${aws_secretsmanager_secret.app.arn}:app_db_password::"
        },
        {
          name      = "AIRFLOW_DB_PASSWORD"
          valueFrom = "${aws_secretsmanager_secret.app.arn}:airflow_db_password::"
        }
      ]

      command = [
        "sh",
        "-ceu",
        <<-EOT
          printf '%s' '${base64encode(file("${path.module}/scripts/init.sql"))}' | base64 -d >/tmp/init.sql

          psql "host=$DB_HOST port=5432 dbname=$DB_NAME user=$DB_MASTER_USERNAME sslmode=require" \
            -v db_name="$DB_NAME" \
            -v app_db_password="$APP_DB_PASSWORD" \
            -v airflow_db_password="$AIRFLOW_DB_PASSWORD" \
            -f /tmp/init.sql
        EOT
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.db_bootstrap.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "db-bootstrap"
        }
      }
    }
  ])

  tags = {
    Name = "${local.name_prefix}-db-bootstrap"
  }
}

resource "terraform_data" "db_bootstrap" {
  triggers_replace = {
    db_instance_id          = aws_db_instance.postgres.id
    init_sql_sha256         = filesha256("${path.module}/scripts/init.sql")
    app_secret_version      = aws_secretsmanager_secret_version.app.version_id
    db_admin_secret_version = aws_secretsmanager_secret_version.db_admin.version_id
    task_definition         = aws_ecs_task_definition.db_bootstrap.arn
  }

  provisioner "local-exec" {
    interpreter = ["/bin/sh", "-c"]
    command = <<-EOT
      set -eu
      TASK_ARN=$(aws ecs run-task \
        --region '${var.aws_region}' \
        --cluster '${aws_ecs_cluster.main.arn}' \
        --task-definition '${aws_ecs_task_definition.db_bootstrap.arn}' \
        --launch-type FARGATE \
        --network-configuration '${jsonencode({
    awsvpcConfiguration = {
      subnets        = values(aws_subnet.private)[*].id
      securityGroups = [aws_security_group.ecs_backend.id]
      assignPublicIp = "DISABLED"
    }
})}' \
        --query 'tasks[0].taskArn' \
        --output text)

      if [ "$TASK_ARN" = "None" ] || [ -z "$TASK_ARN" ]; then
        echo "Failed to start database bootstrap task" >&2
        exit 1
      fi

      aws ecs wait tasks-stopped --region '${var.aws_region}' --cluster '${aws_ecs_cluster.main.arn}' --tasks "$TASK_ARN"
      EXIT_CODE=$(aws ecs describe-tasks \
        --region '${var.aws_region}' \
        --cluster '${aws_ecs_cluster.main.arn}' \
        --tasks "$TASK_ARN" \
        --query 'tasks[0].containers[0].exitCode' \
        --output text)

      if [ "$EXIT_CODE" != "0" ]; then
        aws ecs describe-tasks --region '${var.aws_region}' --cluster '${aws_ecs_cluster.main.arn}' --tasks "$TASK_ARN" >&2
        exit 1
      fi
    EOT
}

depends_on = [
  aws_db_instance.postgres,
  aws_security_group_rule.ecs_backend_egress_rds,
  aws_security_group_rule.rds_ecs_backend_ingress,
  aws_iam_role_policy.ecs_db_bootstrap_execution
]
}
