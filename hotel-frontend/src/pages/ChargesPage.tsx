import { useEffect, useMemo, useState } from "react";
import api from "../api/api";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import RoleGate from "../auth/RoleGate";

type ChargeCategory = "minibar" | "service" | "laundry" | "other";

type Charge = {
  id: number;
  hotelId: number;
  bookingId: number;
  roomId: number;
  createdById?: number | null;
  category: ChargeCategory;
  description: string;
  qty: number;
  unitPrice: number;
  total: number;
  createdAt: string;
  updatedAt: string;

  room?: { id: number; number: string; floor: number } | null;
  booking?: { id: number; status: string; checkIn?: string; checkOut?: string } | null;
  createdBy?: { id: number; name: string; email: string; role: string } | null;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-UY", {
    style: "currency",
    currency: "UYU",
    minimumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function ChargesPage() {
  const [charges, setCharges] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [bookingId, setBookingId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [from, setFrom] = useState(""); // YYYY-MM-DD
  const [to, setTo] = useState(""); // YYYY-MM-DD

  // Create form
  const [newBookingId, setNewBookingId] = useState("");
  const [category, setCategory] = useState<ChargeCategory>("other");
  const [description, setDescription] = useState("");
  const [qty, setQty] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [creating, setCreating] = useState(false);

  const loadCharges = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {};
      if (bookingId.trim()) params.bookingId = Number(bookingId);
      if (roomId.trim()) params.roomId = Number(roomId);
      if (from.trim()) params.from = from.trim();
      if (to.trim()) params.to = to.trim();

      const res = await api.get("/charges", {
        params,
        silentErrorToast: true,
      } as any);

      const data = res.data?.data ?? res.data;
      setCharges(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Error loading charges", err);
      setError(err?.response?.data?.error || "Error loading charges.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCharges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalShown = useMemo(
    () => charges.reduce((sum, c) => sum + (c.total ?? 0), 0),
    [charges]
  );

  const handleCreate = async () => {
    if (!newBookingId.trim()) {
      setError("BookingId is required to create a charge.");
      return;
    }
    if (!description.trim()) {
      setError("Description is required.");
      return;
    }
    if (!unitPrice.trim() || Number.isNaN(Number(unitPrice))) {
      setError("Unit price is required.");
      return;
    }

    try {
      setCreating(true);
      setError(null);

      await api.post(
        "/charges",
        {
          bookingId: Number(newBookingId),
          category,
          description: description.trim(),
          qty: qty.trim() ? Number(qty) : 1,
          unitPrice: Number(unitPrice),
        },
        { silentErrorToast: true } as any
      );

      setDescription("");
      setQty("1");
      setUnitPrice("");

      await loadCharges();
    } catch (err: any) {
      console.error("Error creating charge", err);
      setError(err?.response?.data?.error || "Error creating charge.");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    const ok = window.confirm(`Delete charge #${id}?`);
    if (!ok) return;

    try {
      await api.delete(`/charges/${id}`, { silentErrorToast: true } as any);
      await loadCharges();
    } catch (err: any) {
      console.error("Error deleting charge", err);
      setError(err?.response?.data?.error || "Error deleting charge.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Charges (Consumptions)"
        description="Register minibar / laundry / services and extra charges."
        actions={
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={loadCharges}>
              Refresh
            </Button>
          </div>
        }
      />

      {error && (
        <Card>
          <CardBody>
            <div className="bg-red-50 text-red-800 px-4 py-2 rounded text-sm">
              {error}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Create */}
      <RoleGate allowed={["admin", "receptionist"]}>
        <Card>
          <CardBody>
            <h3 className="font-semibold text-gray-800 mb-3">Add a new charge</h3>

            <div className="grid gap-3 md:grid-cols-6">
              <div className="md:col-span-1">
                <label className="block text-xs text-slate-600 mb-1">Booking ID *</label>
                <input
                  value={newBookingId}
                  onChange={(e) => setNewBookingId(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="e.g. 12"
                />
              </div>

              <div className="md:col-span-1">
                <label className="block text-xs text-slate-600 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ChargeCategory)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="minibar">Minibar</option>
                  <option value="service">Service</option>
                  <option value="laundry">Laundry</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs text-slate-600 mb-1">Description *</label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="e.g. 2 waters + chips"
                />
              </div>

              <div className="md:col-span-1">
                <label className="block text-xs text-slate-600 mb-1">Qty</label>
                <input
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="1"
                />
              </div>

              <div className="md:col-span-1">
                <label className="block text-xs text-slate-600 mb-1">Unit price *</label>
                <input
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="e.g. 250"
                />
              </div>
            </div>

            <div className="mt-3">
              <Button type="button" onClick={handleCreate} disabled={creating}>
                {creating ? "Saving..." : "Add charge"}
              </Button>
            </div>
          </CardBody>
        </Card>
      </RoleGate>

      {/* Filters + totals */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Filter bookingId</label>
              <input
                value={bookingId}
                onChange={(e) => setBookingId(e.target.value)}
                className="rounded-md border px-3 py-2 text-sm w-44"
                placeholder="e.g. 12"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1">Filter roomId</label>
              <input
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="rounded-md border px-3 py-2 text-sm w-44"
                placeholder="e.g. 3"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1">From</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded-md border px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1">To</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="rounded-md border px-3 py-2 text-sm"
              />
            </div>

            <Button type="button" variant="secondary" onClick={loadCharges}>
              Apply filters
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setBookingId("");
                setRoomId("");
                setFrom("");
                setTo("");
              }}
            >
              Clear
            </Button>

            <div className="ml-auto text-sm text-slate-700">
              Total (shown): <span className="font-semibold">{formatCurrency(totalShown)}</span>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* List */}
      <Card>
        <CardBody>
          <h3 className="font-semibold text-gray-800 mb-3">Charges</h3>

          {loading && <p className="text-sm text-gray-500">Loading...</p>}

          {!loading && charges.length === 0 && (
            <p className="text-sm text-gray-500">No charges found.</p>
          )}

          {charges.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">ID</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Booking</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Room</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Category</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Description</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-700">Qty</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-700">Unit</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-700">Total</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Created</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {charges.map((c) => (
                    <tr key={c.id} className="border-t last:border-b">
                      <td className="px-4 py-2 align-top">{c.id}</td>
                      <td className="px-4 py-2 align-top">#{c.bookingId}</td>
                      <td className="px-4 py-2 align-top">
                        {c.room?.number
                          ? `Room ${c.room.number} (floor ${c.room.floor})`
                          : `#${c.roomId}`}
                      </td>
                      <td className="px-4 py-2 align-top">
                        <Badge variant="default">{c.category}</Badge>
                      </td>
                      <td className="px-4 py-2 align-top">{c.description}</td>
                      <td className="px-4 py-2 align-top text-right">{c.qty}</td>
                      <td className="px-4 py-2 align-top text-right">{formatCurrency(c.unitPrice)}</td>
                      <td className="px-4 py-2 align-top text-right">{formatCurrency(c.total)}</td>
                      <td className="px-4 py-2 align-top">{formatDateTime(c.createdAt)}</td>
                      <td className="px-4 py-2 align-top text-right">
                        <RoleGate allowed={["admin"]}>
                          <Button
                            type="button"
                            variant="danger"
                            className="text-xs px-3 py-1"
                            onClick={() => handleDelete(c.id)}
                          >
                            Delete
                          </Button>
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
