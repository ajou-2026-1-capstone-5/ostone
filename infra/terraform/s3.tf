locals {
  s3_buckets = {
    ml_artifacts = {
      name = var.s3_bucket_names.ml_artifacts
      lifecycle_rules = [
        {
          id              = "storage-class-after-30-days"
          status          = "Enabled"
          transition_days = 30
          storage_class   = "STANDARD_IA"
          expiration_days = null
        },
        {
          id              = "glacier-after-90-days"
          status          = "Enabled"
          transition_days = 90
          storage_class   = "GLACIER"
          expiration_days = null
        },
        {
          id              = "deep-archive-after-365-days"
          status          = "Enabled"
          transition_days = 365
          storage_class   = "DEEP_ARCHIVE"
          expiration_days = null
        }
      ]
    }
    airflow_logs = {
      name = var.s3_bucket_names.airflow_logs
      lifecycle_rules = [
        {
          id              = "expire-after-7-days"
          status          = "Enabled"
          transition_days = null
          storage_class   = null
          expiration_days = 7
        }
      ]
    }
    ml_input = {
      name = var.s3_bucket_names.ml_input
      lifecycle_rules = [
        {
          id              = "expire-after-1-day"
          status          = "Enabled"
          transition_days = null
          storage_class   = null
          expiration_days = 1
        }
      ]
    }
    ml_output = {
      name = var.s3_bucket_names.ml_output
      lifecycle_rules = [
        {
          id              = "glacier-after-365-days"
          status          = "Enabled"
          transition_days = 365
          storage_class   = "GLACIER"
          expiration_days = null
        }
      ]
    }
  }
}

resource "aws_s3_bucket" "buckets" {
  for_each = local.s3_buckets

  bucket = each.value.name

  tags = {
    Name = each.value.name
  }
}

resource "aws_s3_bucket_public_access_block" "buckets" {
  for_each = aws_s3_bucket.buckets

  bucket = each.value.id


  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "buckets" {
  for_each = aws_s3_bucket.buckets

  bucket = each.value.id


  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "buckets" {
  for_each = aws_s3_bucket.buckets

  bucket = each.value.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_cors_configuration" "buckets" {
  for_each = length(var.cors_allowed_origins) == 0 ? {} : aws_s3_bucket.buckets

  bucket = each.value.id


  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = var.cors_allowed_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "buckets" {
  for_each = {
    for key, bucket in local.s3_buckets : key => bucket
    if length(bucket.lifecycle_rules) > 0
  }

  bucket = aws_s3_bucket.buckets[each.key].id

  dynamic "rule" {
    for_each = each.value.lifecycle_rules

    content {
      id     = rule.value.id
      status = rule.value.status

      filter {}

      dynamic "transition" {
        for_each = rule.value.transition_days == null ? [] : [rule.value]

        content {
          days          = transition.value.transition_days
          storage_class = transition.value.storage_class
        }
      }

      dynamic "expiration" {
        for_each = rule.value.expiration_days == null ? [] : [rule.value]

        content {
          days = expiration.value.expiration_days
        }
      }

      dynamic "noncurrent_version_expiration" {
        for_each = rule.value.expiration_days == null ? [] : [rule.value]

        content {
          noncurrent_days = noncurrent_version_expiration.value.expiration_days
        }
      }
    }
  }
}
