import axios from "axios";

declare module "axios" {
  interface AxiosRequestConfig {
    /** Keeps the unauthorized handler out of this request so it can report the error itself. */
    reportUnauthorized?: boolean;
  }
}

/** Fired when GREEN-API answers 401 so the session layer can drop back to the login page. */
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