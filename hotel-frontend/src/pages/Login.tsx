import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/api";
import { Card, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { toast } from "sonner";
import { useAuth, type AuthUser } from "../auth/AuthContext";
import axios from "axios";

/**
 * Here I describe the possible login responses:
 * - Ideal: token + user
 * - Fallback: token only (then I fetch /auth/me)
 */
type LoginResponse =
  | {
      token: string;
      user: AuthUser;
      message?: string;
    }
  | {
      token: string;
      message?: string;
    };

export default function Login() {
  // Here I store form state
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

  /**
   * Here I handle the login submit:
   * - validate fields
   * - call /auth/login
   * - ensure I have token + user (fallback to /auth/me if needed)
   * - persist auth state and redirect
   */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Here I clear old errors before validating
    setError("");

    // Here I do a basic client-side validation
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }

    setLoading(true);

    try {
      // Here I request login (Axios interceptors will attach loader/toasts globally)
      const res = await api.post<LoginResponse>("/auth/login", {
        email,
        password,
      });

      // Here I enforce that login must return a token
      const token = (res.data as any)?.token;
      if (!token) {
        setError("Login response did not include a token.");
        return;
      }

      /**
       * Here I prefer using the user object returned by /auth/login.
       * If it’s missing, I fetch /auth/me as a reliable fallback.
       */
      const userFromLogin = (res.data as any)?.user as AuthUser | undefined;

      let user: AuthUser;
      if (userFromLogin?.id && userFromLogin?.email && userFromLogin?.role) {
        user = userFromLogin;
      } else {
        // Here I disable the global toast because I want to handle inline feedback myself
        const me = await api.get("/auth/me", { silentErrorToast: true } as any);
        const payload = (me.data?.data ?? me.data) as AuthUser;
        user = payload;
      }

      // Here I store token + user in AuthContext (and persist them via localStorage)
      login({ token, user });

      // Here I show a friendly success toast and redirect
      toast.success(`Welcome, ${user.name || user.email}!`);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      /**
       * Note: My Axios interceptor already shows a global toast error,
       * but here I also set an inline error to keep the form user-friendly.
       */
      const message = axios.isAxiosError(err)
        ? ((err.response?.data as any)?.error as string) ||
          ((err.response?.data as any)?.message as string) ||
          err.message
        : err instanceof Error
        ? err.message
        : "Could not sign in. Please try again.";

      setError(message);
    } finally {
      // Here I always stop loading even if the request fails
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="flex items-center justify-center mb-6 gap-2">
          <div className="h-10 w-10 rounded-2xl bg-blue-500 flex items-center justify-center text-white font-bold">
            HM
          </div>
          <div>
            <p className="text-sm text-slate-200 font-semibold">HotelManager</p>
            <p className="text-xs text-slate-400">Admin panel</p>
          </div>
        </div>

        <Card>
          <CardBody>
            <h1 className="text-xl font-semibold text-slate-900 mb-1">
              Sign in
            </h1>
            <p className="text-sm text-slate-500 mb-4">
              Enter your credentials to access the dashboard.
            </p>

            {/* Here I show an inline error message for the form */}
            {error && (
              <div className="mb-4 bg-red-50 text-red-700 text-sm px-3 py-2 rounded">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="example@hotel.com"
                  className="mt-1 w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Password
                </label>
                <input
                  type="password"
                  placeholder="********"
                  className="mt-1 w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="current-password"
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </form>

            <p className="mt-4 text-center text-xs text-slate-500">
              Don&apos;t have an account?{" "}
              {/* Here I navigate to signup without reloading the page */}
              <button
                type="button"
                className="text-blue-600 hover:underline"
                onClick={() => navigate("/signup")}
                disabled={loading}
              >
                Sign up
              </button>
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
