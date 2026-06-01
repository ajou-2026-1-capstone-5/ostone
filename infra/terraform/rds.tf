resource "aws_db_subnet_group" "postgres" {
  name       = "${local.name_prefix}-postgres-subnets"
  subnet_ids = values(aws_subnet.private)[*].id

  tags = {
    Name = "${local.name_prefix}-postgres-subnets"
  }
}

resource "aws_db_parameter_group" "postgres" {
  name   = "${local.name_prefix}-postgres16"
  family = "postgres16"

  parameter {
    name  = "max_connections"
    value = "200"
  }

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  tags = {
    Name = "${local.name_prefix}-postgres16"
  }
}

data "aws_rds_engine_version" "postgres" {
  engine                 = "postgres"
  version                = var.rds_engine_version
  latest                 = true
  parameter_group_family = "postgres16"
}

data "aws_iam_policy_document" "rds_enhanced_monitoring_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["monitoring.rds.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "rds_enhanced_monitoring" {
  name                 = "${local.name_prefix}-rds-enhanced-monitoring-role"
  assume_role_policy   = data.aws_iam_policy_document.rds_enhanced_monitoring_assume_role.json
  permissions_boundary = var.permissions_boundary_arn

  tags = {
    Name = "${local.name_prefix}-rds-enhanced-monitoring-role"
  }
}

resource "aws_iam_role_policy_attachment" "rds_enhanced_monitoring" {
  role       = aws_iam_role.rds_enhanced_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

resource "random_id" "rds_final_snapshot" {
  byte_length = 4

  keepers = {
    db_instance_identifier = "${local.name_prefix}-postgres"
  }
}

resource "aws_db_instance" "postgres" {
  identifier = "${local.name_prefix}-postgres"

  engine         = "postgres"
  engine_version = data.aws_rds_engine_version.postgres.version_actual
  instance_class = var.rds_instance_class

  allocated_storage     = var.rds_allocated_storage
  max_allocated_storage = var.rds_max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = var.db_name
  username = var.db_master_username
  password = var.db_master_password
  port     = 5432

  db_subnet_group_name   = aws_db_subnet_group.postgres.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.postgres.name

  multi_az                              = var.rds_multi_az
  publicly_accessible                   = false
  backup_retention_period               = var.rds_backup_retention_period
  backup_window                         = "18:00-19:00"
  maintenance_window                    = "sun:19:00-sun:20:00"
  deletion_protection                   = true
  skip_final_snapshot                   = false
  final_snapshot_identifier             = "${local.name_prefix}-postgres-final-${random_id.rds_final_snapshot.hex}"
  enabled_cloudwatch_logs_exports       = ["postgresql", "upgrade"]
  performance_insights_enabled          = true
  performance_insights_retention_period = var.rds_performance_insights_retention_period
  monitoring_interval                   = var.rds_monitoring_interval
  monitoring_role_arn                   = var.rds_monitoring_interval > 0 ? aws_iam_role.rds_enhanced_monitoring.arn : null

  copy_tags_to_snapshot = true
  apply_immediately     = false

  tags = {
    Name = "${local.name_prefix}-postgres"
  }
}
