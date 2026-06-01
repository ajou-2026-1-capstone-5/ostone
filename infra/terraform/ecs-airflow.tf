resource "aws_service_discovery_private_dns_namespace" "main" {
  name        = local.airflow_private_namespace_name
  description = "Private service discovery namespace for ${local.name_prefix} ECS services."
  vpc         = aws_vpc.main.id

  tags = local.common_tags
}

resource "aws_service_discovery_service" "airflow_api" {
  name = "airflow-api"

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.main.id

    dns_records {
      ttl  = 10
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }

  health_check_custom_config {
    failure_threshold = 1
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_log_group" "airflow" {
  name              = "/ecs/${local.name_prefix}/airflow"
  retention_in_days = 30
  kms_key_id        = aws_kms_key.observability.arn

  tags = local.common_tags
}

locals {
  airflow_environment = [
    {
      name  = "AIRFLOW__CORE__EXECUTOR"
      value = "LocalExecutor"
    },
    {
      name  = "AIRFLOW__API__BASE_URL"
      value = "https://airflow.${var.domain_name}"
    },
    {
      name  = "AIRFLOW__CORE__EXECUTION_API_SERVER_URL"
      value = "${local.airflow_private_api_base_url}/execution/"
    },
    {
      name  = "AIRFLOW__CORE__LOAD_EXAMPLES"
      value = "False"
    },
    {
      name  = "AIRFLOW__CORE__DAGS_ARE_PAUSED_AT_CREATION"
      value = "False"
    },
    {
      name  = "AIRFLOW__CORE__SIMPLE_AUTH_MANAGER_USERS"
      value = "admin:admin,viewer:viewer"
    },
    {
      name  = "AIRFLOW__CORE__SIMPLE_AUTH_MANAGER_PASSWORDS_FILE"
      value = "/opt/airflow/auth/simple_auth_manager_passwords.json.generated"
    },
    {
      name  = "AIRFLOW__CORE__DAGS_FOLDER"
      value = "/opt/airflow/src/dags"
    },
    {
      name  = "AIRFLOW__LOGGING__BASE_LOG_FOLDER"
      value = "/opt/airflow/logs"
    },
    {
      name  = "PIPELINE_STAGE_EXECUTION_MODE"
      value = "ecs"
    },
    {
      name  = "PIPELINE_BACKEND_BASE_URL"
      value = "https://api.${var.domain_name}"
    },
    {
      name  = "PIPELINE_ARTIFACT_ROOT"
      value = "/opt/airflow/artifacts"
    },
    {
      name  = "PIPELINE_CALLBACK_ENABLED"
      value = "true"
    },
    {
      name  = "PIPELINE_CALLBACK_TIMEOUT_SECONDS"
      value = "10"
    },
    {
      name  = "ML_ARTIFACT_STORE"
      value = "s3"
    },
    {
      name  = "ML_ARTIFACT_BUCKET"
      value = aws_s3_bucket.buckets["ml_artifacts"].bucket
    },
    {
      name  = "ML_ARTIFACT_PREFIX"
      value = "domain-pack"
    },
    {
      name  = "ML_EMBEDDING_RUNTIME"
      value = "flag_embedding"
    },
    {
      name  = "EMBEDDING_MODEL_NAME"
      value = var.embedding_model_name
    },
    {
      name  = "ML_RUNTIME_PROFILE"
      value = var.ml_runtime_profile
    },
    {
      name  = "GPU_TASK_MODE"
      value = "run_task"
    },
    {
      name  = "PIPELINE_ECS_CLUSTER"
      value = aws_ecs_cluster.main.name
    },
    {
      name  = "PIPELINE_ECS_CPU_TASK_DEFINITION"
      value = aws_ecs_task_definition.ml_stage_cpu.arn
    },
    {
      name  = "PIPELINE_ECS_CPU_CONTAINER_NAME"
      value = "ml-stage-cpu"
    },
    {
      name  = "PIPELINE_ECS_GPU_TASK_DEFINITION"
      value = aws_ecs_task_definition.ml_stage_gpu.arn
    },
    {
      name  = "PIPELINE_ECS_GPU_CONTAINER_NAME"
      value = "ml-stage-gpu"
    },
    {
      name  = "PIPELINE_ECS_GPU_CAPACITY_PROVIDER"
      value = aws_ecs_capacity_provider.gpu.name
    },
    {
      name  = "PIPELINE_ECS_SUBNET_IDS"
      value = join(",", values(aws_subnet.private)[*].id)
    },
    {
      name  = "PIPELINE_ECS_SECURITY_GROUP_IDS"
      value = aws_security_group.gpu_task.id
    },
    {
      name  = "PIPELINE_ECS_RESULT_BUCKET"
      value = aws_s3_bucket.buckets["ml_artifacts"].bucket
    },
    {
      name  = "PIPELINE_ECS_RESULT_PREFIX"
      value = "ecs-stage-results"
    },
    {
      name  = "PIPELINE_ECS_GPU_STAGES"
      value = "representation"
    },
    {
      name  = "LLM_MODEL_NAME"
      value = var.llm_model_name
    },
    {
      name  = "LLM_RUNTIME_BASE_URL"
      value = "http://${aws_lb.ml_llm_internal.dns_name}:${var.llm_service_container_port}/v1"
    },
    {
      name  = "S3_EXPECTED_BUCKET_OWNER"
      value = data.aws_caller_identity.current.account_id
    },
    {
      name  = "AWS_REGION"
      value = var.aws_region
    },
    {
      name  = "AWS_DEFAULT_REGION"
      value = var.aws_region
    },
    {
      name  = "PYTHONPATH"
      value = "/opt/airflow/src"
    }
  ]

  airflow_secrets = [
    {
      name      = "AIRFLOW__DATABASE__SQL_ALCHEMY_CONN"
      valueFrom = "${aws_secretsmanager_secret.app.arn}:airflow_sql_alchemy_conn::"
    },
    {
      name      = "AIRFLOW__DATABASE__SQL_ALCHEMY_CONN_ASYNC"
      valueFrom = "${aws_secretsmanager_secret.app.arn}:airflow_sql_alchemy_conn_async::"
    },
    {
      name      = "AIRFLOW__CORE__FERNET_KEY"
      valueFrom = "${aws_secretsmanager_secret.app.arn}:airflow_fernet_key::"
    },
    {
      name      = "AIRFLOW__API__SECRET_KEY"
      valueFrom = "${aws_secretsmanager_secret.app.arn}:airflow_api_secret_key::"
    },
    {
      name      = "AIRFLOW__API_AUTH__JWT_SECRET"
      valueFrom = "${aws_secretsmanager_secret.app.arn}:airflow_api_auth_jwt_secret::"
    },
    {
      name      = "AIRFLOW_SIMPLE_ADMIN_PASSWORD"
      valueFrom = "${aws_secretsmanager_secret.app.arn}:airflow_simple_admin_password::"
    },
    {
      name      = "AIRFLOW_SIMPLE_VIEWER_PASSWORD"
      valueFrom = "${aws_secretsmanager_secret.app.arn}:airflow_simple_viewer_password::"
    },
    {
      name      = "AIRFLOW_WEBHOOK_SECRET"
      valueFrom = "${aws_secretsmanager_secret.app.arn}:airflow_webhook_secret::"
    },
    {
      name      = "LLM_RUNTIME_API_KEY"
      valueFrom = "${aws_secretsmanager_secret.app.arn}:llm_runtime_api_key::"
    }
  ]
}

resource "aws_ecs_task_definition" "airflow_init" {
  family                   = "${local.name_prefix}-airflow-init-task"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "1024"
  memory                   = "2048"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_airflow_task.arn

  container_definitions = jsonencode([
    {
      name      = "airflow-init"
      image     = "${aws_ecr_repository.repos["airflow"].repository_url}:latest"
      essential = true
      entryPoint = [
        "/opt/airflow/scripts/init-airflow.sh"
      ]
      environment = local.airflow_environment
      secrets     = local.airflow_secrets
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.airflow.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "init"
          "awslogs-create-group"  = "true"
        }
      }
    }
  ])

  tags = local.common_tags
}

