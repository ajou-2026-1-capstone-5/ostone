resource "aws_security_group" "alb" {
  name        = "${local.name_prefix}-alb-sg"
  description = "Allow public HTTP and HTTPS traffic to the ALB."
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-alb-sg"
  }
}

resource "aws_security_group_rule" "alb_http_ingress" {
  type              = "ingress"
  security_group_id = aws_security_group.alb.id
  description       = "HTTP ingress for redirect to HTTPS."
  from_port         = 80
  to_port           = 80
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
}

resource "aws_security_group_rule" "alb_https_ingress" {
  type              = "ingress"
  security_group_id = aws_security_group.alb.id
  description       = "HTTPS ingress."
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
}

resource "aws_security_group_rule" "alb_egress" {
  type                     = "egress"
  security_group_id        = aws_security_group.alb.id
  description              = "Allow outbound traffic to backend on 8080."
  from_port                = 8080
  to_port                  = 8080
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.ecs_backend.id
}

resource "aws_security_group_rule" "alb_egress_airflow" {
  type                     = "egress"
  security_group_id        = aws_security_group.alb.id
  description              = "Allow outbound traffic to Airflow API on 8080."
  from_port                = 8080
  to_port                  = 8080
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.ecs_airflow.id
}

resource "aws_security_group" "ecs_backend" {
  name        = "${local.name_prefix}-ecs-backend-sg"
  description = "Allow backend traffic from the ALB."
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-ecs-backend-sg"
  }
}

resource "aws_security_group_rule" "ecs_backend_ingress" {
  type                     = "ingress"
  security_group_id        = aws_security_group.ecs_backend.id
  source_security_group_id = aws_security_group.alb.id
  description              = "Backend service traffic from ALB."
  from_port                = 8080
  to_port                  = 8080
  protocol                 = "tcp"
}

resource "aws_security_group_rule" "ecs_backend_egress_rds" {
  type                     = "egress"
  security_group_id        = aws_security_group.ecs_backend.id
  description              = "Allow outbound traffic to RDS PostgreSQL."
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.rds.id
}

resource "aws_security_group_rule" "ecs_backend_egress_https" {
  type              = "egress"
  security_group_id = aws_security_group.ecs_backend.id
  description       = "Allow outbound HTTPS traffic for SDK/API calls."
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
}

resource "aws_security_group_rule" "ecs_backend_egress_airflow" {
  type                     = "egress"
  security_group_id        = aws_security_group.ecs_backend.id
  description              = "Allow backend to call the private Airflow API."
  from_port                = 8080
  to_port                  = 8080
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.ecs_airflow.id
}

resource "aws_security_group" "ecs_airflow" {
  name        = "${local.name_prefix}-ecs-airflow-sg"
  description = "Airflow ECS service security group."
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-ecs-airflow-sg"
  }
}

resource "aws_security_group_rule" "ecs_airflow_ingress_alb" {
  type                     = "ingress"
  security_group_id        = aws_security_group.ecs_airflow.id
  source_security_group_id = aws_security_group.alb.id
  description              = "Airflow UI/API traffic from ALB."
  from_port                = 8080
  to_port                  = 8080
  protocol                 = "tcp"
}

resource "aws_security_group_rule" "ecs_airflow_ingress_backend" {
  type                     = "ingress"
  security_group_id        = aws_security_group.ecs_airflow.id
  source_security_group_id = aws_security_group.ecs_backend.id
  description              = "Private Airflow API traffic from backend ECS."
  from_port                = 8080
  to_port                  = 8080
  protocol                 = "tcp"
}

resource "aws_security_group_rule" "ecs_airflow_ingress_self_execution_api" {
  type                     = "ingress"
  security_group_id        = aws_security_group.ecs_airflow.id
  source_security_group_id = aws_security_group.ecs_airflow.id
  description              = "Airflow task execution API traffic between Airflow ECS services."
  from_port                = 8080
  to_port                  = 8080
  protocol                 = "tcp"
}

resource "aws_security_group_rule" "ecs_airflow_ingress_self_worker_logs" {
  type                     = "ingress"
  security_group_id        = aws_security_group.ecs_airflow.id
  source_security_group_id = aws_security_group.ecs_airflow.id
  description              = "Airflow served task log traffic between Airflow ECS services."
  from_port                = 8793
  to_port                  = 8793
  protocol                 = "tcp"
}

resource "aws_security_group_rule" "ecs_airflow_egress_rds" {
  type                     = "egress"
  security_group_id        = aws_security_group.ecs_airflow.id
  description              = "Allow Airflow ECS to reach RDS PostgreSQL."
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.rds.id
}

resource "aws_security_group_rule" "ecs_airflow_egress_self_execution_api" {
  type                     = "egress"
  security_group_id        = aws_security_group.ecs_airflow.id
  source_security_group_id = aws_security_group.ecs_airflow.id
  description              = "Allow Airflow ECS services to call the execution API."
  from_port                = 8080
  to_port                  = 8080
  protocol                 = "tcp"
}

