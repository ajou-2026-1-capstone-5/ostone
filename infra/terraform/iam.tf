locals {
  all_bucket_arns = concat(
    [for bucket in aws_s3_bucket.buckets : bucket.arn],
    [for bucket in aws_s3_bucket.buckets : "${bucket.arn}/*"]
  )

  ml_bucket_arns = [
    aws_s3_bucket.buckets["ml_artifacts"].arn,
    "${aws_s3_bucket.buckets["ml_artifacts"].arn}/*",
    aws_s3_bucket.buckets["ml_input"].arn,
    "${aws_s3_bucket.buckets["ml_input"].arn}/*",
    aws_s3_bucket.buckets["ml_output"].arn,
    "${aws_s3_bucket.buckets["ml_output"].arn}/*"
  ]

  secrets_resource_arns = distinct(concat([aws_secretsmanager_secret.app.arn], var.secret_arns))
}

data "aws_iam_policy_document" "ecs_tasks_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "ec2_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecs_task_execution" {
  name                 = "${local.name_prefix}-ecs-task-execution-role"
  assume_role_policy   = data.aws_iam_policy_document.ecs_tasks_assume_role.json
  permissions_boundary = var.permissions_boundary_arn

  tags = {
    Name = "${local.name_prefix}-ecs-task-execution-role"
  }
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_managed" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "ecs_task_execution_custom" {
  statement {
    sid = "EcrPull"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer"
    ]
    resources = [for repo in aws_ecr_repository.repos : repo.arn]
  }

  statement {
    sid       = "EcrAuth"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid = "CloudWatchLogs"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]
    resources = ["arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/ecs/${local.name_prefix}*:*"]
  }

  statement {
    sid       = "ReadTaskSecrets"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = local.secrets_resource_arns
  }
}

resource "aws_iam_role_policy" "ecs_task_execution_custom" {
  name   = "${local.name_prefix}-ecs-task-execution-policy"
  role   = aws_iam_role.ecs_task_execution.id
  policy = data.aws_iam_policy_document.ecs_task_execution_custom.json
}

resource "aws_iam_role" "ecs_backend_task" {
  name                 = "${local.name_prefix}-ecs-backend-task-role"
  assume_role_policy   = data.aws_iam_policy_document.ecs_tasks_assume_role.json
  permissions_boundary = var.permissions_boundary_arn

  tags = {
    Name = "${local.name_prefix}-ecs-backend-task-role"
  }
}

data "aws_iam_policy_document" "ecs_backend_task" {
  statement {
    sid = "S3ReadWrite"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:ListBucket"
    ]
    resources = local.all_bucket_arns
  }

  statement {
    sid = "CloudWatchLogs"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
      "logs:DescribeLogStreams"
    ]
    resources = ["arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/ecs/${local.name_prefix}*:*"]
  }

  statement {
    sid       = "ReadSecrets"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = local.secrets_resource_arns
  }

  statement {
    sid       = "InvokeBedrockEmbeddingModel"
    actions   = ["bedrock:InvokeModel"]
    resources = ["arn:aws:bedrock:${var.ai_embedding_bedrock_region}::foundation-model/${var.ai_embedding_model}"]
  }
}

resource "aws_iam_role_policy" "ecs_backend_task" {
  name   = "${local.name_prefix}-ecs-backend-task-policy"
  role   = aws_iam_role.ecs_backend_task.id
  policy = data.aws_iam_policy_document.ecs_backend_task.json
}

resource "aws_iam_role" "ec2_airflow" {
  name                 = "${local.name_prefix}-ec2-airflow-role"
  assume_role_policy   = data.aws_iam_policy_document.ec2_assume_role.json
  permissions_boundary = var.permissions_boundary_arn

  tags = {
    Name = "${local.name_prefix}-ec2-airflow-role"
  }
}

resource "aws_iam_instance_profile" "ec2_airflow" {
  name = "${local.name_prefix}-ec2-airflow-profile"
  role = aws_iam_role.ec2_airflow.name

  tags = {
    Name = "${local.name_prefix}-ec2-airflow-profile"
  }
}

resource "aws_iam_role" "gpu_ec2_instance" {
  name                 = "${local.name_prefix}-gpu-ec2-instance-role"
  assume_role_policy   = data.aws_iam_policy_document.ec2_assume_role.json
  permissions_boundary = var.permissions_boundary_arn

  tags = {
    Name = "${local.name_prefix}-gpu-ec2-instance-role"
  }
}

resource "aws_iam_role_policy_attachment" "gpu_ec2_instance_ecs" {
  role       = aws_iam_role.gpu_ec2_instance.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
}

