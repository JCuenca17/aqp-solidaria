# Modelo de amenazas (STRIDE resumido) y mapeo NIST SP 800-207

**Sistema:** AQP-SOLIDARIA, prototipo académico de donaciones simuladas.
**Activos:** identidades de prueba (correo y `sub`), donaciones simuladas, totales agregados, eventos de auditoría y configuración de la cuenta AWS.

## Límites de confianza

```
Navegador (NO confiable)
   │  HTTPS
   ├──► CloudFront + OAC ──► S3 privado (SPA estática, sin secretos)
   ├──► Cognito (Authorization Code + PKCE, MFA TOTP)          ← Policy Administrator
   └──► API Gateway HTTP API + JWT authorizer (firma, emisor,  ← Policy Enforcement Point
        expiración, client_id y scope)
            │
            ▼
        Lambda (módulo authz: grupo + propietario + reglas)   ← Policy Engine
            │  rol IAM propio, acciones y tablas mínimas
            ▼
        DynamoDB (Projects, Donations, Idempotency, AuditEvents)
```

## STRIDE

| Categoría | Amenaza en este sistema | Control implementado | Evidencia |
|---|---|---|---|
| **S**poofing | Llamar al API sin sesión o con un token robado/forjado | JWT authorizer (firma, `iss`, `exp`, `client_id`); MFA TOTP para GESTOR/AUDITOR; access token de 15 min | T02, T11, T14 |
| **S**poofing | Usar un ID token en lugar de un access token | Rutas con `AuthorizationScopes` (el ID token no tiene scopes) + verificación `token_use=access` en `authz` | T11 |
| **T**ampering | Alterar monto, `donorSub` o rol en el cliente | Zod estricto en backend (`strictObject`), `donorSub` y grupos solo desde claims verificados | T04, prueba unitaria CA-05.3 |
| **T**ampering | Doble conteo por reintentos o concurrencia | `Idempotency-Key` + `TransactWriteItems` condicionado; transición condicionada `status = PENDIENTE` | T06, T07, T08 |
| **R**epudiation | Un gestor niega haber publicado un proyecto | `AuditEvents` con `requestId`, actor seudonimizado, acción y resultado; CloudTrail para la infraestructura | CA-08.3, HU-10 |
| **I**nformation disclosure | Ver donaciones de otra persona (BOLA) | Ownership por `sub` contra el recurso persistido; 404 idéntico para "no existe" y "no es tuyo" | T09, T12 |
| **I**nformation disclosure | Fugas en logs | Logger con lista blanca de campos; access logs sin cabeceras, IP ni cuerpos | CA-NF01.2, CA-NF07.1 |
| **I**nformation disclosure | Robo de tokens por XSS | Tokens solo en memoria; CSP restrictiva, HSTS, nosniff y Referrer-Policy en CloudFront | CA-NF11.1–2 |
| **D**enial of service | Abuso o fuerza bruta del API | Throttling del stage (25 rps, ráfaga de 50); protecciones nativas de Cognito | Plantilla SAM |
| **E**levation of privilege | Un donante crea o publica proyectos | RBAC por `cognito:groups` en `authz`; la UI no es control de seguridad | T03 |
| **E**levation of privilege | Una Lambda comprometida escribe donde no debe | Un rol IAM por función, sin `*` en acciones ni recursos (salvo el trigger PreAuth, justificado) | T10 |

## Mapeo NIST SP 800-207

| Componente NIST | Implementación |
|---|---|
| Policy Enforcement Point (PEP) | API Gateway HTTP API con JWT authorizer y scopes; CloudFront con OAC para el frontend |
| Policy Engine (PE) | Módulo `backend/src/authz` (matriz `POLICY` + ownership) |
| Policy Administrator (PA) | Amazon Cognito: emite, renueva y revoca tokens; exige TOTP a roles privilegiados |
| Fuentes de información | Claims de Cognito, estado del recurso en DynamoDB, CloudWatch Logs, CloudTrail |

| Principio | Control | Evidencia |
|---|---|---|
| 1. Todo dato y servicio es un recurso | Cada endpoint con política explícita (tabla de endpoints) y cada tabla con permisos por función | `docs/api.yaml`, `infra/template.yaml` |
| 2. Comunicación segura sin importar la red | HTTPS en CloudFront (redirect + HSTS) y API Gateway; bucket niega `aws:SecureTransport=false` | CA-NF01.1 |
| 3. Acceso por sesión y por recurso | Access token de 15 min, scopes por ruta, ownership por recurso | T09, T11, T13 |
| 4. Política dinámica | Decisión por solicitud: identidad, grupo, estado del recurso (PUBLICADO/PENDIENTE) y stage | T03, T12 |
| 5. Monitorear la postura de los activos | **Parcial:** sin postura de dispositivo en el Free plan; CloudTrail, Dependabot y `npm audit` en CI | Limitación declarada |
| 6. Autenticación y autorización estrictas antes del acceso | JWT authorizer + `authz` + MFA TOTP para GESTOR/AUDITOR | T02, T11, T14 |
| 7. Recolectar información para mejorar | Logs JSON con `requestId`, `AuditEvents` (incluye `ACCESS_DENIED`), CloudTrail | CA-NF07.2 |

## Limitaciones conocidas

1. **Revocación:** el JWT authorizer valida localmente; un access token sigue siendo válido hasta expirar aunque se haya revocado el refresh token. Mitigación: vida de 15 min (T13). Alternativa: Lambda authorizer con lista de revocación.
2. **Sin postura de dispositivo ni evaluación continua de riesgo** (Verified Access y Cognito Plus no están en el Free plan).
3. **HTTP API no se integra con AWS WAF.** Habría que asociar WAF a CloudFront o usar REST API, con costo.
4. **Cuenta compartida:** el aislamiento entre integrantes depende de IAM y de la disciplina del equipo.
5. **Scopes no ligados al grupo:** Cognito otorga a cualquier usuario todos los scopes permitidos al cliente; por eso el grupo se verifica siempre en Lambda (T12 lo demuestra con un token de GESTOR que sí tiene `api/donations.read`).
6. **Recarga de página:** con tokens en memoria, recargar cierra la sesión de la SPA; el managed login la restablece sin pedir contraseña mientras su cookie siga vigente.
