#!/usr/bin/env bash
# T14 / CA-11.2: un GESTOR que se autentica con usuario y contraseña NO recibe tokens:
# Cognito responde con el reto SOFTWARE_TOKEN_MFA y AuthenticationResult vacío.
# (Complementar con una captura del managed login pidiendo el código TOTP.)
set -euo pipefail
EMAIL="${1:-gestor@example.com}"
STACK="${STACK:-aqp-solidaria-academic}"
REGION="${REGION:-${AWS_REGION:-us-east-2}}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

out() {
  aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}
read -r -s -p "Contraseña de $EMAIL: " PASS; echo

RESP="$(aws cognito-idp admin-initiate-auth --region "$REGION" --user-pool-id "$(out UserPoolId)" \
  --client-id "$(out AdminClientId)" --auth-flow ADMIN_USER_PASSWORD_AUTH \
  --auth-parameters USERNAME="$EMAIL",PASSWORD="$PASS" \
  --query '{Challenge:ChallengeName,HasTokens:AuthenticationResult!=`null`}' --output json)"
echo "$RESP"

mkdir -p "$ROOT/evidence"
{
  echo "# T14 — Inicio de sesión de GESTOR sin segundo factor"
  echo
  echo "Fecha: $(date -u +%FT%TZ). Usuario: $EMAIL (ficticio)."
  echo
  echo '```json'
  echo "$RESP"
  echo '```'
  echo
  echo "Esperado: Challenge = SOFTWARE_TOKEN_MFA y HasTokens = false."
} > "$ROOT/evidence/t14-mfa.md"

if echo "$RESP" | grep -q '"SOFTWARE_TOKEN_MFA"' && echo "$RESP" | grep -q '"HasTokens": false'; then
  echo "✅ T14 PASA: sin el código TOTP no se emiten tokens"
else
  echo "❌ T14 FALLA"; exit 1
fi
