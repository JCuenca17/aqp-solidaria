#!/usr/bin/env bash
# HU-11: enrola MFA TOTP (app autenticadora, nunca SMS) para un usuario privilegiado y
# solo después lo agrega a su grupo. Uso: bash scripts/enroll-totp.sh gestor@example.com GESTOR
#
# Orden importante: el trigger PreAuth bloquea a GESTOR/AUDITOR sin TOTP, por eso el
# usuario se enrola ANTES de entrar al grupo.
set -euo pipefail
EMAIL="${1:?Uso: enroll-totp.sh <email> <GESTOR|AUDITOR>}"
GROUP="${2:?Uso: enroll-totp.sh <email> <GESTOR|AUDITOR>}"
[[ "$GROUP" == "GESTOR" || "$GROUP" == "AUDITOR" ]] || { echo "Grupo inválido"; exit 1; }
STACK="${STACK:-aqp-solidaria-academic}"
REGION="${REGION:-${AWS_REGION:-us-east-2}}"

out() {
  aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}
POOL_ID="$(out UserPoolId)"
ADMIN_CLIENT="$(out AdminClientId)"

read -r -s -p "Contraseña de $EMAIL: " PASS; echo

# El cliente administrativo NO tiene scopes api/*: este token no sirve contra la API.
ACCESS="$(aws cognito-idp admin-initiate-auth --region "$REGION" --user-pool-id "$POOL_ID" \
  --client-id "$ADMIN_CLIENT" --auth-flow ADMIN_USER_PASSWORD_AUTH \
  --auth-parameters USERNAME="$EMAIL",PASSWORD="$PASS" \
  --query 'AuthenticationResult.AccessToken' --output text)"

SECRET="$(aws cognito-idp associate-software-token --region "$REGION" --access-token "$ACCESS" \
  --query SecretCode --output text)"

echo
echo "Agrega esta cuenta en Google Authenticator / Microsoft Authenticator:"
echo "  • Opción 1: 'Ingresar clave de configuración' → Cuenta: AQP-SOLIDARIA $EMAIL → Clave: $SECRET (basada en tiempo)"
echo "  • Opción 2: genera un QR con este texto:"
echo "    otpauth://totp/AQP-SOLIDARIA:${EMAIL}?secret=${SECRET}&issuer=AQP-SOLIDARIA"
echo
read -r -p "Código de 6 dígitos que muestra la app: " CODE

aws cognito-idp verify-software-token --region "$REGION" --access-token "$ACCESS" \
  --user-code "$CODE" --friendly-device-name "app-autenticadora" >/dev/null
aws cognito-idp admin-set-user-mfa-preference --region "$REGION" --user-pool-id "$POOL_ID" \
  --username "$EMAIL" --software-token-mfa-settings Enabled=true,PreferredMfa=true
aws cognito-idp admin-add-user-to-group --region "$REGION" --user-pool-id "$POOL_ID" \
  --username "$EMAIL" --group-name "$GROUP"
# Se revocan las sesiones del enrolamiento.
aws cognito-idp admin-user-global-sign-out --region "$REGION" --user-pool-id "$POOL_ID" --username "$EMAIL"

echo "✔ TOTP activo y $EMAIL agregado a $GROUP. Desde ahora su login exige el código."
