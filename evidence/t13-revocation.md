# T13 — Token con refresh revocado usado antes y después de expirar

Vida del access token: 15 minutos (CA-03.3: ≤ 15). Expira: 2026-11-11T20:44:37.000Z.

| Hora (UTC) | Momento | HTTP |
|---|---|---|
| 2026-11-11T20:32:41.620Z | antes de expirar | 200 |
| 2026-11-11T20:33:41.786Z | antes de expirar | 200 |
| 2026-11-11T20:34:41.944Z | antes de expirar | 200 |
| 2026-11-11T20:35:42.169Z | antes de expirar | 200 |
| 2026-11-11T20:36:42.359Z | antes de expirar | 200 |
| 2026-11-11T20:37:42.683Z | antes de expirar | 200 |
| 2026-11-11T20:38:42.897Z | antes de expirar | 200 |
| 2026-11-11T20:39:43.181Z | antes de expirar | 200 |
| 2026-11-11T20:40:43.355Z | antes de expirar | 200 |
| 2026-11-11T20:41:43.522Z | antes de expirar | 200 |
| 2026-11-11T20:42:43.713Z | antes de expirar | 200 |
| 2026-11-11T20:43:44.031Z | antes de expirar | 200 |
| 2026-11-11T20:44:44.147Z | después de expirar | 401 |

Resultado: aceptado hasta expirar (limitación del JWT authorizer, que valida localmente) y rechazado después.
