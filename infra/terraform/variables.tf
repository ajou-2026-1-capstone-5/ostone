variable "aws_region" {
  description = "Primary AWS region for production resources."
  type        = string
  default     = "ap-northeast-2"
}

variable "project_name" {
  description = "Project tag and resource name prefix."
  type        = string
  default     = "ostone"
}

variable "environment" {
  description = "Deployment environment name."
  type        = string
  default     = "prod"
}

variable "domain_name" {
  description = "Route53 hosted zone domain name."
  type        = string
}

variable "route53_zone_id" {
  description = "Existing public Route53 hosted zone ID for domain_name. When blank, Terraform looks up an existing zone unless manage_route53_zone is true."
  type        = string
  default     = ""
}

variable "manage_route53_zone" {
  description = "Whether Terraform should create the public Route53 hosted zone. Keep false when the domain already has a delegated hosted zone."
  type        = bool
  default     = false
}

variable "vpc_cidr" {
  description = "CIDR block for the production VPC."
  type        = string
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrnetmask(var.vpc_cidr))
    error_message = "vpc_cidr must be a valid CIDR block."
  }
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets."
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]

  validation {
    condition     = length(var.public_subnet_cidrs) == 2 && alltrue([for cidr in var.public_subnet_cidrs : can(cidrnetmask(cidr))])
    error_message = "Exactly two valid public subnet CIDR blocks are required."
  }
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets."
  type        = list(string)
  default     = ["10.0.3.0/24", "10.0.4.0/24"]

  validation {
    condition     = length(var.private_subnet_cidrs) == 2 && alltrue([for cidr in var.private_subnet_cidrs : can(cidrnetmask(cidr))])
    error_message = "Exactly two valid private subnet CIDR blocks are required."
  }
}

variable "admin_cidr" {
  description = "Administrator CIDR block allowed to access Airflow EC2 over SSH."
  type        = string

  validation {
    condition     = can(cidrnetmask(var.admin_cidr))
    error_message = "admin_cidr must be a valid CIDR block."
  }
}

variable "db_name" {
  description = "RDS PostgreSQL database name."
  type        = string
  default     = "ostone"
}

variable "db_master_username" {
  description = "RDS PostgreSQL master username."
  type        = string
  default     = "ostone_admin"
}

variable "db_master_password" {
  description = "RDS PostgreSQL master password."
  type        = string
  sensitive   = true

  validation {
    condition = (
      length(var.db_master_password) >= 8
      && length(var.db_master_password) <= 128
      && can(regex("^[!-~]+$", var.db_master_password))
      && length(regexall("[/@\"]", var.db_master_password)) == 0
    )
    error_message = "db_master_password must be 8-128 printable ASCII characters and cannot contain '/', '@', double quote, or spaces."
  }
}

variable "app_db_password" {
  description = "Application database user password for scripts/init.sql."
  type        = string
  sensitive   = true
}

variable "airflow_db_password" {
  description = "Airflow database user password for scripts/init.sql."
  type        = string
  sensitive   = true
}

variable "rds_engine_version" {
  description = "PostgreSQL engine version for RDS."
  type        = string
  default     = "16.4"
}

variable "rds_instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t4g.medium"
}

variable "rds_allocated_storage" {
  description = "Initial RDS storage in GiB."
  type        = number
  default     = 20
}

variable "rds_max_allocated_storage" {
  description = "Maximum RDS autoscaled storage in GiB."
  type        = number
  default     = 100
}

variable "rds_backup_retention_period" {
  description = "RDS automated backup retention period in days."
  type        = number
  default     = 7
}

variable "rds_performance_insights_retention_period" {
  description = "Performance Insights retention period in days."
  type        = number
  default     = 7
}

variable "rds_monitoring_interval" {
  description = "Enhanced Monitoring interval in seconds. Set 0 to disable."
  type        = number
  default     = 60

  validation {
    condition     = contains([0, 1, 5, 10, 15, 30, 60], var.rds_monitoring_interval)
    error_message = "rds_monitoring_interval must be one of 0, 1, 5, 10, 15, 30, or 60."
  }
}

variable "rds_multi_az" {
  description = "Whether to enable Multi-AZ failover for the production RDS instance."
  type        = bool
  default     = true
}

variable "backend_desired_count" {
  description = "Initial desired count for the backend ECS service. Keep 0 for first infrastructure apply before an application image exists."
  type        = number
  default     = 0
}

variable "backend_autoscaling_min_capacity" {
  description = "Minimum backend ECS service capacity managed by application autoscaling."
  type        = number
  default     = 0
}

variable "backend_autoscaling_max_capacity" {
  description = "Maximum backend ECS service capacity managed by application autoscaling."
  type        = number
  default     = 3
}

variable "s3_bucket_names" {
  description = "Production S3 bucket names."
  type = object({
    ml_artifacts = string
    airflow_logs = string
    ml_input     = string
    ml_output    = string
  })
  default = {
    ml_artifacts = "ostone-prod-ml-artifacts"
    airflow_logs = "ostone-prod-airflow-logs"
    ml_input     = "ostone-prod-ml-input"
    ml_output    = "ostone-prod-ml-output"
  }
}

variable "cors_allowed_origins" {
  description = "Origins allowed to access S3 buckets from browser tools. Empty disables S3 CORS."
  type        = list(string)
  default     = []
}

variable "permissions_boundary_arn" {
  description = "Optional IAM permissions boundary ARN for created roles."
  type        = string
  default     = null
}

variable "secret_arns" {
  description = "Secrets Manager ARNs readable by ECS, Airflow, and GPU tasks."
  type        = list(string)
  default     = []
}

variable "admin_key_name" {
  description = "EC2 key pair name for GPU worker SSH access."
  type        = string
  default     = null
}

