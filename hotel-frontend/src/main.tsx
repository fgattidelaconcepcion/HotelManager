import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { Toaster } from "sonner";
import { registerSW } from "virtual:pwa-register";

/**
 * Here I register the Service Worker for PWA support.
 * With `immediate: true`, I install/update it as soon as the app loads.
 */
registerSW({ immediate: true });

/**
 * Here I mount my React application into the #root element.
 * I wrap it in StrictMode to catch potential issues in development.
 */
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* Here I render the main application */}
    <App />

    {/* Here I mount the global toast system so any page can show notifications */}
    <Toaster richColors position="top-right" closeButton />
  </React.StrictMode>
);
