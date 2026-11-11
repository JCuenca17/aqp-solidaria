#!/usr/bin/env bash
# Despliegue completo desde AWS CloudShell (región del proyecto: us-east-2, Ohio). Uso: bash scripts/deploy.sh
# Requiere: credenciales temporales de CloudShell (Builder ID con MFA). Nunca llaves de larga duración.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STACK="aqp-solidaria-academic"
REGION="${REGION:-${AWS_REGION:-us-east-2}}"

echo "▶ 1/4 Compilando backend"
(cd "$ROOT/backend" && npm ci --no-audit --no-fund && npm run build)

echo "▶ 2/4 sam deploy (crea/actualiza Cognito, API, Lambdas, DynamoDB, S3 y CloudFront)"
(cd "$ROOT/infra" && sam deploy)

echo "▶ 3/4 Generando frontend/.env.production desde las salidas del stack"
bash "$ROOT/scripts/frontend-env.sh"

echo "▶ 4/4 Compilando y publicando la SPA"
bash "$ROOT/scripts/publish-frontend.sh"

aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='WebUrl'||OutputKey=='ApiUrl'].[OutputKey,OutputValue]" --output table
