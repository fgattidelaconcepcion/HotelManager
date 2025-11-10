import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Rooms from "./pages/Rooms";
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
        index: true, // equivale a path="/"
        element: <Home />,
      },
      {
        path: "rooms",
        element: <Rooms />,
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
