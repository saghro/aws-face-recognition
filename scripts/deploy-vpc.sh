#!/usr/bin/env bash
set -euo pipefail

STACK_NAME="faces-vpc"
REGION="${AWS_REGION:-us-east-1}"
TEMPLATE_FILE="config/vpc-config.json"
EXTRA_ARGS=()

usage() {
  cat <<USAGE
Usage: $0 [--stack NAME] [--region REGION] [--param Key=Value ...]

Déploie la VPC du lab via AWS CloudFormation.
Exemples :
  $0 --stack faces-vpc --region eu-west-1
  $0 --param VpcCidr=10.20.0.0/16 --param PublicSubnetCidrA=10.20.1.0/24
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --stack)
      STACK_NAME="$2"; shift 2 ;;
    --region)
      REGION="$2"; shift 2 ;;
    --param)
      EXTRA_ARGS+=("--parameter-overrides" "$2"); shift 2 ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      echo "Argument inconnu: $1" >&2; usage; exit 1 ;;
  esac
 done

if [[ ! -f "$TEMPLATE_FILE" ]]; then
  echo "Template introuvable: $TEMPLATE_FILE" >&2
  exit 1
fi

echo "➡️  Déploiement de la VPC ($STACK_NAME) dans $REGION"
aws cloudformation deploy \
  --stack-name "$STACK_NAME" \
  --template-file "$TEMPLATE_FILE" \
  --capabilities CAPABILITY_NAMED_IAM \
  --region "$REGION" \
  "${EXTRA_ARGS[@]}"

echo "✅ Stack déployée. Récupération des sorties :"
aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
  --query 'Stacks[0].Outputs'
