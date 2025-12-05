import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AxiosError } from "axios";
import api from "../api/api";
import { Card, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.post("/auth/register", { name, email, password });
      navigate("/login");
    } catch (err) {
      const axiosError = err as AxiosError<{ message?: string }>;
      const message =
        axiosError.response?.data?.message || "Error al crear la cuenta";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Logo / título app */}
        <div className="flex items-center justify-center mb-6 gap-2">
          <div className="h-10 w-10 rounded-2xl bg-blue-500 flex items-center justify-center text-white font-bold">
            HM
          </div>
          <div>
            <p className="text-sm text-slate-200 font-semibold">
              HotelManager
            </p>
            <p className="text-xs text-slate-400">
              Panel de administración
            </p>
          </div>
        </div>

        <Card>
          <CardBody>
            <h1 className="text-xl font-semibold text-slate-900 mb-1">
              Crear cuenta
            </h1>
            <p className="text-sm text-slate-500 mb-4">
              Completa tus datos para registrarte y luego iniciar sesión.
            </p>

            {error && (
              <div className="mb-4 bg-red-50 text-red-700 text-sm px-3 py-2 rounded">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Nombre
                </label>
                <input
                  type="text"
                  placeholder="Juan Pérez"
                  className="mt-1 w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="ejemplo@hotel.com"
                  className="mt-1 w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Contraseña
                </label>
                <input
                  type="password"
                  placeholder="********"
                  className="mt-1 w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creando cuenta..." : "Registrarse"}
              </Button>
            </form>

            <p className="mt-4 text-center text-xs text-slate-500">
              ¿Ya tienes una cuenta?{" "}
              <button
                type="button"
                className="text-blue-600 hover:underline"
                onClick={() => navigate("/login")}
              >
                Iniciar sesión
              </button>
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
