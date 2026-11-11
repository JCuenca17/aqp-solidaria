/** Cliente del API. Envía el ACCESS token (nunca el ID token) como Bearer. */
import { config } from '../config';

export interface PublicProject {
  projectId: string;
  title: string;
  description: string;
  goalAmountCents: number;
  confirmedAmountCents: number;
  currency: 'PEN';
  status: 'BORRADOR' | 'PUBLICADO';
  createdAt: string;
}

export interface ProjectStats {
  projectId: string;
  currency: 'PEN';
  goalAmountCents: number;
  confirmedAmountCents: number;
  confirmedDonationsCount: number;
  progressPercent: number;
}

export type DonationStatus = 'PENDIENTE_SIMULACION' | 'CONFIRMADA_SIMULADA' | 'RECHAZADA_SIMULADA';

export interface Donation {
  donationId: string;
  projectId: string;
  projectTitle: string;
  amountCents: number;
  currency: 'PEN';
  status: DonationStatus;
  createdAt: string;
  updatedAt: string;
  notice?: string;
}

export interface AuditEvent {
  eventType: string;
  eventId: string;
  timestamp: string;
  requestId: string;
  actorRef: string;
  action: string;
  resourceRef: string;
  outcome: 'EXITO' | 'RECHAZADO';
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly requestId?: string,
  ) {
    super(message);
  }
}

const FRIENDLY: Record<number, string> = {
  401: 'Tu sesión no es válida o expiró. Inicia sesión nuevamente.',
  403: 'No tienes permiso para realizar esta acción.',
  404: 'No encontramos lo que buscas.',
  409: 'La operación no se pudo completar porque el estado cambió.',
  429: 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.',
};

export async function apiFetch<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    token?: string | null;
    headers?: Record<string, string>;
  } = {},
): Promise<T> {
  const headers: Record<string, string> = { ...options.headers };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  let res: Response;
  try {
    res = await fetch(`${config.apiUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor. Revisa tu conexión.');
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const serverMsg = typeof data.message === 'string' ? data.message : undefined;
    const msg =
      res.status === 400 && serverMsg
        ? serverMsg
        : (FRIENDLY[res.status] ?? 'Ocurrió un error inesperado.');
    throw new ApiError(
      res.status,
      msg,
      typeof data.requestId === 'string' ? data.requestId : undefined,
    );
  }
  return data as T;
}

export const api = {
  listProjects: () => apiFetch<{ items: PublicProject[] }>('/v1/projects'),
  getProject: (id: string) => apiFetch<PublicProject>(`/v1/projects/${encodeURIComponent(id)}`),
  getStats: (id: string) => apiFetch<ProjectStats>(`/v1/projects/${encodeURIComponent(id)}/stats`),
  createDonation: (token: string | null, projectId: string, amountCents: number, key: string) =>
    apiFetch<Donation>('/v1/donations', {
      method: 'POST',
      token,
      body: { projectId, amountCents },
      headers: { 'Idempotency-Key': key },
    }),
  simulate: (token: string | null, donationId: string, outcome: 'CONFIRMAR' | 'RECHAZAR') =>
    apiFetch<Donation>(`/v1/donations/${encodeURIComponent(donationId)}/simulate`, {
      method: 'POST',
      token,
      body: { outcome },
    }),
  myDonations: (token: string | null) =>
    apiFetch<{ items: Donation[] }>('/v1/donations/me', { token }),
  manageList: (token: string | null) =>
    apiFetch<{ items: PublicProject[] }>('/v1/manage/projects', { token }),
  createProject: (
    token: string | null,
    body: { title: string; description: string; goalAmountCents: number },
  ) => apiFetch<PublicProject>('/v1/projects', { method: 'POST', token, body }),
  publishProject: (token: string | null, id: string) =>
    apiFetch<PublicProject>(`/v1/projects/${encodeURIComponent(id)}/publish`, {
      method: 'PATCH',
      token,
    }),
  audit: (token: string | null, params: Record<string, string>) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
    return apiFetch<{ items: AuditEvent[] }>(`/v1/audit${qs.size ? `?${qs.toString()}` : ''}`, {
      token,
    });
  },
};
