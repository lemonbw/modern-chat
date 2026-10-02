import { greenApiClient } from "../../../shared/api/greenApiClient";
import { greenApiUrl } from "../../../shared/api/greenApiConfig";

export const phoneAuth = (phone: string) =>
  greenApiClient.post<{ status?: boolean; data?: { reason?: string } }>(greenApiUrl("startAuthorization"), { phoneNumber: Number(phone) });

export const sendAuthorizationCode = (code: string) =>
  greenApiClient.post<{ status?: boolean; data?: { reason?: string } }>(greenApiUrl("sendAuthorizationCode"), { code });
