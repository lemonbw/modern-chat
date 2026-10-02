import axios from "axios";
import type { AxiosResponse } from "axios";

declare module "axios" {
  interface AxiosRequestConfig {
    reportUnauthorized?: boolean;
    /** Set once the write grant was requested, so the same call is not retried in a loop. */
    grantRetried?: boolean;
  }
}

export const unauthorizedEvent = "modern-chat:unauthorized";
export const sessionExpiredEvent = "modern-chat:session-expired";
export const writeGrantEvent = "modern-chat:write-grant";

export type WriteGrantRequest = { retry: () => Promise<AxiosResponse> };

const defaultReportUnauthorized = true;

export const greenApiClient = axios.create();

const headerValue = (headers: unknown, name: string) => {
  if (!headers || typeof headers !== "object") return "";
  const getter = (headers as { get?: (key: string) => unknown }).get;
  if (typeof getter === "function") {
    const value = getter.call(headers, name);
    return typeof value === "string" ? value : "";
  }
  const record = headers as Record<string, unknown>;
  const value = record[name] ?? record[name.toLowerCase()];
  return typeof value === "string" ? value : "";
};

const errorCode = (data: unknown) => {
  if (!data || typeof data !== "object") return "";
  const code = (data as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
};

greenApiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response) {
      const config = error.config;
      const status = error.response.status;
      const data = error.response.data as unknown;

      if (status === 401 && headerValue(error.response.headers, "www-authenticate").includes("Session")) {
        window.dispatchEvent(new Event(sessionExpiredEvent));
      } else if (status === 401 && (config?.reportUnauthorized ?? defaultReportUnauthorized)) {
        window.dispatchEvent(new Event(unauthorizedEvent));
      }

      if (status === 403 && errorCode(data) === "write_grant_required" && config && !config.grantRetried) {
        config.grantRetried = true;
        const detail: WriteGrantRequest = { retry: () => greenApiClient.request(config) };
        window.dispatchEvent(new CustomEvent(writeGrantEvent, { detail }));
      }
    }
    return Promise.reject(error);
  },
);