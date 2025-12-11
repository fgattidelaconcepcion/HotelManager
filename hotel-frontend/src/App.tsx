import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Rooms from "./pages/Rooms";
import RoomFormPage from "./pages/RoomFormPage";
import Guests from "./pages/Guests";
import Reservations from "./pages/Reservations";
import ReservationFormPage from "./pages/ReservationFormPage";
import Payments from "./pages/Payments";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/layout/Layout";
import GuestFormPage from "./pages/GuestFormPage";

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
       path: "rooms/new",
       element: <RoomFormPage />,
      },
      {
       path: "rooms/:id",
       element: <RoomFormPage />,
      },
      {
        path: "guests",
        element: <Guests />,
      },
      {
        path: "guests/new",
        element: <GuestFormPage />,
      },
      {
        path: "guests/:id",
        element: <GuestFormPage />,
      }, 
      {
        path: "reservations",
        element: <Reservations />,
      },
      {
        path: "reservations/new",
        element: <ReservationFormPage />,
      },
      {
        path: "reservations/:id",
        element: <ReservationFormPage />,
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
