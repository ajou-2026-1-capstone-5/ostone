resource "aws_lb" "ml_llm_internal" {
  name               = "${local.name_prefix}-ml-llm-alb"
  internal           = true
  load_balancer_type = "application"
  security_groups    = [aws_security_group.ml_llm_alb.id]
  subnets            = values(aws_subnet.private)[*].id

  enable_deletion_protection = false

  tags = local.common_tags
}

resource "aws_lb_target_group" "ml_llm" {
  name        = "${local.name_prefix}-ml-llm-tg"
  port        = var.llm_service_container_port
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 5
    interval            = 30
    timeout             = 10
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    matcher             = "200-499"
  }

  tags = local.common_tags
}

resource "aws_lb_listener" "ml_llm" {
  load_balancer_arn = aws_lb.ml_llm_internal.arn
  port              = var.llm_service_container_port
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.ml_llm.arn
  }
}

resource "aws_ecs_task_definition" "ml_llm" {
  family                   = "${local.name_prefix}-ml-llm-service"
  network_mode             = "awsvpc"
  requires_compatibilities = ["EC2"]
  cpu                      = "4096"
  memory                   = "16384"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.gpu_task.arn

  volume {
    name      = "model-cache"
    host_path = "/opt/ostone/model-cache"
  }

  container_definitions = jsonencode([
    {
      name      = "ml-llm"
      image     = "${aws_ecr_repository.repos["ml_llm"].repository_url}:latest"
      essential = true
      portMappings = [
        {
          containerPort = var.llm_service_container_port
          protocol      = "tcp"
        }
      ]
      mountPoints = [
        {
          sourceVolume  = "model-cache"
          containerPath = "/models"
          readOnly      = false
        }
      ]
      environment = [
        {
          name  = "LLM_MODEL_NAME"
          value = var.llm_model_name
        },
        {
          name  = "LLM_MODEL_PATH"
          value = var.llm_model_path
        },
        {
          name  = "LLM_SERVER_HOST"
          value = "0.0.0.0"
        },
        {
          name  = "LLM_SERVER_PORT"
          value = tostring(var.llm_service_container_port)
        },
        {
          name  = "S3_EXPECTED_BUCKET_OWNER"
          value = data.aws_caller_identity.current.account_id
        }
      ]
      secrets = [
        {
          name      = "LLM_RUNTIME_API_KEY"
          valueFrom = "${aws_secretsmanager_secret.app.arn}:llm_runtime_api_key::"
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ml_llm.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "llm"
          "awslogs-create-group"  = "true"
        }
      }
      resourceRequirements = [
        {
          type  = "GPU"
          value = "1"
        }
      ]
      cpu    = 0
      memory = 16384
    }
  ])

  tags = local.common_tags
}

resource "aws_ecs_service" "ml_llm" {
  name            = "${local.name_prefix}-ml-llm"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.ml_llm.arn
  desired_count   = var.llm_service_desired_count

  capacity_provider_strategy {
    capacity_provider = aws_ecs_capacity_provider.gpu.name
    weight            = 1
  }

  network_configuration {
    subnets          = local.gpu_private_subnet_ids
    security_groups  = [aws_security_group.ml_llm_service.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.ml_llm.arn
    container_name   = "ml-llm"
    container_port   = var.llm_service_container_port
  }

  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 100

  depends_on = [aws_lb_listener.ml_llm]
}
