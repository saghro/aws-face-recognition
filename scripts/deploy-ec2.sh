#!/usr/bin/env bash
set -euo pipefail

STEP="ec2"
REGION="${AWS_REGION:-us-east-1}"
PROFILE="${AWS_PROFILE:-default}"
VPC_ID=""
SUBNET_ID=""
AMI_ID=""
INSTANCE_TYPE="t3.small"
KEY_NAME=""
SECURITY_GROUP_TEMPLATE="config/security-groups.json"
STACK_NAME="faces-security-groups"
EXTRA_PARAMS=()

usage() {
  cat <<USAGE
Usage: $0 [--step security-groups|ec2] [options]

Étapes:
  security-groups   -> déploie les SG via CloudFormation.
  ec2               -> lance une instance Amazon Linux 2023 avec l'app.

Options communes:
  --region REGION
  --profile PROFILE

Options security-groups:
  --stack NAME          Nom du stack CloudFormation
  --param Key=Value     Paramètres supplémentaires (répétable)

Options ec2:
  --subnet-id subnet-xxx
  --sg-ids sg-aaa,sg-bbb
  --ami ami-xxx         (par défaut Amazon Linux 2023 de la région)
  --instance-type t3.small
  --key-name my-keypair

Exemples:
  $0 --step security-groups --stack faces-sg --param AllowedCidr=10.0.0.0/16
  $0 --step ec2 --subnet-id subnet-abc --sg-ids sg123,sg456 --key-name faces-key
USAGE
}

SG_IDS=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --step) STEP="$2"; shift 2 ;;
    --region) REGION="$2"; shift 2 ;;
    --profile) PROFILE="$2"; shift 2 ;;
    --stack) STACK_NAME="$2"; shift 2 ;;
    --param) EXTRA_PARAMS+=("--parameter-overrides" "$2"); shift 2 ;;
    --subnet-id) SUBNET_ID="$2"; shift 2 ;;
    --sg-ids) SG_IDS="$2"; shift 2 ;;
    --ami) AMI_ID="$2"; shift 2 ;;
    --instance-type) INSTANCE_TYPE="$2"; shift 2 ;;
    --key-name) KEY_NAME="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Argument inconnu: $1" >&2; usage; exit 1 ;;
  esac
 done

if [[ "$STEP" == "security-groups" ]]; then
  if [[ ! -f "$SECURITY_GROUP_TEMPLATE" ]]; then
    echo "Template SG introuvable: $SECURITY_GROUP_TEMPLATE" >&2
    exit 1
  fi
  echo "➡️  Déploiement des security groups ($STACK_NAME) dans $REGION"
  aws cloudformation deploy \
    --stack-name "$STACK_NAME" \
    --template-file "$SECURITY_GROUP_TEMPLATE" \
    --region "$REGION" \
    --capabilities CAPABILITY_NAMED_IAM \
    "${EXTRA_PARAMS[@]}"
  aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
    --query 'Stacks[0].Outputs'
  exit 0
fi

# Step EC2
if [[ -z "$SUBNET_ID" || -z "$SG_IDS" || -z "$KEY_NAME" ]]; then
  echo "Pour l'étape EC2, veuillez fournir --subnet-id, --sg-ids et --key-name" >&2
  exit 1
fi

if [[ -z "$AMI_ID" ]]; then
  echo "Recherche de l'AMI Amazon Linux 2023 la plus récente..."
  AMI_ID=$(aws ssm get-parameter \
    --name "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-6.1-arm64" \
    --region "$REGION" \
    --profile "$PROFILE" \
    --query 'Parameter.Value' --output text)
fi

USER_DATA=$(cat <<'USERDATA'
#!/bin/bash
set -euo pipefail
yum update -y
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
yum install -y nodejs git
cd /home/ec2-user
sudo -u ec2-user git clone https://github.com/your-org/face-recognition-lab.git app
cd app/webapp
sudo -u ec2-user npm install --production
cat <<'ENV' > /home/ec2-user/app/webapp/.env
PORT=3000
AWS_REGION=us-east-1
BUCKET_NAME=myfaces-uploads-ayoub2025
DB_HOST=<rds-endpoint>
DB_USER=mydbuser
DB_PASSWORD=MySecurePassword123!
DB_NAME=faces_db
ENABLE_PUBLIC_PHOTO_PREVIEW=false
ENV
sudo -u ec2-user npm start > /var/log/face-webapp.log 2>&1 &
USERDATA
)

INSTANCE_ID=$(aws ec2 run-instances \
  --region "$REGION" \
  --profile "$PROFILE" \
  --image-id "$AMI_ID" \
  --instance-type "$INSTANCE_TYPE" \
  --subnet-id "$SUBNET_ID" \
  --security-group-ids ${SG_IDS//,/ } \
  --key-name "$KEY_NAME" \
  --user-data "$USER_DATA" \
  --query 'Instances[0].InstanceId' --output text)

echo "✅ Instance lancée: $INSTANCE_ID"