variable "jwt_secret" {
  description = "Secret key for JWT token signing."
  type        = string
  sensitive   = true
}

variable "airflow_api_username" {
  description = "Backend credential for the production Airflow API."
  type        = string
  sensitive   = true
}

variable "airflow_api_password" {
  description = "Backend credential for the production Airflow API."
  type        = string
  sensitive   = true
}

variable "airflow_api_base_url" {
  description = "Backend-reachable URL for the production Airflow API."
  type        = string
}

variable "airflow_api_allow_insecure_http" {
  description = "Allow the backend to call Airflow over HTTP, intended only for private VPC addresses."
  type        = bool
  default     = false
}

variable "airflow_webhook_secret" {
  description = "Shared secret for Airflow callback webhooks."
  type        = string
  sensitive   = true
}

variable "gpu_instance_type" {
  description = "EC2 instance type used by the shared ECS GPU capacity provider."
  type        = string
  default     = "g6.2xlarge"
}

variable "gpu_asg_min_size" {
  description = "Minimum size of the shared GPU Auto Scaling Group."
  type        = number
  default     = 0
}

variable "gpu_asg_max_size" {
  description = "Maximum size of the shared GPU Auto Scaling Group."
  type        = number
  default     = 1
}

variable "gpu_asg_desired_capacity" {
  description = "Default desired capacity of the shared GPU Auto Scaling Group."
  type        = number
  default     = 0
}

variable "gpu_root_volume_size" {
  description = "Root EBS volume size in GiB for GPU ECS instances. Increase when model cache is preloaded."
  type        = number
  default     = 120
}

variable "embedding_model_name" {
  description = "Local embedding model loaded by the ML embedder task."
  type        = string
  default     = "BAAI/bge-m3"
}

variable "embedding_model_cache_mount_path" {
  description = "Container path used as HF_HOME for the shared embedding model cache."
  type        = string
  default     = "/app/.cache/huggingface"
}

variable "embedding_model_cache_transition_to_ia" {
  description = "EFS lifecycle policy for infrequently accessed embedding model cache files."
  type        = string
  default     = "AFTER_30_DAYS"
}

variable "ml_runtime_profile" {
  description = "ML runtime profile used by production pipeline jobs."
  type        = string
  default     = "balanced"

  validation {
    condition     = contains(["balanced", "quality"], var.ml_runtime_profile)
    error_message = "ml_runtime_profile must be one of: balanced, quality."
  }
}

variable "llm_model_name" {
  description = "OpenAI-compatible local LLM model name used by draft enrichment."
  type        = string
  default     = "Qwen/Qwen3-14B"
}

variable "llm_model_path" {
  description = "Model path inside the LLM service container. For llama.cpp this should point to a GGUF file on the model cache volume."
  type        = string
  default     = "/models/model.gguf"
}

variable "llm_service_desired_count" {
  description = "Desired ECS task count for the internal LLM service. Keep 0 unless a warm local LLM endpoint is needed."
  type        = number
  default     = 0
}

variable "llm_service_container_port" {
  description = "HTTP port exposed by the OpenAI-compatible LLM service container."
  type        = number
  default     = 8000
}

variable "llm_runtime_api_key" {
  description = "Optional API key shared between the ML pipeline and the internal LLM service."
  type        = string
  sensitive   = true
  default     = ""
}

variable "ai_embedding_provider" {
  description = "Embedding provider used by backend workflow matching."
  type        = string
  default     = "bedrock"

  validation {
    condition     = contains(["bedrock", "disabled"], var.ai_embedding_provider)
    error_message = "ai_embedding_provider must be one of: bedrock, disabled."
  }
}

variable "ai_embedding_model" {
  description = "Bedrock embedding model id used by backend workflow matching."
  type        = string
  default     = "cohere.embed-multilingual-v3"
}

variable "ai_embedding_bedrock_region" {
  description = "AWS region used for Bedrock embedding calls. This can differ from aws_region when the selected model is unavailable in the primary region."
  type        = string
  default     = "ap-northeast-1"
}

variable "ai_embedding_enabled" {
  description = "Whether backend workflow matching should call the embedding provider."
  type        = bool
  default     = true
}

variable "ai_embedding_timeout_seconds" {
  description = "Timeout in seconds for backend embedding calls."
  type        = number
  default     = 5
}

variable "ai_embedding_profile_build_running_timeout" {
  description = "How long a RUNNING workflow matching profile build can remain untouched before another worker may reclaim it."
  type        = string
  default     = "15m"
}

variable "ai_embedding_auto_run_replay_fitness_threshold" {
  description = "Minimum workflow replay fitness required before workflow matching may auto-run a confident workflow."
  type        = number
  default     = 0.70
}

variable "ai_embedding_confident_threshold" {
  description = "Minimum final matching confidence required for automatic workflow execution."
  type        = number
  default     = 0.72
}

variable "ai_embedding_ambiguous_threshold" {
  description = "Minimum final matching confidence required to ask an intent/workflow confirmation question."
  type        = number
  default     = 0.55
}

variable "ai_embedding_confident_margin" {
  description = "Minimum score gap between top-1 and top-2 candidates required for automatic workflow execution."
  type        = number
  default     = 0.10
}

variable "ai_embedding_semantic_floor" {
  description = "Minimum semantic score required before workflow matching may auto-run a workflow."
  type        = number
  default     = 0.65
}

variable "ai_embedding_route_evidence_floor" {
  description = "Minimum route evidence score that can satisfy the auto-run evidence gate."
  type        = number
  default     = 0.50
}

variable "ai_embedding_lexical_evidence_floor" {
  description = "Minimum lexical evidence score that can satisfy the auto-run evidence gate."
  type        = number
  default     = 0.30
}
