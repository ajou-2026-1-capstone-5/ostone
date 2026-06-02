resource "aws_ecs_cluster" "main" {
  name = "${local.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = local.common_tags
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = ["FARGATE", aws_ecs_capacity_provider.gpu.name]

  default_capacity_provider_strategy {
    base              = 1
    weight            = 1
    capacity_provider = "FARGATE"
  }
}

resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/${local.name_prefix}/backend"
  retention_in_days = 30
  kms_key_id        = aws_kms_key.observability.arn

  tags = local.common_tags
}

resource "aws_ecs_task_definition" "backend" {
  family                   = "${local.name_prefix}-backend-task"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "1024"
  memory                   = "2048"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_backend_task.arn

  container_definitions = jsonencode([
    {
      name      = "app-backend"
      image     = "${aws_ecr_repository.repos["backend"].repository_url}:latest"
      essential = true

      portMappings = [
        {
          containerPort = 8080
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "SPRING_PROFILES_ACTIVE"
          value = "prod"
        },
        {
          name  = "SERVER_PORT"
          value = "8080"
        },
        {
          name  = "DB_HOST"
          value = aws_db_instance.postgres.address
        },
        {
          name  = "DB_PORT"
          value = tostring(aws_db_instance.postgres.port)
        },
        {
          name  = "DB_NAME"
          value = var.db_name
        },
        {
          name  = "AWS_REGION"
          value = var.aws_region
        },
        {
          name  = "CORS_ALLOWED_ORIGINS"
          value = "https://app.${var.domain_name}"
        },
        {
          name  = "STORAGE_S3_BUCKET"
          value = aws_s3_bucket.buckets["ml_input"].bucket
        },
        {
          name  = "STORAGE_S3_REGION"
          value = var.aws_region
        },
        {
          name  = "STORAGE_S3_SSE_ENABLED"
          value = "true"
        },
        {
          name  = "AIRFLOW_API_BASE_URL"
          value = local.airflow_backend_api_base_url
        },
        {
          name  = "AIRFLOW_API_ALLOW_INSECURE_HTTP"
          value = tostring(var.airflow_api_allow_insecure_http || var.airflow_api_base_url == "")
        },
        {
          name  = "AI_EMBEDDING_PROVIDER"
          value = var.ai_embedding_provider
        },
        {
          name  = "AI_EMBEDDING_MODEL"
          value = var.ai_embedding_model
        },
        {
          name  = "AI_EMBEDDING_BEDROCK_REGION"
          value = var.ai_embedding_bedrock_region
        },
        {
          name  = "AI_EMBEDDING_ENABLED"
          value = tostring(var.ai_embedding_enabled)
        },
        {
          name  = "AI_EMBEDDING_TIMEOUT_SECONDS"
          value = tostring(var.ai_embedding_timeout_seconds)
        },
        {
          name  = "AI_EMBEDDING_PROFILE_BUILD_RUNNING_TIMEOUT"
          value = var.ai_embedding_profile_build_running_timeout
        },
        {
          name  = "AI_EMBEDDING_AUTO_RUN_REPLAY_FITNESS_THRESHOLD"
          value = tostring(var.ai_embedding_auto_run_replay_fitness_threshold)
        },
        {
          name  = "AI_EMBEDDING_CONFIDENT_THRESHOLD"
          value = tostring(var.ai_embedding_confident_threshold)
        },
        {
          name  = "AI_EMBEDDING_AMBIGUOUS_THRESHOLD"
          value = tostring(var.ai_embedding_ambiguous_threshold)
        },
        {
          name  = "AI_EMBEDDING_CONFIDENT_MARGIN"
          value = tostring(var.ai_embedding_confident_margin)
        },
        {
          name  = "AI_EMBEDDING_SEMANTIC_FLOOR"
          value = tostring(var.ai_embedding_semantic_floor)
        },
        {
          name  = "AI_EMBEDDING_ROUTE_EVIDENCE_FLOOR"
          value = tostring(var.ai_embedding_route_evidence_floor)
        },
        {
          name  = "AI_EMBEDDING_LEXICAL_EVIDENCE_FLOOR"
          value = tostring(var.ai_embedding_lexical_evidence_floor)
        },
        {
          name  = "AI_CHAT_PROVIDER"
          value = "bedrock-converse"
        },
        {
          name  = "AI_CHAT_BEDROCK_REGION"
          value = var.ai_chat_bedrock_region
        },
        {
          name  = "AI_CHAT_BEDROCK_MODEL"
          value = local.ai_chat_bedrock_runtime_model
        }
      ]

      secrets = [
        {
          name      = "SPRING_DATASOURCE_USERNAME"
          valueFrom = "${aws_secretsmanager_secret.app.arn}:db_username::"
        },
        {
          name      = "SPRING_DATASOURCE_PASSWORD"
          valueFrom = "${aws_secretsmanager_secret.app.arn}:db_password::"
        },
        {
          name      = "JWT_SECRET"
          valueFrom = "${aws_secretsmanager_secret.app.arn}:jwt_secret::"
        },
        {
          name      = "AIRFLOW_API_USERNAME"
          valueFrom = "${aws_secretsmanager_secret.app.arn}:airflow_api_username::"
        },
        {
          name      = "AIRFLOW_API_PASSWORD"
          valueFrom = "${aws_secretsmanager_secret.app.arn}:airflow_api_password::"
        },
        {
          name      = "AIRFLOW_WEBHOOK_SECRET"
          valueFrom = "${aws_secretsmanager_secret.app.arn}:airflow_webhook_secret::"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.backend.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "backend"
          "awslogs-create-group"  = "true"
        }
      }

      cpu    = 0
      memory = 2048
    }
  ])

  tags = local.common_tags
}

resource "aws_ecs_service" "backend" {
  name             = "ostone-backend"
  cluster          = aws_ecs_cluster.main.id
  task_definition  = aws_ecs_task_definition.backend.arn
  desired_count    = var.backend_desired_count
  launch_type      = "FARGATE"
  platform_version = "LATEST"

  health_check_grace_period_seconds = 180

  network_configuration {
    subnets          = values(aws_subnet.private)[*].id
    security_groups  = [aws_security_group.ecs_backend.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "app-backend"
    container_port   = 8080
  }

  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200

  depends_on = [
    aws_lb_listener.backend_https,
    terraform_data.db_bootstrap
  ]

  lifecycle {
    ignore_changes = [
      desired_count,
      task_definition
    ]
  }
}

resource "aws_appautoscaling_target" "backend" {
  service_namespace  = "ecs"
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.backend.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  min_capacity       = var.backend_autoscaling_min_capacity
  max_capacity       = var.backend_autoscaling_max_capacity
}

resource "aws_appautoscaling_policy" "backend_cpu" {
  name               = "${local.name_prefix}-backend-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  service_namespace  = "ecs"
  resource_id        = aws_appautoscaling_target.backend.resource_id
  scalable_dimension = aws_appautoscaling_target.backend.scalable_dimension

  target_tracking_scaling_policy_configuration {
    target_value       = 70
    scale_in_cooldown  = 120
    scale_out_cooldown = 60

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}
