import { useEffect, useMemo, useState } from "react";
import api from "../api/api";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { toast } from "sonner";
import RoleGate from "../auth/RoleGate";
import { useAuth } from "../auth/AuthContext";

/**
 * Represents a room type entity returned by the backend
 */
type RoomType = {
  id: number;
  hotelId: number;
  name: string;
  basePrice: number;
  capacity: number;
};

/**
 * Form state for create / edit
 */
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

  // List state
  const [items, setItems] = useState<RoomType[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  // Form state
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Edit mode tracker
  const [editingId, setEditingId] = useState<number | null>(null);

  /**
   * Currency formatter (UYU)
   */
  const currency = useMemo(
    () =>
      new Intl.NumberFormat("en-UY", {
        style: "currency",
        currency: "UYU",
        minimumFractionDigits: 0,
      }),
    []
  );

  /**
   * Loads room types for the current hotel.
   * Backend scopes by token.hotelId.
   */
  const load = async () => {
    try {
      setLoadingList(true);

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

  /**
   * Resets form and exits edit mode
   */
  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  /**
   * Updates a specific form field
   */
  const setField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  /**
   * Validates form input
   */
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
    if (
      Number.isNaN(capacity) ||
      !Number.isInteger(capacity) ||
      capacity <= 0
    ) {
      toast.error("Capacity must be a valid integer (> 0)");
      return false;
    }

    return true;
  };

  /**
   * Handles create or update action
   */
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
        await api.put(`/room-types/${editingId}`, payload);
        toast.success("Room type updated");
      } else {
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

  /**
   * Enables edit mode
   */
  const startEdit = (rt: RoomType) => {
    if (!isAdmin) return;

    setEditingId(rt.id);
    setForm({
      name: rt.name ?? "",
      basePrice: String(rt.basePrice ?? 0),
      capacity: String(rt.capacity ?? 1),
    });
  };

  /**
   * Deletes a room type
   */
  const handleDelete = async (id: number) => {
    if (!isAdmin) {
      toast.error("Only admin can manage room types.");
      return;
    }

    const ok = window.confirm(
      "Delete this room type? (This cannot be undone)"
    );
    if (!ok) return;

    try {
      await api.delete(`/room-types/${id}`);
      toast.success("Room type deleted");
      await load();
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ?? "Could not delete room type";
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6 px-4 sm:px-0">
      <PageHeader
        title="Room Types"
        description="Manage the room categories for your hotel."
      />

      {/* CREATE / EDIT FORM */}
      <RoleGate
        allowed={["admin"]}
        fallback={
          <div className="rounded-xl border bg-white p-4 text-sm text-slate-600">
            Only admins can manage room types.
          </div>
        }
      >
        <Card>
          <CardBody>
            <h2 className="text-sm font-semibold text-slate-900">
              {editingId ? "Edit room type" : "Create room type"}
            </h2>

            <form
              onSubmit={handleCreateOrUpdate}
              className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-slate-600">
                  Name
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  disabled={saving}
                />
              </div>

              {/* Base Price */}
              <div>
                <label className="block text-xs font-medium text-slate-600">
                  Base price
                </label>
                <input
                  value={form.basePrice}
                  onChange={(e) => setField("basePrice", e.target.value)}
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  inputMode="numeric"
                  disabled={saving}
                />
              </div>

              {/* Capacity */}
              <div>
                <label className="block text-xs font-medium text-slate-600">
                  Capacity
                </label>
                <input
                  value={form.capacity}
                  onChange={(e) => setField("capacity", e.target.value)}
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  inputMode="numeric"
                  disabled={saving}
                />
              </div>

              <div className="col-span-1 sm:col-span-2 lg:col-span-3 flex flex-col sm:flex-row gap-2 sm:justify-end">
                {editingId && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={resetForm}
                    disabled={saving}
                  >
                    Cancel edit
                  </Button>
                )}

                <Button type="submit" disabled={saving}>
                  {saving
                    ? "Saving..."
                    : editingId
                    ? "Save changes"
                    : "Create"}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </RoleGate>

      {/* LIST TABLE */}
      <Card>
        <CardBody>
          <h2 className="text-sm font-semibold text-slate-900">
            Your room types
          </h2>

          {loadingList ? (
            <p className="mt-4 text-sm text-slate-500">Loading...</p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-lg border">
  <table className="w-full min-w-[700px] md:min-w-0 text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left whitespace-nowrap">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">
                      Base price
                    </th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">
                      Capacity
                    </th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((rt) => (
                    <tr key={rt.id} className="border-t">
                      <td className="px-4 py-3 whitespace-nowrap font-medium">
                        {rt.name}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {currency.format(rt.basePrice)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {rt.capacity}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <RoleGate allowed={["admin"]}>
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEdit(rt)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleDelete(rt.id)}
                            >
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
