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

variable "rds_multi_az" {
  description = "Whether to enable Multi-AZ failover for the production RDS instance."
  type        = bool
  default     = true
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

variable "omlx_base_url" {
  description = "OpenAI-compatible embedding endpoint used by the GPU worker."
  type        = string
}

variable "omlx_api_key" {
  description = "API key for the OMLX embedding endpoint."
  type        = string
  sensitive   = true
}

variable "sns_email" {
  description = "Email address for SNS alarm notifications. Confirm subscription via AWS console after terraform apply."
  type        = string
}
