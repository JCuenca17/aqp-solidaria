# Políticas Cedar (extensión HU-12)

La extensión HU-12 (autorización externalizada con Amazon Verified Permissions) **no está implementada** en esta entrega.
La autorización del MVP vive en `backend/src/authz/index.ts` como una matriz explícita (`POLICY`) más reglas de propiedad.

`authz.cedar` muestra cómo se expresarían esas mismas reglas en Cedar si se activa la extensión; se incluye como diseño, no como código en ejecución.
