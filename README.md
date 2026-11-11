# AQP-SOLIDARIA: Plataforma de Donaciones Seguras

Prototipo académico del curso **Tópicos Avanzados en Ingeniería de Software** (EPIS, UNSA). Es una SPA React con backend serverless en AWS y modelo de seguridad **Zero Trust** (NIST SP 800-207).

> **Simulación académica.** No se solicitan, almacenan ni procesan datos de pago. Usuarios, proyectos y la Fundación AQP-SOLIDARIA son ficticios.

- Especificación: [`requirements.md`](requirements.md) · Diseño: [`design.md`](design.md) · Plan de implementación: [`tasks.md`](tasks.md)
- Contrato del API: [`docs/api.yaml`](docs/api.yaml) (OpenAPI 3.1)
- Modelo de amenazas y mapeo NIST: [`docs/threat-model.md`](docs/threat-model.md)
- Guía de cuenta AWS y despliegue: [`docs/guia-cuenta-aws.md`](docs/guia-cuenta-aws.md)
- Informe técnico: [`docs/informe-tecnico.md`](docs/informe-tecnico.md) · Uso de IA: [`AI_USAGE.md`](AI_USAGE.md)

## Arquitectura

| Capa | Servicio | Rol Zero Trust |
|---|---|---|
| Frontend | React 19 + Vite 8 + Tailwind 4, en S3 privado + CloudFront (OAC, CSP, HSTS) | — |
| Identidad | Cognito User Pool: Authorization Code + PKCE, grupos DONANTE/GESTOR/AUDITOR, MFA TOTP | Policy Administrator |
| API | API Gateway HTTP API con JWT authorizer y scopes por ruta | Policy Enforcement Point |
| Lógica | Lambda Node.js 24 (TypeScript), una función y un rol IAM por caso de uso | Policy Engine (`authz`) |
| Datos | DynamoDB on-demand: Projects, Donations, Idempotency (TTL), AuditEvents | — |
| Observabilidad | CloudWatch Logs JSON (14 días) + access logs del API + CloudTrail | — |
| IaC | AWS SAM ([`infra/template.yaml`](infra/template.yaml)) | — |

```
backend/src/
  authz/       PE: identidad desde claims verificados, matriz RBAC y ownership
  projects/    catálogo público y gestión (GESTOR)
  donations/   intención idempotente, simulación transaccional, historial propio
  audit/       eventos seudonimizados
  shared/      esquemas Zod (compartidos con el frontend), errores y logger
  handlers/    una entrada por función Lambda
```

## Requisitos

- Node.js 24 (mínimo 22.12) y npm 11.
- Para desplegar: AWS CloudShell, que ya trae AWS CLI y SAM CLI. No hace falta instalar nada en la PC.

### Combinación de versiones (design.md §2)

| Paquete | Versión | Nota |
|---|---|---|
| TypeScript | **6.0.3** | Se fija 6.0 y no 7.0 porque `typescript-eslint` 8.72 admite `typescript <6.1`. Así lint y typecheck corren en CI con el mismo compilador. |
| React / React DOM | 19.3.1 | |
| Vite | 8.3.8 | |
| Tailwind CSS | 4.3.5 | Sin Bootstrap. |
| React Router | 8.5.1 | |
| Zod | 4.6.7 | Esquemas en `backend/src/shared/schemas.ts`, importados por el frontend con el alias `@shared`. |
| TanStack Query / React Hook Form | 5.107.1 / 7.91.0 | |
| oidc-client-ts | 3.5.0 | PKCE y tokens en memoria (`InMemoryWebStorage`). |
| Vitest / ESLint / Prettier | 5.1.0 / 10.14.0 / 3.9.10 | |

## Desarrollo local

```bash
cd backend && npm ci && npm run lint && npm run typecheck && npm test && npm run build
cd ../frontend && npm ci && npm test && npm run dev    # requiere frontend/.env.local (ver .env.example)
```

El frontend en `localhost:5173` usa el API y Cognito desplegados. La plantilla permite `http://localhost:5173` como callback solo mientras `AllowLocalhost=true`; para la evaluación final puede desplegarse con `false`.

## Despliegue (AWS CloudShell, us-east-2)

