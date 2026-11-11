# Plan de implementación — Plataforma de Donaciones Seguras (AQP-SOLIDARIA)

**Especificación:** [requirements.md](./requirements.md) · **Diseño:** [design.md](./design.md)
**Periodo:** 10/11/2026 – 13/11/2026 · **Entrega:** 13/11/2026

Tercer documento del ciclo de desarrollo dirigido por especificación (SDD): `requirements.md` dice **qué**, `design.md` dice **cómo** y este archivo dice **en qué orden** y **cómo se verifica** cada paso. Cada tarea indica los requisitos que cubre (HU/CA/RNF-HU) y la prueba que la valida (unitaria o T01–T14).

> Nota de proceso: este plan se formalizó por escrito el 11/11/2026, cuando el código del MVP ya estaba en marcha. Las tareas 1–7 se registran como completadas con su evidencia y las 8–13 se ejecutan siguiendo este archivo.

**Leyenda:** `[x]` completada y verificada · `[ ]` pendiente · `[~]` en curso

---

## Fase 1 — Análisis (10/11)

- [x] **1. Analizar la especificación y modelar amenazas**
  - Leer `requirements.md` y `design.md`; identificar roles, estados de donación e invariantes.
  - Redactar STRIDE resumido y mapeo NIST SP 800-207 (PEP/PE/PA y 7 principios).
  - _Requisitos: RNF-HU-02 (CA-NF02.3)_ · _Evidencia: `docs/threat-model.md`_

## Fase 2 — Base del repositorio (11/11)

- [x] **2. Estructura del repositorio y calidad**
  - [x] 2.1 Estructura de carpetas de design.md §8 (`backend/`, `frontend/`, `infra/`, `docs/`, `evidence/`, `policies/`).
  - [x] 2.2 Fijar versiones exactas y justificar TypeScript 6.0.3 (compatibilidad con typescript-eslint) en el README.
  - [x] 2.3 ESLint, Prettier, typecheck estricto y Vitest en backend y frontend.
  - [x] 2.4 CI en GitHub Actions: lint, typecheck, tests, build, `npm audit` y `cfn-lint`; Dependabot.
  - _Requisitos: RNF-HU-08 (CA-NF08.1)_ · _Evidencia: `.github/workflows/ci.yml`_

## Fase 3 — Backend (11/11)

- [x] **3. Módulo compartido**
  - [x] 3.1 Esquemas Zod: `amountCents` entero 100–100000, `strictObject` (rechaza `donorSub` y datos de pago).
    - _Requisitos: CA-05.1, CA-05.2, CA-05.3, CA-05.5, CA-08.1_ · _Prueba: `test/schemas.test.ts`_
  - [x] 3.2 Errores uniformes `{ code, message, requestId }` y 404 genérico anti-BOLA.
  - [x] 3.3 Logger JSON con lista blanca de campos (sin tokens ni datos personales).
    - _Requisitos: CA-NF01.2, CA-NF07.1_

- [x] **4. Módulo `authz` (Policy Engine)**
  - [x] 4.1 Identidad (`sub`, `cognito:groups`, scopes) solo desde claims verificados; rechazar `token_use ≠ access`.
    - _Requisitos: CA-04.3, CA-NF02.1, CA-NF02.2_
  - [x] 4.2 Matriz `POLICY` (grupo + scope por acción) y regla de ownership.
    - _Requisitos: HU-04, CA-07.2_ · _Prueba: `test/authz.test.ts` (T03, T09, T12 unitarios)_
  - [x] 4.3 Seudonimización del actor para auditoría.
    - _Requisitos: CA-10.2_

- [x] **5. Casos de uso**
  - [x] 5.1 Catálogo, detalle y estadísticas públicos (solo PUBLICADO).
    - _Requisitos: HU-01, HU-02, HU-09_ · _Prueba: T01, CA-01.3, CA-02.2, CA-09.2_
  - [x] 5.2 Gestión de proyectos (crear BORRADOR, publicar, 409 si ya publicado) con auditoría.
    - _Requisitos: HU-08_ · _Prueba: T03, CA-08.2, CA-08.3_
  - [x] 5.3 Intención de donación con idempotencia atómica (`TransactWriteItems`: clave + donación + proyecto PUBLICADO).
    - _Requisitos: HU-05, RNF-HU-04 (CA-NF04.2)_ · _Prueba: T04, T05, T06, T07, carrera con misma clave_
  - [x] 5.4 Simulación con transición única condicionada y reintento ante `TransactionConflict`.
    - _Requisitos: HU-06, CA-NF04.1_ · _Prueba: T08 unitario, CA-06.2, CA-06.3_
  - [x] 5.5 Historial propio y lectura de donación con ownership.
    - _Requisitos: HU-07_ · _Prueba: T09, T12, CA-07.1_
  - [x] 5.6 Consulta de auditoría (extensión).
    - _Requisitos: HU-10_
  - [x] 5.7 Trigger PreAuth: bloquear GESTOR/AUDITOR sin TOTP.
    - _Requisitos: HU-11 (CA-11.1)_
  - _Verificación de la fase: 73 pruebas unitarias en verde, typecheck y lint limpios._

