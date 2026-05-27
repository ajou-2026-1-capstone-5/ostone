bucket         = "ostone-prod-terraform-state"
key            = "prod/terraform.tfstate"
region         = "ap-northeast-2"
encrypt        = true
dynamodb_table = "ostone-prod-terraform-lock"
