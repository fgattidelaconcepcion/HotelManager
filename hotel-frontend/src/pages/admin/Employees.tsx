import { useEffect, useMemo, useState } from "react";
import api from "../../api/api";
import { useAuth } from "../../auth/AuthContext";
import { Card, CardBody } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";

/**
 * Here I define the shape of an employee coming from the backend.
 */
type Employee = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "receptionist";
  hotelId: number;
  createdAt: string;
};

export default function Employees() {
  const { user } = useAuth();

  // Here I store list state
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Here I store form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "receptionist">("receptionist");

  const canManage = useMemo(() => user?.role === "admin", [user?.role]);

  async function fetchEmployees() {
    setLoading(true);
    setError("");

    try {
      const res = await api.get<{ success: boolean; data: Employee[] }>("/users");
      setEmployees(res.data.data || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || "Error loading employees");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Here I load employees on first render
    fetchEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage) return;

    setError("");

    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("Name, email and password are required.");
      return;
    }

    try {
      await api.post("/users", { name, email, password, role });

      // Here I reset the form after creation
      setName("");
      setEmail("");
      setPassword("");
      setRole("receptionist");

      // Here I refresh the list
      await fetchEmployees();
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || "Error creating employee");
    }
  }

  async function handleDelete(id: number) {
    if (!canManage) return;

    // Here I avoid accidental deletes
    const ok = confirm("Are you sure you want to delete this employee?");
    if (!ok) return;

    setError("");

    try {
      await api.delete(`/users/${id}`);
      await fetchEmployees();
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || "Error deleting employee");
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-4 space-y-4">
      <Card>
        <CardBody>
          <h1 className="text-xl font-semibold">Employees</h1>
          <p className="text-sm text-gray-600">
            Here I manage employees inside my current hotel tenant.
          </p>
        </CardBody>
      </Card>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <Card>
        <CardBody>
          <h2 className="mb-3 text-lg font-semibold">Create employee</h2>

          {!canManage ? (
            <p className="text-sm text-gray-600">Only admins can manage employees.</p>
          ) : (
            <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Name</label>
                <input
                  className="w-full rounded-md border px-3 py-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Email</label>
                <input
                  className="w-full rounded-md border px-3 py-2"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Password</label>
                <input
                  type="password"
                  className="w-full rounded-md border px-3 py-2"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Role</label>
                <select
                  className="w-full rounded-md border px-3 py-2"
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                >
                  <option value="receptionist">Receptionist</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <Button type="submit" className="w-full">
                  Create employee
                </Button>
              </div>
            </form>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Employees list</h2>
            <Button onClick={fetchEmployees} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>

          <div className="overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left">Name</th>
                  <th className="py-2 text-left">Email</th>
                  <th className="py-2 text-left">Role</th>
                  <th className="py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e.id} className="border-b">
                    <td className="py-2">{e.name}</td>
                    <td className="py-2">{e.email}</td>
                    <td className="py-2">{e.role}</td>
                    <td className="py-2">
                      {canManage ? (
                        <Button
                          onClick={() => handleDelete(e.id)}
                          disabled={user?.id === e.id}
                        >
                          Delete
                        </Button>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                      {user?.id === e.id ? (
                        <span className="ml-2 text-xs text-gray-500">(me)</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {employees.length === 0 ? (
                  <tr>
                    <td className="py-4 text-gray-500" colSpan={4}>
                      No employees found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
