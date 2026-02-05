import axios from "axios";
import { toast } from "sonner";
import NProgress from "nprogress";
import "nprogress/nprogress.css";

/**
 * Here I configure NProgress to show a clean global loading bar
 * without a spinner and with smooth animation.
 */
NProgress.configure({
  showSpinner: false,
  trickleSpeed: 120,
  minimum: 0.08,
});

// Here I track how many API requests are currently active
let activeRequests = 0;

/**
 * Here I create a centralized Axios instance for the whole app.
 * All API calls go through this client.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { "Content-Type": "application/json" },
});

/* =====================================
   REQUEST INTERCEPTOR
===================================== */

api.interceptors.request.use((config: any) => {
  /**
   * Here I automatically attach the JWT token (if it exists)
   * to every outgoing request.
   */
  const token = localStorage.getItem("token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  /**
   * Here I handle the global loading bar.
   * I only start it if "silentLoading" is not enabled.
   */
  if (!config?.silentLoading) {
    activeRequests += 1;

    // I only start NProgress when the first request begins
    if (activeRequests === 1) {
      NProgress.start();
    }
  }

  return config;
});

/* =====================================
   RESPONSE INTERCEPTOR
===================================== */

api.interceptors.response.use(
  (response) => {
    const cfg: any = response.config;

    /**
     * Here I stop the loading bar when a request finishes.
     * I only stop it when there are no more active requests.
     */
    if (!cfg?.silentLoading) {
      activeRequests = Math.max(0, activeRequests - 1);

      if (activeRequests === 0) {
        NProgress.done();
      }
    }

    return response;
  },
  (error) => {
    const cfg: any = error?.config;

    /**
     * Here I also stop the loading bar when a request fails.
     */
    if (!cfg?.silentLoading) {
      activeRequests = Math.max(0, activeRequests - 1);

      if (activeRequests === 0) {
        NProgress.done();
      }
    }

    /**
     * Here I show a global error toast unless it is explicitly disabled.
     * This gives consistent feedback across the app.
     */
    if (!cfg?.silentErrorToast) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        "Unexpected error. Please try again.";

      toast.error(message);
    }

    // Here I propagate the error so it can still be handled locally if needed
    return Promise.reject(error);
  }
);

export default api;
