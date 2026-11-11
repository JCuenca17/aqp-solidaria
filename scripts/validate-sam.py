"""Valida infra/template.yaml con el traductor oficial de AWS SAM (el mismo que usa CloudFormation).

cfn-lint no detecta todos los errores de la transformación SAM. Este script la ejecuta y
comprueba invariantes de seguridad del API: CORS completo y rutas protegidas por defecto.
Uso: AWS_DEFAULT_REGION=us-east-2 python scripts/validate-sam.py
"""
import re
import sys
from pathlib import Path

from samtranslator.public.exceptions import InvalidDocumentException
from samtranslator.translator.transform import transform
from samtranslator.yaml_helper import yaml_parse


class _NoManagedPolicies:
    def get_managed_policy_map(self):
        return {}


src = Path(__file__).resolve().parent.parent.joinpath("infra", "template.yaml").read_text(encoding="utf-8")
# sam deploy reemplaza CodeUri local por s3://; aquí se simula para poder traducir.
src = re.sub(r"CodeUri: \.\./backend/dist/\S+", "CodeUri: s3://bucket/key.zip", src)

errors = []
try:
    out = transform(yaml_parse(src), {"Stage": "academic", "ProjectName": "aqp-solidaria", "AllowLocalhost": "true"}, _NoManagedPolicies())
except InvalidDocumentException as e:
    for cause in e.causes:
        print(f"ERROR SAM: {cause.message}")
    sys.exit(1)

api = next(v for v in out["Resources"].values() if v["Type"] == "AWS::ApiGatewayV2::Api")
body = api["Properties"]["Body"]

cors = body.get("x-amazon-apigateway-cors")
if not isinstance(cors, dict) or "allowOrigins" not in cors or "allowHeaders" not in cors:
    errors.append(f"CORS incompleto tras la transformación: {cors!r}")

public = {("get", "/v1/projects"), ("get", "/v1/projects/{projectId}"), ("get", "/v1/projects/{projectId}/stats")}
for path, methods in body["paths"].items():
    for method, op in methods.items():
        if method.startswith("x-") or not isinstance(op, dict):
            continue
        security = op.get("security") or []
        is_public = any("NONE" in s for s in security)
        if (method, path) in public and not is_public:
            errors.append(f"{method.upper()} {path} debería ser público")
        if (method, path) not in public and (is_public or not any("CognitoJwt" in s for s in security)):
            errors.append(f"{method.upper()} {path} debería exigir CognitoJwt")

if errors:
    print("\n".join(errors))
    sys.exit(1)
print(f"OK: {len(out['Resources'])} recursos, CORS completo, rutas protegidas por defecto.")
