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

  // Here I support custom details (ex: BOOKING_HAS_DUE -> details.due)
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
 *  Here I perform a safe sign-out without React hooks:
 * - I dispatch a global event so AuthProvider clears BOTH token and user
 * - I redirect to /login
 *
 * This keeps auth cleanup centralized in AuthContext (single source of truth).
 */
function forceLogout() {
  // Here I ask AuthProvider to clear state (token + user) via a global event.
  window.dispatchEvent(new CustomEvent("auth:forceLogout"));

  // Here I keep the redirect simple and reliable.
  window.location.href = "/login";
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

    // Here I only start NProgress when the first request begins
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
    // Here I stop the loading bar when the request finishes successfully.
    stopProgressIfNeeded(response.config);
    return response;
  },
  (error) => {
    const cfg: any = error?.config;

    // Here I stop the loading bar when a request fails.
    stopProgressIfNeeded(cfg);

    const status = error?.response?.status;

    /**
     *  Here I auto-logout if the backend says I'm unauthorized (401).
     * This usually means the token expired/invalid or the user is not authenticated.
     */
    if (status === 401) {
      // Here I avoid noisy toasts for 401 because I'm redirecting anyway.
      // Also, I only logout if the request was not explicitly marked to ignore auth handling.
      if (!cfg?.ignoreAuthRedirect) {
        toast.error("Session expired. Please log in again.");
        forceLogout();
        return Promise.reject(error);
      }
    }

    /**
     * Optional: for 403 I usually show "not allowed" (no logout).
     * This means authenticated but missing role/permissions.
     */
    if (status === 403 && !cfg?.silentErrorToast) {
      toast.error("You don’t have permission to perform this action.");
      return Promise.reject(error);
    }

    /**
     * Here I show a global error toast unless it is explicitly disabled.
     *
     * Important:
     * - For pages that render their own inline error banner (like Reservations),
     *   you should call the request with { silentErrorToast: true }
     *   so you don't show duplicate messages.
     */
    if (!cfg?.silentErrorToast) {
      toast.error(getErrorMessage(error));
    }

    // Here I propagate the error so it can still be handled locally if needed.
    return Promise.reject(error);
  }
);

export default api;