```bash
git clone https://github.com/JCuenca17/aqp-solidaria.git && cd aqp-solidaria
bash scripts/deploy.sh            # build del backend → sam deploy → .env del frontend → build y subida a S3
bash scripts/create-users.sh      # donante1, donante2, gestor, auditor (@example.com)
bash scripts/enroll-totp.sh gestor@example.com GESTOR
bash scripts/enroll-totp.sh auditor@example.com AUDITOR
```

`scripts/deploy.sh` muestra la **WebUrl** (demo HTTPS) y la **ApiUrl**. El paso a paso con capturas sugeridas está en [`docs/guia-cuenta-aws.md`](docs/guia-cuenta-aws.md).

### Restricciones de la cuenta (AWS Free plan)

- La cuenta se creó con la **nueva experiencia de AWS** (proyectos + AWS Builder ID). AWS asigna la región según el país de contacto: para Perú es **us-east-2 (Ohio)** y no se puede cambiar sin activar las características avanzadas. Por eso se usa us-east-2 y no la us-east-1 que *recomienda* el design.md (AD-06).
- No existe usuario root: la cuenta pertenece al AWS Builder ID del dueño, protegido con MFA. Los integrantes entran como **miembros del equipo** del proyecto, cada uno con su propio Builder ID y MFA. En esta modalidad los usuarios IAM solo pueden tener acceso programático, así que no se crean usuarios IAM de consola ni llaves de larga duración.
- Alerta de **Budgets** de gasto cero; despliegue con las credenciales temporales de CloudShell.
- No se usan Cognito Plus, SMS, WAF, GuardDuty, Security Hub ni Verified Access (fuera del Free plan o con costo).

## Pruebas

| Tipo | Dónde | Cómo |
|---|---|---|
| Unitarias backend (73) | `backend/test` | `npm test`: validación, authz, idempotencia, transiciones y concurrencia simulada |
| UI (4) | `frontend/src/**/*.test.tsx` | `npm test`: formulario accesible, sin datos de pago, céntimos e Idempotency-Key |
| T01–T09, T11, T12 contra AWS | `scripts/security-tests.mjs` | ver abajo |
| T10 mínimo privilegio | `scripts/t10-iam-check.sh` | IAM Policy Simulator sobre el rol de la función de listado |
| T13 revocación | `scripts/t13-revocation.mjs` | token usado después de "Salir" hasta su expiración |
| T14 MFA | `scripts/t14-mfa-check.sh` + captura del login | GESTOR sin TOTP no obtiene tokens |
| RNF-HU-05 rendimiento | `scripts/seed-projects.mjs` + `scripts/perf-test.mjs` | p95 con 50 proyectos, desde CloudShell |

Las pruebas contra AWS necesitan access tokens. Se obtienen así: iniciar sesión en la demo, abrir DevTools → **Red**, tomar una llamada al API y copiar el valor de `Authorization` sin `Bearer `. El ID token del donante (para T11) aparece en la respuesta de `/oauth2/token`. Los scripts **nunca** imprimen ni guardan tokens.

```bash
export API_URL=https://xxxx.execute-api.us-east-2.amazonaws.com/academic
export TOKEN_DONANTE=... TOKEN_DONANTE2=... TOKEN_GESTOR=... ID_TOKEN_DONANTE=...
node scripts/security-tests.mjs        # genera evidence/security-tests-<fecha>.md
bash scripts/t10-iam-check.sh
bash scripts/t14-mfa-check.sh gestor@example.com
REVOKED_TOKEN=... node scripts/t13-revocation.mjs
TOKEN_GESTOR=... node scripts/seed-projects.mjs && node scripts/perf-test.mjs
```

## Eliminación de recursos

```bash
bash scripts/cleanup.sh     # vacía el bucket, ejecuta `sam delete` y lista lo que quede con la etiqueta del proyecto
```

## Flujo de trabajo en GitHub

- `main` protegida: todo cambio entra por Pull Request con al menos una revisión de otro integrante y el CI en verde.
- El CI (`.github/workflows/ci.yml`) corre lint, typecheck, tests, build, `npm audit` y `cfn-lint` en cada PR. No tiene credenciales AWS.
- Dependabot revisa dependencias semanalmente.
