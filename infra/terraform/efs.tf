resource "aws_efs_file_system" "embedding_model_cache" {
  creation_token = "${local.name_prefix}-embedding-model-cache"
  encrypted      = true

  lifecycle_policy {
    transition_to_ia = var.embedding_model_cache_transition_to_ia
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-embedding-model-cache"
  })
}

resource "aws_efs_access_point" "embedding_model_cache" {
  file_system_id = aws_efs_file_system.embedding_model_cache.id

  posix_user {
    uid = 1000
    gid = 1000
  }

  root_directory {
    path = "/huggingface"

    creation_info {
      owner_uid   = 1000
      owner_gid   = 1000
      permissions = "0775"
    }
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-embedding-model-cache-ap"
  })
}

resource "aws_efs_mount_target" "embedding_model_cache" {
  for_each = aws_subnet.private

  file_system_id  = aws_efs_file_system.embedding_model_cache.id
  subnet_id       = each.value.id
  security_groups = [aws_security_group.efs_model_cache.id]
}
