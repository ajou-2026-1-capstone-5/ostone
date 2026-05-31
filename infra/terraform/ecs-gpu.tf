data "aws_ssm_parameter" "ecs_gpu_ami" {
  name = "/aws/service/ecs/optimized-ami/amazon-linux-2/gpu/recommended/image_id"
}

resource "aws_iam_instance_profile" "gpu" {
  name = "${local.name_prefix}-gpu-instance-profile"
  role = aws_iam_role.gpu_ec2_instance.name

  tags = {
    Name = "${local.name_prefix}-gpu-instance-profile"
  }
}

resource "aws_launch_template" "gpu" {
  name          = "${local.name_prefix}-gpu-launch-template"
  image_id      = data.aws_ssm_parameter.ecs_gpu_ami.value
  instance_type = var.gpu_instance_type
  iam_instance_profile {
    name = aws_iam_instance_profile.gpu.name
  }
  key_name               = var.admin_key_name
  vpc_security_group_ids = [aws_security_group.gpu_host.id]

  user_data = base64encode(templatefile("${path.module}/scripts/ecs-gpu-user-data.sh", {
    cluster_name = aws_ecs_cluster.main.name
  }))

  tag_specifications {
    resource_type = "instance"
    tags = merge(local.common_tags, {
      Name = "${local.name_prefix}-gpu-host"
    })
  }

  block_device_mappings {
    device_name = "/dev/xvda"
    ebs {
      volume_type = "gp3"
      volume_size = var.gpu_root_volume_size
      encrypted   = true
    }
  }

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
  }

  monitoring {
    enabled = true
  }

  tags = local.common_tags
}

resource "aws_autoscaling_group" "gpu" {
  name = "${local.name_prefix}-gpu-asg"
  launch_template {
    id      = aws_launch_template.gpu.id
    version = "$Latest"
  }
  vpc_zone_identifier       = values(aws_subnet.private)[*].id
  min_size                  = var.gpu_asg_min_size
  max_size                  = var.gpu_asg_max_size
  desired_capacity          = var.gpu_asg_desired_capacity
  health_check_type         = "EC2"
  health_check_grace_period = 300
  protect_from_scale_in     = false

  tag {
    key                 = "Name"
    value               = "${local.name_prefix}-gpu-host"
    propagate_at_launch = true
  }

  tag {
    key                 = "ManagedBy"
    value               = "terraform"
    propagate_at_launch = true
  }
}

resource "aws_ecs_capacity_provider" "gpu" {
  name = "${local.name_prefix}-gpu-capacity-provider"

  auto_scaling_group_provider {
    auto_scaling_group_arn = aws_autoscaling_group.gpu.arn

    managed_scaling {
      status                    = "ENABLED"
      target_capacity           = 100
      minimum_scaling_step_size = 1
      maximum_scaling_step_size = 1
      instance_warmup_period    = 300
    }

    managed_termination_protection = "DISABLED"
  }
}

resource "aws_cloudwatch_log_group" "ml_embedder" {
  name              = "/ecs/${local.name_prefix}/ml-embedder"
  retention_in_days = 30
  kms_key_id        = aws_kms_key.observability.arn

  tags = local.common_tags
}

resource "aws_cloudwatch_log_group" "ml_llm" {
  name              = "/ecs/${local.name_prefix}/ml-llm"
  retention_in_days = 30
  kms_key_id        = aws_kms_key.observability.arn

  tags = local.common_tags
}

resource "aws_ecs_task_definition" "ml_embedder" {
  family                   = "${local.name_prefix}-ml-embedder-task"
  network_mode             = "awsvpc"
  requires_compatibilities = ["EC2"]
  cpu                      = "4096"
  memory                   = "16384"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.gpu_task.arn

  container_definitions = jsonencode([
    {
      name      = "ml-embedder"
      image     = "${aws_ecr_repository.repos["ml_embedder"].repository_url}:latest"
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
          name  = "S3_EXPECTED_BUCKET_OWNER"
          value = data.aws_caller_identity.current.account_id
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ml_embedder.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "embedder"
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
