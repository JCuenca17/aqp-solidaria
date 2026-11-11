#!/usr/bin/env bash
# Compila la SPA y la sube al bucket privado; invalida la caché de CloudFront.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STACK="${STACK:-aqp-solidaria-academic}"
REGION="${REGION:-${AWS_REGION:-us-east-2}}"

out() {
  aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}

(cd "$ROOT/backend" && [ -d node_modules ] || npm ci --no-audit --no-fund) # zod para los esquemas compartidos
(cd "$ROOT/frontend" && npm ci --no-audit --no-fund && npm run build)

BUCKET="$(out WebBucketName)"
DIST="$(out DistributionId)"
# Archivos con hash: caché larga. index.html: sin caché para ver cambios al instante.
aws s3 sync "$ROOT/frontend/dist" "s3://$BUCKET" --delete --exclude index.html \
  --cache-control "public,max-age=31536000,immutable"
aws s3 cp "$ROOT/frontend/dist/index.html" "s3://$BUCKET/index.html" --cache-control "no-cache"
aws cloudfront create-invalidation --distribution-id "$DIST" --paths "/index.html" "/" >/dev/null
echo "✔ SPA publicada en $(out WebUrl)"
