import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import { Card, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { toast } from "sonner";
import axios from "axios";
import type { UserRole } from "../auth/AuthContext";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // ✅ Solo para DEV/DEMO (controlado por env)
  const allowRoleSignup = useMemo(() => {
    return String(import.meta.env.VITE_ALLOW_ROLE_SIGNUP).toLowerCase() === "true";
  }, []);

  const [role, setRole] = useState<UserRole>("receptionist");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("All fields are required.");
      return;
    }

    setLoading(true);

    try {
      const payload: any = { name, email, password };

      // ✅ Solo enviamos role si está habilitado
      if (allowRoleSignup) payload.role = role;

      await api.post("/auth/register", payload, { silentErrorToast: true } as any);

      toast.success("Account created successfully");
      navigate("/login");
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? ((err.response?.data as any)?.error as string) ||
          ((err.response?.data as any)?.message as string) ||
          err.message
        : err instanceof Error
        ? err.message
        : "Could not create account. Please try again.";

      setError(message);
      toast.error(message);
    } finally {
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
              Create account
            </h1>
            <p className="text-sm text-slate-500 mb-4">
              Fill in your details to register and then sign in.
            </p>

            {error && (
              <div className="mb-4 bg-red-50 text-red-700 text-sm px-3 py-2 rounded">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Name
                </label>
                <input
                  type="text"
                  placeholder="John Doe"
                  className="mt-1 w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

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
                  autoComplete="new-password"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Minimum 6 characters.
                </p>
              </div>

              {/* ✅ Role selector (solo dev/demo) */}
              {allowRoleSignup && (
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Role (dev/demo)
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="mt-1 w-full border rounded px-3 py-2 text-sm"
                    disabled={loading}
                  >
                    <option value="receptionist">Receptionist</option>
                    <option value="admin">Admin</option>
                  </select>
                  <p className="text-xs text-slate-400 mt-1">
                    Only enabled when VITE_ALLOW_ROLE_SIGNUP=true.
                  </p>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating account..." : "Sign up"}
              </Button>
            </form>

            <p className="mt-4 text-center text-xs text-slate-500">
              Already have an account?{" "}
              <button
                type="button"
                className="text-blue-600 hover:underline"
                onClick={() => navigate("/login")}
                disabled={loading}
              >
                Sign in
              </button>
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
