import { useEffect, useMemo, useState } from "react";
import api from "../api/api";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { toast } from "sonner";
import RoleGate from "../auth/RoleGate";
import { useAuth } from "../auth/AuthContext";

type RoomType = {
  id: number;
  hotelId: number;
  name: string;
  basePrice: number;
  capacity: number;
};

type FormState = {
  name: string;
  basePrice: string;
  capacity: string;
};

const emptyForm: FormState = {
  name: "",
  basePrice: "",
  capacity: "",
};

export default function RoomTypes() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [items, setItems] = useState<RoomType[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  // Here I reuse the same form for create / edit
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Here I track edit mode
  const [editingId, setEditingId] = useState<number | null>(null);

  const currency = useMemo(
    () =>
      new Intl.NumberFormat("en-UY", {
        style: "currency",
        currency: "UYU",
        minimumFractionDigits: 0,
      }),
    []
  );

  const load = async () => {
    try {
      setLoadingList(true);

      // Here I load only the room types of MY hotel (backend scopes by token.hotelId)
      const res = await api.get("/room-types");
      const data = res.data?.data ?? [];

      setItems(Array.isArray(data) ? data : []);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Could not load room types";
      toast.error(msg);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const setField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validate = () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return false;
    }

    const basePrice = Number(form.basePrice);
    if (Number.isNaN(basePrice) || basePrice < 0) {
      toast.error("Base price must be a valid number (>= 0)");
      return false;
    }

    const capacity = Number(form.capacity);
    if (Number.isNaN(capacity) || !Number.isInteger(capacity) || capacity <= 0) {
      toast.error("Capacity must be a valid integer (> 0)");
      return false;
    }

    return true;
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAdmin) {
      toast.error("Only admin can manage room types.");
      return;
    }

    if (!validate()) return;

    const payload = {
      name: form.name.trim(),
      basePrice: Number(form.basePrice),
      capacity: Number(form.capacity),
    };

    try {
      setSaving(true);

      if (editingId) {
        // Here I update an existing room type (admin only)
        await api.put(`/room-types/${editingId}`, payload);
        toast.success("Room type updated");
      } else {
        // Here I create a new room type (admin only)
        await api.post("/room-types", payload);
        toast.success("Room type created");
      }

      resetForm();
      await load();
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Could not save room type";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (rt: RoomType) => {
    if (!isAdmin) return;

    setEditingId(rt.id);
    setForm({
      name: rt.name ?? "",
      basePrice: String(rt.basePrice ?? 0),
      capacity: String(rt.capacity ?? 1),
    });
  };

  const handleDelete = async (id: number) => {
    if (!isAdmin) {
      toast.error("Only admin can manage room types.");
      return;
    }

    const ok = window.confirm("Delete this room type? (This cannot be undone)");
    if (!ok) return;

    try {
      await api.delete(`/room-types/${id}`);
      toast.success("Room type deleted");
      await load();
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Could not delete room type";
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Room Types"
        description="Manage the room categories for your hotel. Each hotel has its own room types."
      />

      <RoleGate
        allowed={["admin"]}
        fallback={
          <div className="rounded-xl border bg-white p-4 text-sm text-slate-600">
            Only admins can create/edit/delete room types. You can still view the list below.
          </div>
        }
      >
        <Card>
          <CardBody>
            <h2 className="text-sm font-semibold text-slate-900">
              {editingId ? "Edit room type" : "Create room type"}
            </h2>

            <form onSubmit={handleCreateOrUpdate} className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="md:col-span-1">
                <label className="block text-xs font-medium text-slate-600">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  placeholder="Standard"
                  disabled={saving}
                />
              </div>

              <div className="md:col-span-1">
                <label className="block text-xs font-medium text-slate-600">Base price</label>
                <input
                  value={form.basePrice}
                  onChange={(e) => setField("basePrice", e.target.value)}
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  placeholder="1000"
                  inputMode="numeric"
                  disabled={saving}
                />
              </div>

              <div className="md:col-span-1">
                <label className="block text-xs font-medium text-slate-600">Capacity</label>
                <input
                  value={form.capacity}
                  onChange={(e) => setField("capacity", e.target.value)}
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  placeholder="2"
                  inputMode="numeric"
                  disabled={saving}
                />
              </div>

              <div className="md:col-span-3 flex justify-end gap-2">
                {editingId ? (
                  <Button type="button" variant="ghost" onClick={resetForm} disabled={saving}>
                    Cancel edit
                  </Button>
                ) : null}

                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : editingId ? "Save changes" : "Create"}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </RoleGate>

      <Card>
        <CardBody>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Your room types</h2>
            <Button type="button" variant="ghost" onClick={load} disabled={loadingList}>
              Refresh
            </Button>
          </div>

          {loadingList ? (
            <p className="mt-3 text-sm text-slate-500">Loading...</p>
          ) : items.length === 0 ? (
            <div className="mt-3 rounded-lg border bg-slate-50 p-4 text-sm text-slate-600">
              No room types found for this hotel.
              {isAdmin ? " Create your first one above." : ""}
            </div>
          ) : (
            <div className="mt-3 overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Name</th>
                    <th className="px-3 py-2 text-left font-medium">Base price</th>
                    <th className="px-3 py-2 text-left font-medium">Capacity</th>
                    <th className="px-3 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((rt) => (
                    <tr key={rt.id} className="border-t">
                      <td className="px-3 py-2">{rt.name}</td>
                      <td className="px-3 py-2">
                        {rt.basePrice != null ? currency.format(rt.basePrice) : "-"}
                      </td>
                      <td className="px-3 py-2">{rt.capacity}</td>
                      <td className="px-3 py-2 text-right">
                        <RoleGate allowed={["admin"]} fallback={null}>
                          <div className="inline-flex gap-2">
                            <Button type="button" variant="ghost" onClick={() => startEdit(rt)}>
                              Edit
                            </Button>
                            <Button type="button" variant="ghost" onClick={() => handleDelete(rt.id)}>
                              Delete
                            </Button>
                          </div>
                        </RoleGate>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
