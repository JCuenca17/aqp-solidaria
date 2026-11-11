#!/usr/bin/env bash
# Escribe frontend/.env.production con las salidas del stack (valores públicos, no secretos).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STACK="${STACK:-aqp-solidaria-academic}"
REGION="${REGION:-us-east-1}"

out() {
  aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}

POOL_ID="$(out UserPoolId)"
cat > "$ROOT/frontend/.env.production" <<EOF
VITE_API_URL=$(out ApiUrl)
VITE_COGNITO_AUTHORITY=https://cognito-idp.${REGION}.amazonaws.com/${POOL_ID}
VITE_COGNITO_DOMAIN=$(out CognitoDomain)
VITE_CLIENT_ID=$(out SpaClientId)
VITE_STAGE=academic
EOF
cp "$ROOT/frontend/.env.production" "$ROOT/frontend/.env.local"
echo "✔ frontend/.env.production y .env.local generados"
