import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Rooms from "./pages/Rooms";
import Guests from "./pages/Guests";
import Reservations from "./pages/Reservations";
import Payments from "./pages/Payments";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/layout/Layout";

const router = createBrowserRouter([
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/signup",
    element: <Signup />,
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: "rooms",
        element: <Rooms />,
      },
      {
        path: "guests",
        element: <Guests />,
      },
      {
        path: "reservations",
        element: <Reservations />,
      },
      {
        path: "payments",
        element: <Payments />,
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
