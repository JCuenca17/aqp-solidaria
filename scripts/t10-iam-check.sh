#!/usr/bin/env bash
# T10 / CA-NF03.1: la función de listado (PublicProjectsFunction) NO puede escribir en DynamoDB.
# Se usa IAM Policy Simulator sobre su rol real: debe responder implicitDeny para escrituras.
set -euo pipefail
STACK="${STACK:-aqp-solidaria-academic}"
REGION="${REGION:-${AWS_REGION:-us-east-2}}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

out() {
  aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}
ROLE_ARN="$(out PublicProjectsRoleArn)"
TABLE="$(out ProjectsTableName)"
TABLE_ARN="$(aws dynamodb describe-table --table-name "$TABLE" --region "$REGION" --query Table.TableArn --output text)"

RESULT="$(aws iam simulate-principal-policy --policy-source-arn "$ROLE_ARN" \
  --action-names dynamodb:PutItem dynamodb:UpdateItem dynamodb:DeleteItem dynamodb:GetItem dynamodb:Query \
  --resource-arns "$TABLE_ARN" \
  --query 'EvaluationResults[].[EvalActionName,EvalDecision]' --output text)"

echo "$RESULT"
mkdir -p "$ROOT/evidence"
{
  echo "# T10 — IAM Policy Simulator sobre el rol de la función de listado"
  echo
  echo "Fecha: $(date -u +%FT%TZ). Rol: función PublicProjectsFunction (ARN omitido). Recurso: tabla Projects."
  echo
  echo '| Acción | Decisión |'
  echo '|---|---|'
  echo "$RESULT" | awk '{print "| " $1 " | " $2 " |"}'
  echo
  echo "Esperado: escrituras = implicitDeny; GetItem/Query = allowed."
} > "$ROOT/evidence/t10-iam-simulator.md"

if echo "$RESULT" | grep -E "PutItem|UpdateItem|DeleteItem" | grep -qv implicitDeny; then
  echo "❌ T10 FALLA: la función de listado podría escribir"; exit 1
fi
echo "✅ T10 PASA: escrituras denegadas (evidence/t10-iam-simulator.md)"