data "aws_iam_policy_document" "ec2_airflow" {
  statement {
    sid = "RunGpuTasks"
    actions = [
      "ecs:RunTask",
      "ecs:DescribeTasks",
      "ecs:DescribeServices",
      "ecs:StopTask",
      "ecs:DescribeTaskDefinition",
      "ecs:ListTasks",
      "ecs:UpdateService"
    ]
    resources = ["*"]
  }

  statement {
    sid     = "PassGpuTaskRoles"
    actions = ["iam:PassRole"]
    resources = [
      aws_iam_role.ecs_task_execution.arn,
      aws_iam_role.gpu_task.arn
    ]

    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["ecs-tasks.amazonaws.com"]
    }
  }

  statement {
    sid = "S3FullAccessProjectBuckets"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:ListBucket"
    ]
    resources = local.all_bucket_arns
  }

  statement {
    sid       = "ReadDatabaseSecrets"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = local.secrets_resource_arns
  }

  statement {
    sid = "MountEmbeddingModelCache"
    actions = [
      "elasticfilesystem:ClientMount",
      "elasticfilesystem:ClientWrite"
    ]
    resources = [aws_efs_file_system.embedding_model_cache.arn]
  }

  statement {
    sid = "CloudWatchLogs"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
      "logs:DescribeLogGroups",
      "logs:DescribeLogStreams"
    ]
    resources = ["arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/airflow/${local.name_prefix}*:*"]
  }
}

resource "aws_iam_role_policy" "ec2_airflow" {
  name   = "${local.name_prefix}-ec2-airflow-policy"
  role   = aws_iam_role.ec2_airflow.id
  policy = data.aws_iam_policy_document.ec2_airflow.json
}

resource "aws_iam_role" "ecs_airflow_task" {
  name                 = "${local.name_prefix}-ecs-airflow-task-role"
  assume_role_policy   = data.aws_iam_policy_document.ecs_tasks_assume_role.json
  permissions_boundary = var.permissions_boundary_arn

  tags = {
    Name = "${local.name_prefix}-ecs-airflow-task-role"
  }
}

data "aws_iam_policy_document" "ecs_airflow_task" {
  statement {
    sid = "RunStageTasks"
    actions = [
      "ecs:RunTask",
      "ecs:DescribeTasks",
      "ecs:StopTask",
      "ecs:DescribeTaskDefinition"
    ]
    resources = ["*"]
  }

  statement {
    sid     = "PassStageTaskRoles"
    actions = ["iam:PassRole"]
    resources = [
      aws_iam_role.ecs_task_execution.arn,
      aws_iam_role.gpu_task.arn
    ]

    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["ecs-tasks.amazonaws.com"]
    }
  }

  statement {
    sid = "S3ReadWriteProjectBuckets"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:ListBucket"
    ]
    resources = local.all_bucket_arns
  }

  statement {
    sid       = "ReadAirflowSecrets"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = local.secrets_resource_arns
  }

  statement {
    sid = "CloudWatchLogs"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
      "logs:DescribeLogStreams"
    ]
    resources = ["arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/ecs/${local.name_prefix}*:*"]
  }
}

resource "aws_iam_role_policy" "ecs_airflow_task" {
  name   = "${local.name_prefix}-ecs-airflow-task-policy"
  role   = aws_iam_role.ecs_airflow_task.id
  policy = data.aws_iam_policy_document.ecs_airflow_task.json
}

resource "aws_iam_role" "gpu_task" {
  name                 = "${local.name_prefix}-gpu-task-role"
  assume_role_policy   = data.aws_iam_policy_document.ecs_tasks_assume_role.json
  permissions_boundary = var.permissions_boundary_arn

  tags = {
    Name = "${local.name_prefix}-gpu-task-role"
  }
}

data "aws_iam_policy_document" "gpu_task" {
  statement {
    sid = "S3ReadWriteMlBuckets"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:ListBucket"
    ]
    resources = local.ml_bucket_arns
  }

  statement {
    sid = "MountEmbeddingModelCache"
    actions = [
      "elasticfilesystem:ClientMount",
      "elasticfilesystem:ClientWrite"
    ]
    resources = [aws_efs_file_system.embedding_model_cache.arn]
  }

  statement {
    sid = "CloudWatchLogs"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
      "logs:DescribeLogStreams"
    ]
    resources = ["arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/ecs/${local.name_prefix}/*:*"]
  }
}

resource "aws_iam_role_policy" "gpu_task" {
  name   = "${local.name_prefix}-gpu-task-policy"
  role   = aws_iam_role.gpu_task.id
  policy = data.aws_iam_policy_document.gpu_task.json
}
