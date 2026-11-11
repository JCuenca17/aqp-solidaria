/** Errores de aplicación con formato uniforme { code, message, requestId } (design.md §4). */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string) => new AppError(400, 'BAD_REQUEST', message);
export const unauthorized = () => new AppError(401, 'UNAUTHORIZED', 'Autenticación requerida');
export const forbidden = () =>
  new AppError(403, 'FORBIDDEN', 'No tiene permiso para esta operación');
/** 404 genérico: no distingue "no existe" de "no es tuyo" para no filtrar información (BOLA). */
export const notFound = () => new AppError(404, 'NOT_FOUND', 'Recurso no encontrado');
export const conflict = (message: string) => new AppError(409, 'CONFLICT', message);