resource "aws_ecs_task_definition" "airflow_apiserver" {
  family                   = "${local.name_prefix}-airflow-apiserver-task"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "1024"
  memory                   = "2048"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_airflow_task.arn

  container_definitions = jsonencode([
    {
      name      = "airflow-apiserver"
      image     = "${aws_ecr_repository.repos["airflow"].repository_url}:latest"
      essential = true
      command   = ["airflow", "api-server"]
      portMappings = [
        {
          containerPort = 8080
          protocol      = "tcp"
        }
      ]
      environment = local.airflow_environment
      secrets     = local.airflow_secrets
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.airflow.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "apiserver"
          "awslogs-create-group"  = "true"
        }
      }
    }
  ])

  tags = local.common_tags
}

resource "aws_ecs_task_definition" "airflow_scheduler" {
  family                   = "${local.name_prefix}-airflow-scheduler-task"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "1024"
  memory                   = "2048"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_airflow_task.arn

  container_definitions = jsonencode([
    {
      name        = "airflow-scheduler"
      image       = "${aws_ecr_repository.repos["airflow"].repository_url}:latest"
      essential   = true
      command     = ["airflow", "scheduler"]
      environment = local.airflow_environment
      secrets     = local.airflow_secrets
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.airflow.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "scheduler"
          "awslogs-create-group"  = "true"
        }
      }
    }
  ])

  tags = local.common_tags
}

