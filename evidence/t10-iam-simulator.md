# T10 — IAM Policy Simulator sobre el rol de la función de listado

Fecha: 2026-11-11T15:37:32Z. Rol: función PublicProjectsFunction (ARN omitido). Recurso: tabla Projects. Contexto: aws:RequestedRegion=us-east-2.

| Acción | Decisión | Política que decide |
|---|---|---|
| dynamodb:PutItem | implicitDeny |  |
| dynamodb:UpdateItem | implicitDeny |  |
| dynamodb:DeleteItem | implicitDeny |  |
| dynamodb:GetItem | allowed | IAM Policy |
| dynamodb:Query | allowed | IAM Policy |

Esperado: escrituras denegadas; GetItem/Query allowed (control de que el simulador distingue).
