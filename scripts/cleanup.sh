#!/usr/bin/env bash
# RNF-HU-09 / CA-NF09.2: elimina TODOS los recursos tras la evaluación.
set -euo pipefail
STACK="${STACK:-aqp-solidaria-academic}"
REGION="${REGION:-${AWS_REGION:-us-east-2}}"

BUCKET="$(aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='WebBucketName'].OutputValue" --output text 2>/dev/null || true)"
if [[ -n "${BUCKET:-}" && "$BUCKET" != "None" ]]; then
  echo "▶ Vaciando bucket de la SPA"
  aws s3 rm "s3://$BUCKET" --recursive
fi

echo "▶ sam delete (Cognito, API, Lambdas, DynamoDB, CloudFront, S3, logs)"
(cd "$(dirname "$0")/../infra" && sam delete --no-prompts)

echo "▶ Recursos con la etiqueta Project=aqp-solidaria que sigan existiendo:"
aws resourcegroupstaggingapi get-resources --region "$REGION" \
  --tag-filters Key=Project,Values=aqp-solidaria --query 'ResourceTagMappingList[].ResourceARN' --output table
aws resourcegroupstaggingapi get-resources --region "$REGION" \
  --tag-filters Key=Project,Values=aqp-solidaria --query 'ResourceTagMappingList[].ResourceARN' --output text \
  | grep -q . && echo "⚠ Revisa los recursos listados" || echo "✔ No quedan recursos etiquetados"
echo "Revisa también el bucket de artefactos de SAM (aws-sam-cli-managed-default) y elimínalo si ya no se usará."
