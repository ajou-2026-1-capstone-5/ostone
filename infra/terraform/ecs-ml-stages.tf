resource "aws_cloudwatch_log_group" "ml_stage_cpu" {
  name              = "/ecs/${local.name_prefix}/ml-stage-cpu"
  retention_in_days = 30
  kms_key_id        = aws_kms_key.observability.arn

  tags = local.common_tags
}

resource "aws_cloudwatch_log_group" "ml_stage_gpu" {
  name              = "/ecs/${local.name_prefix}/ml-stage-gpu"
  retention_in_days = 30
  kms_key_id        = aws_kms_key.observability.arn

  tags = local.common_tags
}

resource "aws_ecs_task_definition" "ml_stage_cpu" {
  family                   = "${local.name_prefix}-ml-stage-cpu-task"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "2048"
  memory                   = "8192"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.gpu_task.arn

  container_definitions = jsonencode([
    {
      name      = "ml-stage-cpu"
      image     = "${aws_ecr_repository.repos["ml_stage_cpu"].repository_url}:latest"
      essential = true
      environment = [
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
          name  = "S3_EXPECTED_BUCKET_OWNER"
          value = data.aws_caller_identity.current.account_id
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ml_stage_cpu.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "stage"
          "awslogs-create-group"  = "true"
        }
      }
      cpu    = 0
      memory = 8192
    }
  ])

  tags = local.common_tags
}

resource "aws_ecs_task_definition" "ml_stage_gpu" {
  family                   = "${local.name_prefix}-ml-stage-gpu-task"
  network_mode             = "awsvpc"
  requires_compatibilities = ["EC2"]
  cpu                      = "4096"
  memory                   = "16384"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.gpu_task.arn

  volume {
    name = "embedding-model-cache"

    efs_volume_configuration {
      file_system_id     = aws_efs_file_system.embedding_model_cache.id
      transit_encryption = "ENABLED"

      authorization_config {
        access_point_id = aws_efs_access_point.embedding_model_cache.id
        iam             = "ENABLED"
      }
    }
  }

  container_definitions = jsonencode([
    {
      name      = "ml-stage-gpu"
      image     = "${aws_ecr_repository.repos["ml_stage_gpu"].repository_url}:latest"
      essential = true
      mountPoints = [
        {
          sourceVolume  = "embedding-model-cache"
          containerPath = var.embedding_model_cache_mount_path
          readOnly      = false
        }
      ]
      environment = [
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
          name  = "HF_HOME"
          value = var.embedding_model_cache_mount_path
        },
        {
          name  = "S3_EXPECTED_BUCKET_OWNER"
          value = data.aws_caller_identity.current.account_id
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ml_stage_gpu.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "stage"
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