resource "aws_security_group_rule" "ecs_airflow_egress_self_worker_logs" {
  type                     = "egress"
  security_group_id        = aws_security_group.ecs_airflow.id
  source_security_group_id = aws_security_group.ecs_airflow.id
  description              = "Allow Airflow ECS services to fetch served task logs."
  from_port                = 8793
  to_port                  = 8793
  protocol                 = "tcp"
}

resource "aws_security_group_rule" "ecs_airflow_egress_https" {
  type              = "egress"
  security_group_id = aws_security_group.ecs_airflow.id
  description       = "Allow Airflow ECS to reach AWS APIs and backend callbacks over HTTPS."
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
}

resource "aws_security_group" "ec2_airflow" {
  name        = "${local.name_prefix}-ec2-airflow-sg"
  description = "Allow Airflow SSH from admin CIDR and web traffic from ALB."
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-ec2-airflow-sg"
  }
}

resource "aws_security_group_rule" "ec2_airflow_ssh_ingress" {
  type              = "ingress"
  security_group_id = aws_security_group.ec2_airflow.id
  description       = "SSH ingress from administrator CIDR."
  from_port         = 22
  to_port           = 22
  protocol          = "tcp"
  cidr_blocks       = [var.admin_cidr]
}

resource "aws_security_group_rule" "ec2_airflow_web_ingress" {
  type                     = "ingress"
  security_group_id        = aws_security_group.ec2_airflow.id
  source_security_group_id = aws_security_group.alb.id
  description              = "Airflow web traffic from ALB."
  from_port                = 8080
  to_port                  = 8080
  protocol                 = "tcp"
}

resource "aws_security_group_rule" "ec2_airflow_egress_rds" {
  type                     = "egress"
  security_group_id        = aws_security_group.ec2_airflow.id
  description              = "Allow outbound traffic to RDS PostgreSQL."
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.rds.id
}

resource "aws_security_group_rule" "ec2_airflow_egress_ml_llm" {
  type                     = "egress"
  security_group_id        = aws_security_group.ec2_airflow.id
  description              = "Allow Airflow to call the internal LLM service."
  from_port                = var.llm_service_container_port
  to_port                  = var.llm_service_container_port
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.ml_llm_alb.id
}

resource "aws_security_group_rule" "ec2_airflow_egress_https" {
  type              = "egress"
  security_group_id = aws_security_group.ec2_airflow.id
  description       = "Allow outbound HTTPS traffic for SDK/API calls."
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
}

resource "aws_security_group_rule" "ec2_airflow_egress_efs_model_cache" {
  type                     = "egress"
  security_group_id        = aws_security_group.ec2_airflow.id
  description              = "Allow Airflow EC2 to mount the embedding model cache EFS."
  from_port                = 2049
  to_port                  = 2049
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.efs_model_cache.id
}

resource "aws_security_group" "rds" {
  name        = "${local.name_prefix}-rds-sg"
  description = "Allow PostgreSQL from backend ECS and Airflow EC2 only."
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-rds-sg"
  }
}

resource "aws_security_group_rule" "rds_ecs_backend_ingress" {
  type                     = "ingress"
  security_group_id        = aws_security_group.rds.id
  source_security_group_id = aws_security_group.ecs_backend.id
  description              = "PostgreSQL from backend ECS tasks."
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
}

resource "aws_security_group_rule" "rds_ec2_airflow_ingress" {
  type                     = "ingress"
  security_group_id        = aws_security_group.rds.id
  source_security_group_id = aws_security_group.ec2_airflow.id
  description              = "PostgreSQL from Airflow EC2."
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
}

resource "aws_security_group_rule" "rds_ecs_airflow_ingress" {
  type                     = "ingress"
  security_group_id        = aws_security_group.rds.id
  source_security_group_id = aws_security_group.ecs_airflow.id
  description              = "PostgreSQL from Airflow ECS tasks."
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
}

resource "aws_security_group" "gpu_host" {
  name        = "${local.name_prefix}-gpu-host-sg"
  description = "GPU ECS host security group."
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-gpu-host-sg"
  }
}

resource "aws_security_group_rule" "gpu_host_egress_https" {
  type              = "egress"
  security_group_id = aws_security_group.gpu_host.id
  description       = "Allow GPU ECS hosts to reach AWS APIs and ECR via NAT."
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
}

resource "aws_security_group_rule" "gpu_host_egress_efs_model_cache" {
  type                     = "egress"
  security_group_id        = aws_security_group.gpu_host.id
  description              = "Allow GPU ECS hosts to mount the embedding model cache EFS."
  from_port                = 2049
  to_port                  = 2049
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.efs_model_cache.id
}

