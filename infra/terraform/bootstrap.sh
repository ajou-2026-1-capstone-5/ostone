#!/usr/bin/env bash
set -euo pipefail

REGION="${AWS_REGION:-ap-northeast-2}"
STATE_BUCKET="${STATE_BUCKET:-ostone-prod-terraform-state}"
LOCK_TABLE="${LOCK_TABLE:-ostone-prod-terraform-lock}"

if ! aws s3api head-bucket --bucket "${STATE_BUCKET}" >/dev/null 2>&1; then
  aws s3api create-bucket \
    --bucket "${STATE_BUCKET}" \
    --region "${REGION}" \
    --create-bucket-configuration "LocationConstraint=${REGION}"
fi

aws s3api put-bucket-encryption \
  --bucket "${STATE_BUCKET}" \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

aws s3api put-public-access-block \
  --bucket "${STATE_BUCKET}" \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

aws s3api put-bucket-versioning \
  --bucket "${STATE_BUCKET}" \
  --versioning-configuration Status=Enabled

if ! aws dynamodb describe-table --table-name "${LOCK_TABLE}" --region "${REGION}" >/dev/null 2>&1; then
  aws dynamodb create-table \
    --table-name "${LOCK_TABLE}" \
    --region "${REGION}" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST

  aws dynamodb wait table-exists --table-name "${LOCK_TABLE}" --region "${REGION}"
fi

aws s3api put-bucket-tagging \
  --bucket "${STATE_BUCKET}" \
  --tagging 'TagSet=[{Key=Project,Value=ostone},{Key=Environment,Value=prod},{Key=ManagedBy,Value=terraform}]'

aws dynamodb tag-resource \
  --resource-arn "$(aws dynamodb describe-table --table-name "${LOCK_TABLE}" --region "${REGION}" --query 'Table.TableArn' --output text)" \
  --tags Key=Project,Value=ostone Key=Environment,Value=prod Key=ManagedBy,Value=terraform \
  --region "${REGION}"

cat > backend-local.tf <<'EOF'
terraform {
  backend "local" {
    path = "terraform.tfstate"
  }
}
EOF

cat <<EOF
Bootstrap resources are ready.

For the first local apply, temporarily move main.tf backend configuration out or use a clean bootstrap-only directory with backend-local.tf.
After bootstrap, initialize the remote backend with:

terraform init -backend-config=backend.hcl -migrate-state
EOF
