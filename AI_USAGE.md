# Declaración de uso de asistentes de IA (design.md §10)

> Completar los campos entre corchetes antes de la entrega. Cada cambio generado con IA entra por PR y lo revisa un integrante distinto de quien lo generó.

| Campo | Contenido |
|---|---|
| **Herramienta/modelo** | Claude Code (CLI de Anthropic), modelo Claude Opus 5.5 (`claude-opus-5-5`). |
| **Participantes** | Operó la herramienta: Cuenca Gutierrez Jose Luis. Revisión de PR a partir de la protección de `main` (11/11): cualquier otro integrante (Chancuaña Alvis Klismann, Hidalgo Chinchay Paulo Andre, Mamani Solórzano Efraín Alex, Soto Ccoya Gabriel Eduardo). |
| **Tareas asistidas** | Planificación a partir de `requirements.md` y `design.md` (día 1–2); scaffolding del repositorio; backend (`authz`, `projects`, `donations`, `audit`, handlers) para HU-01 a HU-11; plantilla SAM; SPA React; pruebas unitarias; scripts de prueba T01–T14 y de rendimiento; OpenAPI, threat model, README y borrador del informe. |
| **Aportes IA** | Código, plantilla SAM, scripts y documentos del repositorio (historial de commits del 11/11 en `main`; desde la protección de `main`, por PR). Detalle por módulo en la tabla de abajo. |
| **Validación humana** | Jose Luis Cuenca desplegó en AWS y ejecutó T01–T14 y RNF-HU-05 desde CloudShell (`evidence/`). La ejecución real reveló cinco problemas que el asistente no había detectado y que se corrigieron: `Authorizer: NONE` sin `DefaultAuthorizer` (SAM), CORS no aplicado por un `!If` en `AllowOrigins`, T11 con 403 en lugar de 401, T10 sin contexto de región ante las SCP de AWS, y 429 en la prueba de rendimiento por el throttling. |
| **Limitaciones** | Ver la sección de abajo. |

## Detalle por artefacto

| Artefacto | Generado por IA | Verificación realizada |
|---|---|---|
| `backend/src/**` | Sí | Typecheck estricto, ESLint y 73 pruebas unitarias con DynamoDB simulado (`aws-sdk-client-mock`). [Revisión humana: completar] |
| `infra/template.yaml` | Sí | `cfn-lint` y `scripts/validate-sam.py` (traductor oficial de SAM) en CI. Políticas IAM revisadas: ninguna con `Action: "*"`; el único `Resource` con comodín (`userpool/*` del trigger PreAuth) está justificado por una dependencia circular. Desplegado en us-east-2 el 11/11 tras dos correcciones (ver arriba). |
| `frontend/src/**` | Sí | Typecheck, ESLint, 4 pruebas de UI y build de producción. [Prueba manual a 375 px y con teclado: completar] |
| `scripts/*.mjs`, `scripts/*.sh` | Sí | Ejecutados contra el stage `academic` el 11/11; resultados en `evidence/`. |
| `docs/*`, `README.md` | Sí (borrador) | [Revisión y ajuste del equipo: completar] |

## Decisiones donde el asistente detectó riesgos

- **Conflictos transaccionales en T08:** con 10 confirmaciones concurrentes, DynamoDB puede cancelar transacciones entre sí (`TransactionConflict`) sin que ninguna gane. Se agregó un reintento acotado que relee el estado. La condición `status = PENDIENTE_SIMULACION` sigue garantizando un único incremento. Prueba: "RNF-HU-04: un TransactionConflict se reintenta…".
- **Scopes no ligados a grupos en Cognito:** cualquier usuario recibe todos los scopes del cliente. Por eso el grupo se verifica siempre en Lambda (T12).
- **TypeScript 7 vs typescript-eslint:** se fijó TypeScript 6.0.3 por compatibilidad (ver README).

## Limitaciones y resultados no verificados

- Hasta la protección de `main` (11/11), los cambios se subieron directamente a `main` por el plazo de entrega, sin revisión por PR. Desde ese momento todo cambio entra por PR con revisión de otro integrante.
- La prueba T08 unitaria simula la respuesta de DynamoDB. La garantía real la da la ejecución de `scripts/security-tests.mjs` contra AWS.
- La accesibilidad se diseñó con criterios WCAG 2.2 AA (etiquetas, foco visible, mensajes `role="alert"`), pero falta una revisión manual con lector de pantalla.
- No se compartieron con el asistente credenciales AWS, tokens, archivos `.env` reales ni datos personales. El asistente no ejecutó comandos sobre la cuenta AWS.
