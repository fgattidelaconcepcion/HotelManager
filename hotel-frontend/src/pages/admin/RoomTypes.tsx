import { useEffect, useMemo, useState } from "react";
import api from "../../api/api";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card, CardBody } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { toast } from "sonner";

/**
 * Here I model the RoomType coming from my backend.
 * IMPORTANT: It is scoped by hotelId server-side (multi-tenant safe).
 */
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

const emptyForm: FormState = { name: "", basePrice: "", capacity: "" };

export default function RoomTypes() {
  const [items, setItems] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(false);

  // Here I keep a simple "create" form at the top
  const [form, setForm] = useState<FormState>(emptyForm);

  // Here I support inline editing
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);

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
      setLoading(true);
      const res = await api.get("/room-types");
      const data = res.data?.data ?? res.data;
      setItems(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Could not load room types");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const validate = (state: FormState) => {
    if (!state.name.trim()) {
      toast.error("Name is required");
      return false;
    }

    const bp = Number(state.basePrice);
    if (Number.isNaN(bp) || bp < 0) {
      toast.error("Base price must be a valid number (0 or more)");
      return false;
    }

    const cap = Number(state.capacity);
    if (Number.isNaN(cap) || !Number.isInteger(cap) || cap <= 0) {
      toast.error("Capacity must be a positive integer");
      return false;
    }

    return true;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate(form)) return;

    try {
      setLoading(true);

      const payload = {
        name: form.name.trim(),
        basePrice: Number(form.basePrice),
        capacity: Number(form.capacity),
      };

      const res = await api.post("/room-types", payload);
      const created = res.data?.data;

      toast.success("Room type created");
      setForm(emptyForm);

      // Here I update UI immediately
      if (created?.id) {
        setItems((prev) => [...prev, created].sort((a, b) => a.id - b.id));
      } else {
        await load();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Could not create room type");
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (rt: RoomType) => {
    setEditingId(rt.id);
    setEditForm({
      name: rt.name ?? "",
      basePrice: String(rt.basePrice ?? 0),
      capacity: String(rt.capacity ?? 1),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(emptyForm);
  };

  const handleUpdate = async (id: number) => {
    if (!validate(editForm)) return;

    try {
      setLoading(true);

      const payload = {
        name: editForm.name.trim(),
        basePrice: Number(editForm.basePrice),
        capacity: Number(editForm.capacity),
      };

      const res = await api.put(`/room-types/${id}`, payload);
      const updated = res.data?.data;

      toast.success("Room type updated");
      setItems((prev) =>
        prev
          .map((x) => (x.id === id ? { ...x, ...updated } : x))
          .sort((a, b) => a.id - b.id)
      );

      cancelEdit();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Could not update room type");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    const ok = window.confirm(
      "Delete this room type?\n\nTip: You can’t delete a type that is already assigned to rooms."
    );
    if (!ok) return;

    try {
      setLoading(true);
      await api.delete(`/room-types/${id}`);
      toast.success("Room type deleted");
      setItems((prev) => prev.filter((x) => x.id !== id));
      if (editingId === id) cancelEdit();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Could not delete room type");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Room Types"
        description="Create room types for your hotel (only admin). These do not affect other hotels."
      />

      <Card>
        <CardBody>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="mt-1 w-full border rounded px-3 py-2 text-sm"
                  placeholder="Standard"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Base price *</label>
                <input
                  type="number"
                  value={form.basePrice}
                  onChange={(e) => setForm((p) => ({ ...p, basePrice: e.target.value }))}
                  className="mt-1 w-full border rounded px-3 py-2 text-sm"
                  placeholder="1000"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Capacity *</label>
                <input
                  type="number"
                  value={form.capacity}
                  onChange={(e) => setForm((p) => ({ ...p, capacity: e.target.value }))}
                  className="mt-1 w-full border rounded px-3 py-2 text-sm"
                  placeholder="2"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Create room type"}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          {loading && items.length === 0 ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-slate-600">
              No room types yet. Create your first one above (e.g. “Standard”, “Deluxe”).
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-slate-600">
                  <tr className="border-b">
                    <th className="py-2">Name</th>
                    <th className="py-2">Base price</th>
                    <th className="py-2">Capacity</th>
                    <th className="py-2 w-[220px]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((rt) => {
                    const isEditing = editingId === rt.id;

                    return (
                      <tr key={rt.id} className="border-b">
                        <td className="py-2">
                          {isEditing ? (
                            <input
                              value={editForm.name}
                              onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                              className="w-full border rounded px-2 py-1"
                              disabled={loading}
                            />
                          ) : (
                            rt.name
                          )}
                        </td>

                        <td className="py-2">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editForm.basePrice}
                              onChange={(e) =>
                                setEditForm((p) => ({ ...p, basePrice: e.target.value }))
                              }
                              className="w-full border rounded px-2 py-1"
                              disabled={loading}
                            />
                          ) : (
                            currency.format(rt.basePrice ?? 0)
                          )}
                        </td>

                        <td className="py-2">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editForm.capacity}
                              onChange={(e) =>
                                setEditForm((p) => ({ ...p, capacity: e.target.value }))
                              }
                              className="w-full border rounded px-2 py-1"
                              disabled={loading}
                            />
                          ) : (
                            rt.capacity
                          )}
                        </td>

                        <td className="py-2">
                          {isEditing ? (
                            <div className="flex gap-2 justify-end">
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={cancelEdit}
                                disabled={loading}
                              >
                                Cancel
                              </Button>
                              <Button
                                type="button"
                                onClick={() => handleUpdate(rt.id)}
                                disabled={loading}
                              >
                                Save
                              </Button>
                            </div>
                          ) : (
                            <div className="flex gap-2 justify-end">
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => startEdit(rt)}
                                disabled={loading}
                              >
                                Edit
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => handleDelete(rt.id)}
                                disabled={loading}
                              >
                                Delete
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