resource "aws_ecs_task_definition" "airflow_dag_processor" {
  family                   = "${local.name_prefix}-airflow-dag-processor-task"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "1024"
  memory                   = "2048"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_airflow_task.arn

  container_definitions = jsonencode([
    {
      name        = "airflow-dag-processor"
      image       = "${aws_ecr_repository.repos["airflow"].repository_url}:latest"
      essential   = true
      command     = ["airflow", "dag-processor"]
      environment = local.airflow_environment
      secrets     = local.airflow_secrets
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.airflow.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "dag-processor"
          "awslogs-create-group"  = "true"
        }
      }
    }
  ])

  tags = local.common_tags
}

resource "aws_ecs_service" "airflow_apiserver" {
  name             = "ostone-airflow-apiserver"
  cluster          = aws_ecs_cluster.main.id
  task_definition  = aws_ecs_task_definition.airflow_apiserver.arn
  desired_count    = var.airflow_api_desired_count
  launch_type      = "FARGATE"
  platform_version = "LATEST"

  health_check_grace_period_seconds = 120

  network_configuration {
    subnets          = values(aws_subnet.private)[*].id
    security_groups  = [aws_security_group.ecs_airflow.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.airflow_api.arn
    container_name   = "airflow-apiserver"
    container_port   = 8080
  }

  service_registries {
    registry_arn = aws_service_discovery_service.airflow_api.arn
  }

  depends_on = [
    aws_lb_listener_rule.airflow_admin,
    terraform_data.db_bootstrap
  ]

  lifecycle {
    ignore_changes = [task_definition]
  }
}

resource "aws_ecs_service" "airflow_scheduler" {
  name             = "ostone-airflow-scheduler"
  cluster          = aws_ecs_cluster.main.id
  task_definition  = aws_ecs_task_definition.airflow_scheduler.arn
  desired_count    = var.airflow_scheduler_desired_count
  launch_type      = "FARGATE"
  platform_version = "LATEST"

  network_configuration {
    subnets          = values(aws_subnet.private)[*].id
    security_groups  = [aws_security_group.ecs_airflow.id]
    assign_public_ip = false
  }

  depends_on = [terraform_data.db_bootstrap]

  lifecycle {
    ignore_changes = [task_definition]
  }
}

resource "aws_ecs_service" "airflow_dag_processor" {
  name             = "ostone-airflow-dag-processor"
  cluster          = aws_ecs_cluster.main.id
  task_definition  = aws_ecs_task_definition.airflow_dag_processor.arn
  desired_count    = var.airflow_dag_processor_desired_count
  launch_type      = "FARGATE"
  platform_version = "LATEST"

  network_configuration {
    subnets          = values(aws_subnet.private)[*].id
    security_groups  = [aws_security_group.ecs_airflow.id]
    assign_public_ip = false
  }

  depends_on = [terraform_data.db_bootstrap]

  lifecycle {
    ignore_changes = [task_definition]
  }
}
