import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import { Card, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { toast } from "sonner";
import axios from "axios";
import type { AuthUser } from "../auth/AuthContext";
import { useAuth } from "../auth/AuthContext";

/**
 * Here I define the backend response for "register hotel".
 */
type RegisterHotelResponse = {
  success: boolean;
  token: string;
  user: AuthUser;
  hotel: { id: number; code: string; name: string };
  message?: string;
};

export default function Signup() {
  // Here I store hotel fields
  const [hotelName, setHotelName] = useState("");
  const [hotelCode, setHotelCode] = useState("");

  // Here I store admin fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (
      !hotelName.trim() ||
      !hotelCode.trim() ||
      !name.trim() ||
      !email.trim() ||
      !password.trim()
    ) {
      setError("All fields are required.");
      return;
    }

    setLoading(true);

    try {
      const res = await api.post<RegisterHotelResponse>(
        "/auth/register-hotel",
        {
          hotelName,
          hotelCode,
          name,
          email,
          password,
        },
        { silentErrorToast: true } as any
      );

      const token = res.data?.token;
      const user = res.data?.user;

      if (!token || !user) {
        setError("Register response is missing token/user.");
        return;
      }

      // Here I auto-login after creating the hotel (better UX)
      login(token, user);

      // Here I remember hotelCode for the next login
      localStorage.setItem("hotelCode", hotelCode);

      toast.success("Hotel created successfully");
      navigate("/", { replace: true });
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data as any)?.error ||
          (err.response?.data as any)?.message ||
          err.message
        : "Signup failed";

      setError(String(message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md p-4">
      <Card>
        <CardBody>
          <h1 className="mb-4 text-xl font-semibold">Create your hotel</h1>

          {error ? (
            <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Hotel name</label>
              <input
                value={hotelName}
                onChange={(e) => setHotelName(e.target.value)}
                className="w-full rounded-md border px-3 py-2"
                placeholder="My Hotel"
                disabled={loading}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Hotel code</label>
              <input
                value={hotelCode}
                onChange={(e) => setHotelCode(e.target.value)}
                className="w-full rounded-md border px-3 py-2"
                placeholder="my-hotel"
                disabled={loading}
              />
              <p className="mt-1 text-xs text-gray-500">
                I use this code to identify your hotel tenant at login (letters, numbers, hyphen).
              </p>
            </div>

            <hr className="my-2" />

            <div>
              <label className="mb-1 block text-sm font-medium">Admin name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border px-3 py-2"
                disabled={loading}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Admin email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border px-3 py-2"
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
              {loading ? "Creating..." : "Create hotel"}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
