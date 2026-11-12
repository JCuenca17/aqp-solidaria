# Evidencias de pruebas (stage `academic`, 11/11/2026)

Generadas por los scripts de `scripts/` ejecutados desde AWS CloudShell (us-east-2). Ningún archivo contiene tokens, contraseñas ni datos personales; los usuarios son ficticios (`@example.com`).

| Archivo | Pruebas | Resultado |
|---|---|---|
| `security-tests-2026-11-11T15-33-42-342Z.md` | T01–T09, T11, T12 | 10/11 con el criterio original. T11: el ID token devolvió **403** en lugar de 401; se rechazó en el PEP sin llegar a Lambda. Ver la explicación abajo. |
| `t10-iam-simulator.md` | T10 | Escrituras `implicitDeny`, lecturas `allowed` (control) |
| `t13-revocation.md` | T13 | 200 hasta expirar el token (15 min) tras revocar el refresh token; 401 después |
| `t14-mfa.md` | T14 | GESTOR sin TOTP: reto `SOFTWARE_TOKEN_MFA`, sin tokens |
| `perf-rnf-hu-05.md` | RNF-HU-05 | p95 = 38 ms con 50 proyectos (criterio ≤ 1500 ms) |

## Nota sobre T11

El reporte se conserva tal como se generó. El ID token de Cognito tiene firma, emisor y `aud` válidos, pero no los scopes de la ruta, así que el JWT authorizer de HTTP API responde **403** (`insufficient_scope`, RFC 6750 §3.1); ese código no es configurable. El objetivo de CA-NF02.1 se cumple: el ID token no sirve como credencial. El script `security-tests.mjs` se ajustó después para aceptar 401 o 403 **solo** para el ID token. El token alterado y el token basura siguen exigiendo 401. Detalle en `docs/informe-tecnico.md` §4.4.

## Capturas (carpeta `capturas/`)

Capturas de pantalla sanitizadas, sin IP, secretos TOTP ni tokens:
CloudWatch 401 y 201 (CA-NF07.2), CloudTrail CreateChangeSet, login con TOTP (T14 / CA-11.2), demo a 375 px: catálogo, formulario e historial (RNF-HU-06), presupuesto de gasto cero (RNF-HU-09), equipo con MFA (CA-NF03.3), cabeceras de CloudFront (CA-NF11.2).
