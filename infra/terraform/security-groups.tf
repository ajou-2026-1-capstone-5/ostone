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

resource "aws_security_group_rule" "ec2_airflow_egress_gpu" {
  type                     = "egress"
  security_group_id        = aws_security_group.ec2_airflow.id
  description              = "Allow outbound traffic to GPU task API."
  from_port                = 8081
  to_port                  = 8081
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.gpu_task.id
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

resource "aws_security_group" "gpu_task" {
  name        = "${local.name_prefix}-gpu-task-sg"
  description = "Allow GPU task traffic from Airflow EC2 only."
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-gpu-task-sg"
  }
}

resource "aws_security_group_rule" "gpu_task_ingress" {
  type                     = "ingress"
  security_group_id        = aws_security_group.gpu_task.id
  source_security_group_id = aws_security_group.ec2_airflow.id
  description              = "GPU task API traffic from Airflow EC2."
  from_port                = 8081
  to_port                  = 8081
  protocol                 = "tcp"
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
