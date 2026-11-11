/**
 * Trigger Cognito "Pre authentication" (HU-11 / CA-11.1).
 *
 * El user pool tiene MFA en modo OPCIONAL (el donante puede no usarlo). Para que el
 * MFA sea OBLIGATORIO en GESTOR y AUDITOR, este trigger bloquea el inicio de sesión
 * de cualquier miembro de esos grupos que no tenga TOTP habilitado. Quien sí lo
 * tiene es retado por Cognito con el código TOTP: sin el segundo factor no obtiene
 * tokens (CA-11.2, T14). No se usa SMS.
 */
import {
  AdminGetUserCommand,
  AdminListGroupsForUserCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import type { PreAuthenticationTriggerEvent } from 'aws-lambda';
import { log } from '../shared/logger.js';

const cognito = new CognitoIdentityProviderClient({});
const PRIVILEGED = new Set(['GESTOR', 'AUDITOR']);

export const handler = async (
  event: PreAuthenticationTriggerEvent,
): Promise<PreAuthenticationTriggerEvent> => {
  const { userPoolId, userName } = event;
  const groups = await cognito.send(
    new AdminListGroupsForUserCommand({ UserPoolId: userPoolId, Username: userName }),
  );
  const isPrivileged = (groups.Groups ?? []).some(
    (g) => g.GroupName && PRIVILEGED.has(g.GroupName),
  );
  if (!isPrivileged) return event;

  const user = await cognito.send(
    new AdminGetUserCommand({ UserPoolId: userPoolId, Username: userName }),
  );
  const hasTotp = (user.UserMFASettingList ?? []).includes('SOFTWARE_TOKEN_MFA');
  if (!hasTotp) {
    log({ level: 'warn', action: 'PRE_AUTH', outcome: 'RECHAZADO', errorCode: 'MFA_REQUIRED' });
    throw new Error('Su rol requiere MFA con aplicación autenticadora. Contacte al administrador.');
  }
  return event;
};
