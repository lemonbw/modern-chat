import axios from "axios";

declare module "axios" {
  interface AxiosRequestConfig {
    reportUnauthorized?: boolean;
  }
}

export const unauthorizedEvent = "modern-chat:unauthorized";

const defaultReportUnauthorized = true;

export const greenApiClient = axios.create();

greenApiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      if (error.config?.reportUnauthorized ?? defaultReportUnauthorized) {
        window.dispatchEvent(new Event(unauthorizedEvent));
      }
    }
    return Promise.reject(error);
  },
);