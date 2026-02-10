import React from "react";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import { Toaster } from "sonner";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Rooms from "./pages/Rooms";
import RoomFormPage from "./pages/RoomFormPage";
import Guests from "./pages/Guests";
import GuestFormPage from "./pages/GuestFormPage";
import Reservations from "./pages/Reservations";
import ReservationFormPage from "./pages/ReservationFormPage";
import ReservationDetailPage from "./pages/ReservationDetailPage";
import Payments from "./pages/Payments";

import RoomTypes from "./pages/RoomTypes";
import ChargesPage from "./pages/ChargesPage";
import PoliceReportPage from "./pages/PoliceReportPage";

// Here I import the admin employees page
import Employees from "./pages/admin/Employees";

import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/layout/Layout";
import { AuthProvider, useAuth } from "./auth/AuthContext";

function Forbidden() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-white border rounded-xl p-6">
        <h1 className="text-xl font-semibold text-slate-900">Access denied</h1>
        <p className="text-sm text-slate-600 mt-2">
          You don’t have permission to access this section.
        </p>
        <button
          className="mt-4 text-sm px-4 py-2 rounded-lg bg-slate-900 text-white"
          onClick={() => (window.location.href = "/")}
        >
          Go to dashboard
        </button>
      </div>
    </div>
  );
}

/**
 * Here I protect admin-only pages on the client side.
 * Backend still enforces role checks, this is just better UX.
 */
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== "admin") return <Navigate to="/forbidden" replace />;
  return <>{children}</>;
}

const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  { path: "/signup", element: <Signup /> },
  { path: "/forbidden", element: <Forbidden /> },

  {
    path: "/",
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Home /> },

      { path: "rooms", element: <Rooms /> },
      { path: "rooms/new", element: <RoomFormPage /> },
      { path: "rooms/:id", element: <RoomFormPage /> },

      // Room types
      { path: "room-types", element: <RoomTypes /> },

      { path: "guests", element: <Guests /> },
      { path: "guests/new", element: <GuestFormPage /> },
      { path: "guests/:id", element: <GuestFormPage /> },

      { path: "reservations", element: <Reservations /> },
      { path: "reservations/new", element: <ReservationFormPage /> },

      //  Reservation detail (this was missing)
      { path: "reservations/:id", element: <ReservationDetailPage /> },

      //  Reservation edit (explicit)
      { path: "reservations/:id/edit", element: <ReservationFormPage /> },

      // Payments both (admin + receptionist)
      { path: "payments", element: <Payments /> },

      //  Charges (consumptions)
      { path: "charges", element: <ChargesPage /> },

      //  Police report CSV
      { path: "police-report", element: <PoliceReportPage /> },

      /**
       * Admin employees section.
       * URL: /admin/employees
       */
      {
        path: "admin/employees",
        element: (
          <AdminRoute>
            <Employees />
          </AdminRoute>
        ),
      },

      { path: "*", element: <Home /> },
    ],
  },
]);

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
      <Toaster richColors position="top-right" />
    </AuthProvider>
  );
}
