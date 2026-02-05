import React from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
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
import Payments from "./pages/Payments";

import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/layout/Layout";
import { AuthProvider } from "./auth/AuthContext";

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

      { path: "guests", element: <Guests /> },
      { path: "guests/new", element: <GuestFormPage /> },
      { path: "guests/:id", element: <GuestFormPage /> },

      { path: "reservations", element: <Reservations /> },
      { path: "reservations/new", element: <ReservationFormPage /> },
      { path: "reservations/:id", element: <ReservationFormPage /> },

      //  Payments both (admin + receptionist)
      { path: "payments", element: <Payments /> },
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