## Fase 4 — Infraestructura como código (11/11)

- [x] **6. Plantilla AWS SAM (`infra/template.yaml`)**
  - [x] 6.1 DynamoDB on-demand: Projects (GSI `status-createdAt`), Donations (GSI `donorSub-createdAt`), Idempotency (TTL 24 h), AuditEvents.
  - [x] 6.2 Cognito: grupos, resource server con scopes, cliente SPA (code + PKCE, access token 15 min, revocación), cliente de enrolamiento sin scopes, MFA TOTP sin SMS.
    - _Requisitos: HU-03, HU-11, CA-03.1, CA-03.3_
  - [x] 6.3 HTTP API con JWT authorizer, `AuthorizationScopes` por ruta, CORS, throttling y access logs sin datos sensibles.
    - _Requisitos: CA-03.2, CA-NF02.1, CA-NF07.1_
  - [x] 6.4 Una función y un rol IAM mínimo por caso de uso; ruta de simulación condicionada al stage `academic`.
    - _Requisitos: CA-06.1, RNF-HU-03_
  - [x] 6.5 S3 privado + CloudFront OAC + response headers policy (CSP, HSTS, nosniff, Referrer-Policy).
    - _Requisitos: RNF-HU-01, RNF-HU-11 (CA-NF11.2)_
  - [x] 6.6 Retención de logs de 14 días.
    - _Requisitos: CA-NF07.1_
  - _Verificación: `cfn-lint` 1.60 sin errores._

## Fase 5 — Frontend (11/11)

- [x] **7. SPA React**
  - [x] 7.1 Login OIDC con `oidc-client-ts` (PKCE, tokens en memoria, revocación al salir).
    - _Requisitos: HU-03, CA-NF11.1_
  - [x] 7.2 Catálogo con estado vacío, detalle con progreso y montos en PEN.
    - _Requisitos: HU-01, HU-02, HU-09_
  - [x] 7.3 Formulario de donación (solo monto, Idempotency-Key por intento, aviso de simulación).
    - _Requisitos: HU-05, CA-05.5, CA-06.4_ · _Prueba: `DonateForm.test.tsx`_
  - [x] 7.4 Historial con botones de simulación, gestión y auditoría.
    - _Requisitos: HU-06, HU-07, HU-08, HU-10_
  - [x] 7.5 Accesibilidad: etiquetas, foco visible, `role="alert"`, objetivos de 44 px, salto al contenido, diseño a 375 px.
    - _Requisitos: RNF-HU-06_
  - [x] 7.6 Aviso permanente de prototipo académico.
    - _Requisitos: RNF-HU-10 (CA-NF10.2)_
  - _Verificación: 4 pruebas de UI, typecheck, lint y build de producción._

## Fase 6 — Cuenta y despliegue (12/11)

- [ ] **8. Cuenta AWS Free plan segura**
  - [x] 8.1 Crear la cuenta Free plan.
  - [x] 8.2 MFA en el AWS Builder ID del dueño (la cuenta nueva no tiene usuario root): settings.aws.com → *Manage security and sign-in*. Hecho el 11/11: TOTP registrado y correo de recuperación añadido.
  - [x] 8.3 Región: asignada por AWS según el país (Perú → `us-east-2`, Ohio); plantilla y scripts ajustados.
  - [ ] 8.4 Presupuesto de gasto cero en AWS Budgets (captura).
  - [ ] 8.5 Invitar a cada integrante como miembro del equipo (Builder ID propio con MFA); sin usuarios IAM de consola ni llaves (captura).
  - _Nota: la nueva experiencia de AWS no permite usuario root ni usuarios IAM con consola; se documenta como desviación en el informe §9._
  - _Requisitos: RNF-HU-03 (CA-NF03.3), RNF-HU-09 (CA-NF09.1)_ · _Guía: `docs/guia-cuenta-aws.md`_

