import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../api/api";
import { Card, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { toast } from "sonner";
import { useAuth, type AuthUser } from "../auth/AuthContext";
import axios from "axios";

/**
 * Here I describe the possible login responses:
 * - Ideal: token + user
 * - Optional: hotel info (backend may send it)
 */
type LoginResponse = {
  success: boolean;
  token: string;
  user: AuthUser;
  hotel?: { id: number; code: string; name: string };
  message?: string;
};

export default function Login() {
  // Here I store form state and I remember the last used hotelCode
  const [hotelCode, setHotelCode] = useState(
    () => localStorage.getItem("hotelCode") || ""
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Here I keep an inline error message only for this form
  const [error, setError] = useState("");

  // Here I track loading state to disable inputs and prevent double submits
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // Here I use AuthContext to persist token/user after successful login
  const { login } = useAuth();

  /**
   * Here I compute where to redirect after login.
   * If ProtectedRoute sent the user here, it usually includes "from".
   */
  const from =
    (location.state as any)?.from?.pathname ||
    (location.state as any)?.from ||
    "/";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Here I clear old errors before validating
    setError("");

    if (!hotelCode.trim() || !email.trim() || !password.trim()) {
      setError("Hotel code, email and password are required.");
      return;
    }

    setLoading(true);

    try {
      const res = await api.post<LoginResponse>("/auth/login", {
        hotelCode: hotelCode.trim(),
        email: email.trim(),
        password,
      });

      const token = res.data?.token;
      const user = res.data?.user;

      if (!token || !user) {
        setError("Login response is missing token/user.");
        return;
      }

      // Here I persist auth state
      login(token, user);

      // Here I remember the last used hotelCode to speed up next login
      localStorage.setItem("hotelCode", hotelCode.trim());

      toast.success("Logged in successfully");
      navigate(from, { replace: true });
    } catch (err: unknown) {
      /**
       * Here I prefer backend errors (error/message) and fallback to axios message.
       */
      const message = axios.isAxiosError(err)
        ? (err.response?.data as any)?.error ||
          (err.response?.data as any)?.message ||
          err.message
        : "Login failed";

      setError(String(message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md p-4">
      <Card>
        <CardBody>
          <h1 className="mb-4 text-xl font-semibold">Login</h1>

          {error ? (
            <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Hotel code</label>
              <input
                value={hotelCode}
                onChange={(e) => setHotelCode(e.target.value)}
                className="w-full rounded-md border px-3 py-2"
                placeholder="e.g. demo-hotel"
                disabled={loading}
              />
              <p className="mt-1 text-xs text-slate-500">
                I use this code to select the hotel tenant you belong to.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border px-3 py-2"
                placeholder="you@hotel.com"
                disabled={loading}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border px-3 py-2"
                disabled={loading}
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Logging in..." : "Login"}
            </Button>
          </form>

          {/* Here I add a clear CTA to create a new hotel */}
          <p className="mt-4 text-center text-sm text-slate-600">
            I don’t have a hotel yet?{" "}
            <Link to="/signup" className="font-medium text-blue-600 hover:underline">
              Create one
            </Link>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
