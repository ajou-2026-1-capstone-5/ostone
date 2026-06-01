# =============================================================================
# CloudWatch Metric Alarms
# =============================================================================

# ALB 5xx Error Rate > 5% (15-minute evaluation)
resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  alarm_name          = "${local.name_prefix}-alb-5xx-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  datapoints_to_alarm = 2
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "ALB 5xx error rate exceeds 5% over 15 minutes"
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = aws_lb.backend.arn_suffix
    TargetGroup  = aws_lb_target_group.backend.arn_suffix
  }

  tags = local.common_tags
}

# ECS Backend CPU Utilization > 80% (10-minute evaluation)
resource "aws_cloudwatch_metric_alarm" "ecs_backend_cpu" {
  alarm_name          = "${local.name_prefix}-ecs-backend-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  datapoints_to_alarm = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "ECS Backend service CPU utilization exceeds 80% over 10 minutes"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.backend.name
  }

  tags = local.common_tags
}

# RDS CPU Utilization > 80% (10-minute evaluation)
resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "${local.name_prefix}-rds-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  datapoints_to_alarm = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "RDS CPU utilization exceeds 80% over 10 minutes"
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.postgres.identifier
  }

  tags = local.common_tags
}

# RDS Free Storage Space < 10 GB (10-minute evaluation)
resource "aws_cloudwatch_metric_alarm" "rds_storage" {
  alarm_name          = "${local.name_prefix}-rds-storage"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  datapoints_to_alarm = 2
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 10737418240 # 10 GiB in bytes
  alarm_description   = "RDS free storage space is below 10 GiB over 10 minutes"
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.postgres.identifier
  }

  tags = local.common_tags
}

# GPU EC2 Instance CPU Utilization > 90% (10-minute evaluation)
# Uses the ASG as dimensions since GPU runs on EC2 via ASG, not Fargate
resource "aws_cloudwatch_metric_alarm" "gpu_cpu" {
  alarm_name          = "${local.name_prefix}-gpu-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  datapoints_to_alarm = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 300
  statistic           = "Maximum"
  threshold           = 90
  alarm_description   = "GPU EC2 instance CPU utilization exceeds 90% over 10 minutes"
  treat_missing_data  = "notBreaching"

  dimensions = {
    AutoScalingGroupName = aws_autoscaling_group.gpu.name
  }

  tags = local.common_tags
}