resource "aws_security_group" "gpu_task" {
  name        = "${local.name_prefix}-gpu-task-sg"
  description = "One-shot GPU batch task security group."
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-gpu-task-sg"
  }
}

resource "aws_security_group_rule" "gpu_task_egress" {
  type              = "egress"
  security_group_id = aws_security_group.gpu_task.id
  description       = "Allow outbound HTTPS traffic for S3/ECR via NAT."
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
}

resource "aws_security_group_rule" "gpu_task_egress_efs_model_cache" {
  type                     = "egress"
  security_group_id        = aws_security_group.gpu_task.id
  description              = "Allow GPU tasks to mount the embedding model cache EFS."
  from_port                = 2049
  to_port                  = 2049
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.efs_model_cache.id
}

resource "aws_security_group_rule" "gpu_task_egress_ml_llm" {
  type                     = "egress"
  security_group_id        = aws_security_group.gpu_task.id
  description              = "Allow stage tasks to call the internal LLM service."
  from_port                = var.llm_service_container_port
  to_port                  = var.llm_service_container_port
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.ml_llm_alb.id
}

resource "aws_security_group" "efs_model_cache" {
  name        = "${local.name_prefix}-efs-model-cache-sg"
  description = "Allow NFS access to the embedding model cache EFS."
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-efs-model-cache-sg"
  }
}

resource "aws_security_group_rule" "efs_model_cache_ingress_airflow" {
  type                     = "ingress"
  security_group_id        = aws_security_group.efs_model_cache.id
  source_security_group_id = aws_security_group.ec2_airflow.id
  description              = "NFS traffic from Airflow EC2."
  from_port                = 2049
  to_port                  = 2049
  protocol                 = "tcp"
}

resource "aws_security_group_rule" "efs_model_cache_ingress_gpu_host" {
  type                     = "ingress"
  security_group_id        = aws_security_group.efs_model_cache.id
  source_security_group_id = aws_security_group.gpu_host.id
  description              = "NFS traffic from GPU ECS hosts."
  from_port                = 2049
  to_port                  = 2049
  protocol                 = "tcp"
}

resource "aws_security_group_rule" "efs_model_cache_ingress_gpu_task" {
  type                     = "ingress"
  security_group_id        = aws_security_group.efs_model_cache.id
  source_security_group_id = aws_security_group.gpu_task.id
  description              = "NFS traffic from GPU ECS tasks."
  from_port                = 2049
  to_port                  = 2049
  protocol                 = "tcp"
}

resource "aws_security_group" "ml_llm_alb" {
  name        = "${local.name_prefix}-ml-llm-alb-sg"
  description = "Internal ALB for the OpenAI-compatible ML LLM service."
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-ml-llm-alb-sg"
  }
}

resource "aws_security_group_rule" "ml_llm_alb_ingress_airflow" {
  type                     = "ingress"
  security_group_id        = aws_security_group.ml_llm_alb.id
  source_security_group_id = aws_security_group.ec2_airflow.id
  description              = "LLM API traffic from Airflow."
  from_port                = var.llm_service_container_port
  to_port                  = var.llm_service_container_port
  protocol                 = "tcp"
}

resource "aws_security_group_rule" "ml_llm_alb_ingress_stage_tasks" {
  type                     = "ingress"
  security_group_id        = aws_security_group.ml_llm_alb.id
  source_security_group_id = aws_security_group.gpu_task.id
  description              = "LLM API traffic from one-shot ML stage tasks."
  from_port                = var.llm_service_container_port
  to_port                  = var.llm_service_container_port
  protocol                 = "tcp"
}

resource "aws_security_group_rule" "ml_llm_alb_egress_service" {
  type                     = "egress"
  security_group_id        = aws_security_group.ml_llm_alb.id
  description              = "Forward LLM traffic to the ECS service."
  from_port                = var.llm_service_container_port
  to_port                  = var.llm_service_container_port
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.ml_llm_service.id
}

resource "aws_security_group" "ml_llm_service" {
  name        = "${local.name_prefix}-ml-llm-service-sg"
  description = "OpenAI-compatible ML LLM service task security group."
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-ml-llm-service-sg"
  }
}

resource "aws_security_group_rule" "ml_llm_service_ingress_alb" {
  type                     = "ingress"
  security_group_id        = aws_security_group.ml_llm_service.id
  source_security_group_id = aws_security_group.ml_llm_alb.id
  description              = "LLM API traffic from the internal ALB."
  from_port                = var.llm_service_container_port
  to_port                  = var.llm_service_container_port
  protocol                 = "tcp"
}

resource "aws_security_group_rule" "ml_llm_service_egress_https" {
  type              = "egress"
  security_group_id = aws_security_group.ml_llm_service.id
  description       = "Allow model/service downloads and AWS API access via NAT."
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
}
