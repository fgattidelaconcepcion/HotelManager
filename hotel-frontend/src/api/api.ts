import axios from "axios";
import { toast } from "sonner";
import NProgress from "nprogress";
import "nprogress/nprogress.css";

NProgress.configure({
  showSpinner: false,
  trickleSpeed: 120,
  minimum: 0.08,
});

let activeRequests = 0;

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { "Content-Type": "application/json" },
});


api.interceptors.request.use((config: any) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Loader global
  if (!config?.silentLoading) {
    activeRequests += 1;
    if (activeRequests === 1) NProgress.start();
  }

  return config;
});

api.interceptors.response.use(
  (response) => {
    const cfg: any = response.config;
    if (!cfg?.silentLoading) {
      activeRequests = Math.max(0, activeRequests - 1);
      if (activeRequests === 0) NProgress.done();
    }
    return response;
  },
  (error) => {
    const cfg: any = error?.config;

    // Loader global
    if (!cfg?.silentLoading) {
      activeRequests = Math.max(0, activeRequests - 1);
      if (activeRequests === 0) NProgress.done();
    }

    // Toast de error global
    if (!cfg?.silentErrorToast) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        "Unexpected error. Please try again.";
      toast.error(message);
    }

    return Promise.reject(error);
  }
);

export default api;
