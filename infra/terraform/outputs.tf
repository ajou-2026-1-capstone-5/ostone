output "vpc_id" {
  description = "Production VPC ID."
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs."
  value       = values(aws_subnet.public)[*].id
}

output "private_subnet_ids" {
  description = "Private subnet IDs."
  value       = values(aws_subnet.private)[*].id
}

output "alb_security_group_id" {
  description = "ALB security group ID."
  value       = aws_security_group.alb.id
}

output "ecs_backend_security_group_id" {
  description = "ECS backend security group ID."
  value       = aws_security_group.ecs_backend.id
}

output "rds_security_group_id" {
  description = "RDS security group ID."
  value       = aws_security_group.rds.id
}

output "ec2_airflow_security_group_id" {
  description = "EC2 Airflow security group ID."
  value       = aws_security_group.ec2_airflow.id
}

output "gpu_task_security_group_id" {
  description = "GPU task security group ID."
  value       = aws_security_group.gpu_task.id
}

output "efs_model_cache_security_group_id" {
  description = "Embedding model cache EFS security group ID."
  value       = aws_security_group.efs_model_cache.id
}

output "gpu_host_security_group_id" {
  description = "GPU EC2 host security group ID."
  value       = aws_security_group.gpu_host.id
}

output "ml_llm_service_security_group_id" {
  description = "Internal LLM ECS service security group ID."
  value       = aws_security_group.ml_llm_service.id
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint."
  value       = aws_db_instance.postgres.endpoint
}

output "rds_address" {
  description = "RDS PostgreSQL address."
  value       = aws_db_instance.postgres.address
}

output "rds_port" {
  description = "RDS PostgreSQL port."
  value       = aws_db_instance.postgres.port
}

output "db_name" {
  description = "RDS database name."
  value       = var.db_name
}

output "db_master_username" {
  description = "RDS master username for one-time initialization."
  value       = var.db_master_username
}

output "ecr_repository_urls" {
  description = "ECR repository URLs by repository key."
  value       = { for key, repo in aws_ecr_repository.repos : key => repo.repository_url }
}

output "s3_bucket_names" {
  description = "S3 bucket names by purpose."
  value       = { for key, bucket in aws_s3_bucket.buckets : key => bucket.bucket }
}

output "route53_zone_id" {
  description = "Route53 hosted zone ID."
  value       = aws_route53_zone.main.zone_id
}

output "acm_certificate_arn" {
  description = "Validated regional ACM certificate ARN for ALB."
  value       = aws_acm_certificate_validation.regional.certificate_arn
}

output "cloudfront_acm_certificate_arn" {
  description = "Validated ACM certificate ARN in us-east-1 for CloudFront."
  value       = aws_acm_certificate_validation.cloudfront.certificate_arn
}

output "ecs_task_execution_role_arn" {
  description = "ECS task execution role ARN."
  value       = aws_iam_role.ecs_task_execution.arn
}

output "ecs_backend_task_role_arn" {
  description = "ECS backend task role ARN."
  value       = aws_iam_role.ecs_backend_task.arn
}

output "ec2_airflow_instance_profile_name" {
  description = "Airflow EC2 instance profile name."
  value       = aws_iam_instance_profile.ec2_airflow.name
}

output "gpu_task_role_arn" {
  description = "GPU ECS task role ARN."
  value       = aws_iam_role.gpu_task.arn
}

output "frontend_bucket_name" {
  description = "Frontend S3 bucket name."
  value       = aws_s3_bucket.frontend.id
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID for frontend."
  value       = aws_cloudfront_distribution.frontend.id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name for frontend."
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "alb_dns_name" {
  description = "ALB DNS name for the backend."
  value       = aws_lb.backend.dns_name
}

output "alb_zone_id" {
  description = "ALB hosted zone ID."
  value       = aws_lb.backend.zone_id
}

output "backend_target_group_arn" {
  description = "Backend target group ARN for ECS service."
  value       = aws_lb_target_group.backend.arn
}

output "api_endpoint" {
  description = "API endpoint URL."
  value       = "https://api.${var.domain_name}"
}

output "ecs_cluster_name" {
  description = "ECS cluster name."
  value       = aws_ecs_cluster.main.name
}

output "ecs_cluster_arn" {
  description = "ECS cluster ARN."
  value       = aws_ecs_cluster.main.arn
}

output "backend_task_definition_arn" {
  description = "Backend ECS task definition ARN."
  value       = aws_ecs_task_definition.backend.arn
}

output "backend_service_name" {
  description = "Backend ECS service name."
  value       = aws_ecs_service.backend.name
}

output "gpu_launch_template_id" {
  description = "GPU launch template ID."
  value       = aws_launch_template.gpu.id
}

output "gpu_asg_name" {
  description = "GPU ASG name."
  value       = aws_autoscaling_group.gpu.name
}

output "gpu_capacity_provider_name" {
  description = "GPU capacity provider name."
  value       = aws_ecs_capacity_provider.gpu.name
}

output "gpu_task_definition_arn" {
  description = "ML embedder GPU task definition ARN."
  value       = aws_ecs_task_definition.ml_embedder.arn
}

output "ml_embedder_task_definition_arn" {
  description = "ML embedder GPU task definition ARN."
  value       = aws_ecs_task_definition.ml_embedder.arn
}

output "ml_embedder_container_name" {
  description = "ML embedder ECS container name used by Airflow overrides."
  value       = "ml-embedder"
}

output "embedding_model_cache_file_system_id" {
  description = "EFS file system ID for the embedding model cache."
  value       = aws_efs_file_system.embedding_model_cache.id
}

output "embedding_model_cache_dns_name" {
  description = "Regional EFS DNS name for mounting the embedding model cache."
  value       = aws_efs_file_system.embedding_model_cache.dns_name
}

output "embedding_model_cache_access_point_id" {
  description = "EFS access point ID for the embedding model cache."
  value       = aws_efs_access_point.embedding_model_cache.id
}

output "ml_llm_service_name" {
  description = "Internal LLM ECS service name."
  value       = aws_ecs_service.ml_llm.name
}

output "ml_llm_task_definition_arn" {
  description = "Internal LLM ECS task definition ARN."
  value       = aws_ecs_task_definition.ml_llm.arn
}

output "ml_llm_runtime_base_url" {
  description = "VPC-internal OpenAI-compatible LLM runtime base URL."
  value       = "http://${aws_lb.ml_llm_internal.dns_name}:${var.llm_service_container_port}/v1"
}

output "gpu_instance_profile_name" {
  description = "GPU EC2 instance profile name."
  value       = aws_iam_instance_profile.gpu.name
}

output "gpu_ec2_instance_role_arn" {
  description = "GPU EC2 instance role ARN."
  value       = aws_iam_role.gpu_ec2_instance.arn
}
