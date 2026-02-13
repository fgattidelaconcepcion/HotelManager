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
 * Here I keep a small helper to stop NProgress safely.
 * I use this in both success and error paths.
 */
function stopProgressIfNeeded(config: any) {
  if (!config?.silentLoading) {
    activeRequests = Math.max(0, activeRequests - 1);
    if (activeRequests === 0) NProgress.done();
  }
}

/**
 * Here I normalize a good human-readable error message.
 * I prioritize backend "error" (your API uses it a lot), then "message".
 * I also support showing the due amount when the backend sends it.
 */
function getErrorMessage(error: any): string {
  const data = error?.response?.data;
  const code = data?.code as string | undefined;

  if (code === "BOOKING_HAS_DUE") {
    const due = data?.details?.due;
    if (typeof due === "number") {
      return `Cannot check-out while there is an outstanding balance (due: ${new Intl.NumberFormat(
        "en-UY",
        { style: "currency", currency: "UYU", minimumFractionDigits: 0 }
      ).format(due)}).`;
    }
    return "Cannot check-out while there is an outstanding balance.";
  }

  return data?.error || data?.message || "Unexpected error. Please try again.";
}

/**
 * Here I perform a safe sign-out without React hooks:
 * - I dispatch a global event so AuthProvider clears BOTH token and user
 * - I redirect to /login (but I avoid redirect loops)
 */
function forceLogout() {
  window.dispatchEvent(new CustomEvent("auth:forceLogout"));

  const path = window.location.pathname;
  if (path !== "/login" && path !== "/signup") {
    window.location.href = "/login";
  }
}

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
    if (activeRequests === 1) NProgress.start();
  }

  return config;
});

/* =====================================
   RESPONSE INTERCEPTOR
===================================== */

api.interceptors.response.use(
  (response) => {
    stopProgressIfNeeded(response.config);
    return response;
  },
  (error) => {
    const cfg: any = error?.config;

    stopProgressIfNeeded(cfg);

    const status = error?.response?.status;
    const url = String(cfg?.url ?? "");

    /**
     *  KEY FIX:
     * - I do NOT auto-logout for auth endpoints (login/register)
     * - I also allow callers to opt-out with ignoreAuthRedirect
     */
    const isAuthEndpoint =
      url.includes("/auth/login") ||
      url.includes("/auth/register") ||
      url.includes("/auth/register-hotel") ||
      url.includes("/auth/me");

    if (status === 401) {
      if (!cfg?.ignoreAuthRedirect && !isAuthEndpoint) {
        toast.error("Session expired. Please log in again.");
        forceLogout();
        return Promise.reject(error);
      }

      // For auth endpoints, I let the page handle the message
      return Promise.reject(error);
    }

    if (status === 403 && !cfg?.silentErrorToast) {
      toast.error("You don’t have permission to perform this action.");
      return Promise.reject(error);
    }

    if (!cfg?.silentErrorToast) {
      toast.error(getErrorMessage(error));
    }

    return Promise.reject(error);
  }
);

console.log("BUILD API URL:", import.meta.env.VITE_API_URL);


export default api;
