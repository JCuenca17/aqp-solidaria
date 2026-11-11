/** Configuración pública del cliente (no hay secretos en la SPA: design.md §3). */
export const config = {
  apiUrl: import.meta.env.VITE_API_URL as string,
  authority: import.meta.env.VITE_COGNITO_AUTHORITY as string,
  cognitoDomain: import.meta.env.VITE_COGNITO_DOMAIN as string,
  clientId: import.meta.env.VITE_CLIENT_ID as string,
  stage: (import.meta.env.VITE_STAGE as string | undefined) ?? 'academic',
};

export const isAcademic = config.stage === 'academic';
