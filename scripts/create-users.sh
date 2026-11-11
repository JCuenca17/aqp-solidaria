#!/usr/bin/env bash
# Crea los usuarios de prueba (identidades ficticias, RNF-HU-10).
#   - donante1 y donante2 -> grupo DONANTE (dos donantes para la prueba BOLA T09)
#   - gestor y auditor     -> SIN grupo todavía: primero se enrola su TOTP con
#                             scripts/enroll-totp.sh, que luego los agrega a GESTOR/AUDITOR.
# La contraseña se pide por teclado y no se guarda en ningún archivo.
set -euo pipefail
STACK="${STACK:-aqp-solidaria-academic}"
REGION="${REGION:-us-east-1}"
DOMAIN="${TEST_EMAIL_DOMAIN:-example.com}"

POOL_ID="$(aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)"

read -r -s -p "Contraseña para los usuarios de prueba (12+ con mayúscula, número y símbolo): " PASS; echo

create() {
  local email="$1"
  aws cognito-idp admin-create-user --region "$REGION" --user-pool-id "$POOL_ID" \
    --username "$email" --message-action SUPPRESS \
    --user-attributes Name=email,Value="$email" Name=email_verified,Value=true >/dev/null 2>&1 \
    || echo "  (ya existía $email)"
  aws cognito-idp admin-set-user-password --region "$REGION" --user-pool-id "$POOL_ID" \
    --username "$email" --password "$PASS" --permanent
  echo "✔ $email"
}

for u in donante1 donante2 gestor auditor; do create "$u@$DOMAIN"; done
for u in donante1 donante2; do
  aws cognito-idp admin-add-user-to-group --region "$REGION" --user-pool-id "$POOL_ID" \
    --username "$u@$DOMAIN" --group-name DONANTE
done
echo "✔ donante1 y donante2 en DONANTE."
echo "Siguiente: bash scripts/enroll-totp.sh gestor@$DOMAIN GESTOR  y  bash scripts/enroll-totp.sh auditor@$DOMAIN AUDITOR"
