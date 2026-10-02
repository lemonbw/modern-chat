import axios from "axios";
import { greenApiUrl } from "../../../shared/api/greenApiConfig";

export const phoneAuth = (phone: string) =>
  axios.post<{ status?: boolean; data?: { reason?: string } }>(greenApiUrl("startAuthorization"), { phoneNumber: Number(phone) });

export const sendAuthorizationCode = (code: string) =>
  axios.post<{ status?: boolean; data?: { reason?: string } }>(greenApiUrl("sendAuthorizationCode"), { code });
