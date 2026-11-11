# Declaración de uso de asistentes de IA (design.md §10)

> Completar los campos entre corchetes antes de la entrega. Cada cambio generado con IA entra por PR y lo revisa un integrante distinto de quien lo generó.

| Campo | Contenido |
|---|---|
| **Herramienta/modelo** | Claude Code (CLI de Anthropic), modelo Claude Opus 5.5 (`claude-opus-5-5`). |
| **Participantes** | [Integrante que operó la herramienta]; revisión de PR: [integrante(s) revisor(es)]. |
| **Tareas asistidas** | Planificación a partir de `requirements.md` y `design.md` (día 1–2); scaffolding del repositorio; backend (`authz`, `projects`, `donations`, `audit`, handlers) para HU-01 a HU-11; plantilla SAM; SPA React; pruebas unitarias; scripts de prueba T01–T14 y de rendimiento; OpenAPI, threat model, README y borrador del informe. |
| **Aportes IA** | Código y documentos iniciales del repositorio: [enlace al PR #1]. Detalle por módulo en la tabla de abajo. |
| **Validación humana** | [Completar: quién revisó cada PR, qué se corrigió y qué pruebas se ejecutaron en AWS: T01–T14, T10 con IAM Policy Simulator, T14 con captura del login.] |
| **Limitaciones** | Ver la sección de abajo. |

## Detalle por artefacto

| Artefacto | Generado por IA | Verificación realizada |
|---|---|---|
| `backend/src/**` | Sí | Typecheck estricto, ESLint y 73 pruebas unitarias con DynamoDB simulado (`aws-sdk-client-mock`). [Revisión humana: completar] |
| `infra/template.yaml` | Sí | `cfn-lint` 1.60 sin errores (incluye la transformación SAM). Políticas IAM revisadas: ninguna con `Action: "*"`. El único `Resource` con comodín (`userpool/*` en el trigger PreAuth) está justificado en el propio archivo por una dependencia circular. [Despliegue real: completar] |
| `frontend/src/**` | Sí | Typecheck, ESLint, 4 pruebas de UI y build de producción. [Prueba manual a 375 px y con teclado: completar] |
| `scripts/*.mjs`, `scripts/*.sh` | Sí | [Ejecución contra el stage `academic`: completar] |
| `docs/*`, `README.md` | Sí (borrador) | [Revisión y ajuste del equipo: completar] |

## Decisiones donde el asistente detectó riesgos

- **Conflictos transaccionales en T08:** con 10 confirmaciones concurrentes, DynamoDB puede cancelar transacciones entre sí (`TransactionConflict`) sin que ninguna gane. Se agregó un reintento acotado que relee el estado. La condición `status = PENDIENTE_SIMULACION` sigue garantizando un único incremento. Prueba: "RNF-HU-04: un TransactionConflict se reintenta…".
- **Scopes no ligados a grupos en Cognito:** cualquier usuario recibe todos los scopes del cliente. Por eso el grupo se verifica siempre en Lambda (T12).
- **TypeScript 7 vs typescript-eslint:** se fijó TypeScript 6.0.3 por compatibilidad (ver README).

## Limitaciones y resultados no verificados

- Al redactar esta declaración, el sistema aún **no se había desplegado en AWS**. Las pruebas T01–T14 contra el stage real, el rendimiento y las cabeceras de CloudFront deben ejecutarse y registrarse en `evidence/` antes de la entrega.
- La prueba T08 unitaria simula la respuesta de DynamoDB. La garantía real la da la ejecución de `scripts/security-tests.mjs` contra AWS.
- La accesibilidad se diseñó con criterios WCAG 2.2 AA (etiquetas, foco visible, mensajes `role="alert"`), pero falta una revisión manual con lector de pantalla.
- No se compartieron con el asistente credenciales AWS, tokens, archivos `.env` reales ni datos personales. El asistente no ejecutó comandos sobre la cuenta AWS.
