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

  tags = {
    Name = "${local.name_prefix}-postgres16"
  }
}

resource "aws_db_option_group" "postgres" {
  name                 = "${local.name_prefix}-postgres16"
  engine_name          = "postgres"
  major_engine_version = "16"

  tags = {
    Name = "${local.name_prefix}-postgres16"
  }
}

resource "aws_db_instance" "postgres" {
  identifier = "${local.name_prefix}-postgres"

  engine         = "postgres"
  engine_version = var.rds_engine_version
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
  option_group_name      = aws_db_option_group.postgres.name

  multi_az                  = false
  publicly_accessible       = false
  backup_retention_period   = var.rds_backup_retention_period
  backup_window             = "18:00-19:00"
  maintenance_window        = "sun:19:00-sun:20:00"
  deletion_protection       = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "${local.name_prefix}-postgres-final"

  copy_tags_to_snapshot = true
  apply_immediately     = false

  tags = {
    Name = "${local.name_prefix}-postgres"
  }
}
