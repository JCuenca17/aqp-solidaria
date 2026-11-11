# RNF-HU-05 — Rendimiento de GET del backend

- **Herramienta:** script Node.js `scripts/perf-test.mjs` (fetch nativo, Node v20.20.2).
- **Cliente:** AWS CloudShell us-east-2 (misma región que el API).
- **Condiciones:** 50 proyectos publicados; 5 solicitudes de calentamiento descartadas (cold start excluido); 200 solicitudes medidas a 10 solicitudes/s (debajo del throttling de 25 rps), mitad a `/v1/projects` y mitad a `/v1/projects/{id}`.

| Métrica | Valor (ms) |
|---|---|
| p50 | 22 |
| p95 | 38 |
| p99 | 77 |
| máx | 100 |
| errores | 0 |
| códigos HTTP | 200×200 |

Percentiles calculados solo con respuestas 200.

**Criterio CA-NF05.1 (p95 ≤ 1500 ms):** ✅ cumple.
