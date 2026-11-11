// Diseño de la extensión HU-12 (no desplegado). Equivale a POLICY en backend/src/authz/index.ts.

// HU-08: solo GESTOR crea y publica proyectos.
permit (
  principal in AqpSolidaria::Group::"GESTOR",
  action in [AqpSolidaria::Action::"project:create", AqpSolidaria::Action::"project:publish"],
  resource
);

// HU-05: solo DONANTE crea intenciones de donación.
permit (
  principal in AqpSolidaria::Group::"DONANTE",
  action == AqpSolidaria::Action::"donation:create",
  resource
);

// HU-06 / HU-07: solo el DONANTE propietario lee o simula su donación.
permit (
  principal in AqpSolidaria::Group::"DONANTE",
  action in [AqpSolidaria::Action::"donation:readOwn", AqpSolidaria::Action::"donation:simulate"],
  resource is AqpSolidaria::Donation
)
when { resource.donorSub == principal.sub };

// HU-10: solo AUDITOR consulta auditoría.
permit (
  principal in AqpSolidaria::Group::"AUDITOR",
  action == AqpSolidaria::Action::"audit:read",
  resource
);
