#!/usr/bin/env bash
# T10 / CA-NF03.1: la función de listado (PublicProjectsFunction) NO puede escribir en DynamoDB.
# Se usa IAM Policy Simulator sobre su rol real. Criterio:
#   - Escrituras (PutItem, UpdateItem, DeleteItem): cualquier denegación (implicitDeny o explicitDeny).
#   - Lecturas (GetItem, Query): allowed. Sirve de control: demuestra que el simulador distingue.
# La cuenta (nueva experiencia de AWS) tiene SCP/RCP administradas por AWS con condiciones;
# por eso se pasa el contexto de la solicitud (región) para que el simulador evalúe como en ejecución.
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
  --context-entries "ContextKeyName=aws:RequestedRegion,ContextKeyValues=$REGION,ContextKeyType=string" \
  --query 'EvaluationResults[].[EvalActionName,EvalDecision,join(`,`, MatchedStatements[].SourcePolicyType || `[]`)]' \
  --output text)"

echo "Acción                Decisión        Política que decide"
echo "$RESULT"

mkdir -p "$ROOT/evidence"
{
  echo "# T10 — IAM Policy Simulator sobre el rol de la función de listado"
  echo
  echo "Fecha: $(date -u +%FT%TZ). Rol: función PublicProjectsFunction (ARN omitido). Recurso: tabla Projects. Contexto: aws:RequestedRegion=$REGION."
  echo
  echo '| Acción | Decisión | Política que decide |'
  echo '|---|---|---|'
  echo "$RESULT" | awk -F'\t' '{print "| " $1 " | " $2 " | " $3 " |"}'
  echo
  echo "Esperado: escrituras denegadas; GetItem/Query allowed (control de que el simulador distingue)."
} > "$ROOT/evidence/t10-iam-simulator.md"

writes_ok=true; reads_ok=true
while IFS=$'\t' read -r action decision _; do
  case "$action" in
    *PutItem|*UpdateItem|*DeleteItem) [[ "$decision" == "allowed" ]] && writes_ok=false ;;
    *GetItem|*Query) [[ "$decision" != "allowed" ]] && reads_ok=false ;;
  esac
done <<< "$RESULT"

if ! $writes_ok; then echo "❌ T10 FALLA: la función de listado puede escribir"; exit 1; fi
if ! $reads_ok; then
  echo "⚠ Escrituras denegadas, pero las lecturas también: el simulador no está evaluando como en ejecución."
  echo "  Revisa la columna 'Política que decide' (si dice ServiceControlPolicy o ResourceControlPolicy, es la política de AWS de la cuenta)."
  exit 2
fi
echo "✅ T10 PASA: escrituras denegadas y lecturas permitidas (evidence/t10-iam-simulator.md)"