- [ ] **9. Repositorio en GitHub**
  - [ ] 9.1 Publicar el repositorio y proteger `main` (PR + 1 revisión + CI obligatorio).
  - [ ] 9.2 Invitar a los integrantes; verificar el CI en verde.
  - _Requisitos: RNF-HU-08, DoD (e)_

- [ ] **10. Despliegue en el stage `academic`**
  - [ ] 10.1 `bash scripts/deploy.sh` desde CloudShell; anotar WebUrl y ApiUrl.
  - [ ] 10.2 `create-users.sh` y `enroll-totp.sh` para GESTOR y AUDITOR.
  - [ ] 10.3 Crear y publicar proyectos de prueba (`seed-projects.mjs` para 50).
  - [ ] 10.4 Verificar las cabeceras de seguridad de CloudFront (DevTools → Red, captura).
  - _Requisitos: CA-NF01.1, CA-NF11.2, CA-NF08.2_

## Fase 7 — Verificación (13/11)

- [ ] **11. Pruebas de aceptación con evidencia**
  - [ ] 11.1 `security-tests.mjs`: T01–T09, T11, T12.
  - [ ] 11.2 `t10-iam-check.sh`: T10.
  - [ ] 11.3 `t13-revocation.mjs`: T13 (≈15 min).
  - [ ] 11.4 `t14-mfa-check.sh` y captura del login con TOTP: T14 / CA-11.2.
  - [ ] 11.5 `perf-test.mjs` con 50 proyectos: RNF-HU-05.
  - [ ] 11.6 Capturas de CloudWatch (un caso exitoso y uno 401/403) y de CloudTrail: CA-NF07.2.
  - [ ] 11.7 Revisión manual a 375 px y con teclado: RNF-HU-06.
  - _Requisitos: DoD (b), (c)_ · _Evidencia: `evidence/`_

- [ ] **12. Documentación y entrega**
  - [ ] 12.1 Completar los `[ ]` del informe técnico con los resultados reales.
  - [ ] 12.2 Completar `AI_USAGE.md` (participantes, PR, validación humana).
  - [ ] 12.3 Ensayar la demo con los cuatro roles; cada integrante explica su módulo.
  - _Requisitos: DoD (a), (f), (g)_

## Fase 8 — Cierre (después de la evaluación)

- [ ] **13. Limpieza de recursos**
  - [ ] 13.1 `bash scripts/cleanup.sh` y verificación en Resource Explorer.
  - _Requisitos: RNF-HU-09 (CA-NF09.2), DoD (h)_

---

## Fuera de alcance en esta entrega

- **HU-12 (extensión):** autorización externalizada con Amazon Verified Permissions. Solo se deja el diseño en Cedar (`policies/authz.cedar`); no se ejecuta.

## Matriz de trazabilidad resumida

| Requisito | Tareas | Prueba |
|---|---|---|
| HU-01 / HU-02 / HU-09 | 5.1, 7.2 | T01, unitarias CA-01.3, CA-02.2, CA-09.2 |
| HU-03 | 6.2, 7.1 | T02, T11, T13 |
| HU-04 | 4.1, 4.2 | T03, T12 |
| HU-05 | 3.1, 5.3, 7.3 | T04, T05, T06, T07 |
| HU-06 | 5.4, 6.4 | T08 |
| HU-07 | 5.5 | T09 |
| HU-08 | 5.2 | T03, unitarias CA-08.2/08.3 |
| HU-10 | 5.6, 7.4 | Unitaria HU-10 |
| HU-11 | 5.7, 6.2, 10.2 | T14 |
| RNF-HU-01 / 11 | 6.5, 10.4 | Captura de cabeceras |
| RNF-HU-03 | 6.4, 8.5 | T10 |
| RNF-HU-04 | 5.3, 5.4 | T06–T08 |
| RNF-HU-05 | 10.3, 11.5 | `perf-rnf-hu-05.md` |
| RNF-HU-06 | 7.5, 11.7 | `DonateForm.test.tsx`, revisión manual |
| RNF-HU-07 | 3.3, 6.6, 11.6 | Capturas CloudWatch/CloudTrail |
| RNF-HU-08 | 2.x | CI en verde |
| RNF-HU-09 | 8.4, 13 | Captura Budgets, `cleanup.sh` |
