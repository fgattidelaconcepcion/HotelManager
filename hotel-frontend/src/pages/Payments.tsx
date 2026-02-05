import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import api from "../api/api";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { toast } from "sonner";
import RoleGate from "../auth/RoleGate";

type PaymentMethod = "cash" | "card" | "transfer";
type PaymentStatus = "pending" | "completed" | "failed";

interface PaymentBookingGuest {
  id: number;
  name: string;
  email?: string | null;
}

interface PaymentBookingRoomType {
  id: number;
  name: string;
  basePrice?: number;
}

interface PaymentBookingRoom {
  id: number;
  number: string;
  floor: number;
  roomType?: PaymentBookingRoomType | null;
}

interface PaymentBooking {
  id: number;
  guest?: PaymentBookingGuest | null;
  room?: PaymentBookingRoom | null;
}

export interface Payment {
  id: number;
  bookingId: number;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  createdAt: string;
  updatedAt: string;
  booking?: PaymentBooking | null;
}

/* === Booking types (for selector) === */
interface BookingGuest {
  id: number;
  name: string;
  email?: string | null;
}

interface BookingRoomType {
  id: number;
  name: string;
  basePrice?: number;
}

interface BookingRoom {
  id: number;
  number: string;
  floor: number;
  roomType?: BookingRoomType | null;
}

interface Booking {
  id: number;
  room?: BookingRoom | null;
  guest?: BookingGuest | null;
  checkIn: string;
  checkOut: string;
  totalPrice: number;
  status: string;
}

interface PaymentFormState {
  id?: number | null;
  bookingId: string;
  amount: string;
  method: PaymentMethod;
  status: PaymentStatus;
}

const emptyForm: PaymentFormState = {
  id: null,
  bookingId: "",
  amount: "",
  method: "cash",
  status: "pending",
};

function mapApiError(err: unknown) {
  if (axios.isAxiosError(err)) {
    return (
      (err.response?.data as any)?.error ||
      err.message ||
      "Request failed. Please try again."
    );
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong. Please try again.";
}

export default function Payments() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<PaymentFormState>(emptyForm);

  const [filterBookingId, setFilterBookingId] = useState("");
  const [filterStatus, setFilterStatus] = useState<"" | PaymentStatus>("");

  const [autoOpenedFromBooking, setAutoOpenedFromBooking] = useState(false);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-UY", {
      style: "currency",
      currency: "UYU",
      minimumFractionDigits: 0,
    }).format(value);

  const formatDateTime = (value: string) => {
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  };

  const formatDate = (value: string) => {
    try {
      return new Date(value).toLocaleDateString();
    } catch {
      return value;
    }
  };

  const getStatusLabel = (status: PaymentStatus) => {
    switch (status) {
      case "pending":
        return "Pending";
      case "completed":
        return "Completed";
      case "failed":
        return "Failed";
      default:
        return status;
    }
  };

  const getStatusVariant = (status: PaymentStatus) => {
    if (status === "completed") return "success";
    if (status === "pending") return "warning";
    return "danger";
  };

  const getMethodLabel = (method: PaymentMethod) => {
    switch (method) {
      case "cash":
        return "Cash";
      case "card":
        return "Card";
      case "transfer":
        return "Bank transfer";
      default:
        return method;
    }
  };

  const buildPaymentsParams = (override?: {
    bookingId?: string;
    status?: "" | PaymentStatus;
  }) => {
    const bookingIdValue =
      override?.bookingId !== undefined ? override.bookingId : filterBookingId;

    const statusValue =
      override?.status !== undefined ? override.status : filterStatus;

    const params: Record<string, string> = {};
    if (bookingIdValue?.trim()) params.bookingId = bookingIdValue.trim();
    if (statusValue) params.status = statusValue;

    return params;
  };

  const loadPayments = async (override?: {
    bookingId?: string;
    status?: "" | PaymentStatus;
  }) => {
    try {
      setLoading(true);
      setError(null);

      const params = buildPaymentsParams(override);
      const response = await api.get("/payments", { params });
      const data = response.data?.data ?? response.data;

      setPayments(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(mapApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const loadBookings = async () => {
    try {
      setLoadingBookings(true);
      const res = await api.get("/bookings");
      const data = res.data?.data ?? res.data;
      setBookings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error loading bookings", err);
    } finally {
      setLoadingBookings(false);
    }
  };

  useEffect(() => {
    loadPayments();
    loadBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const bookingIdParam = searchParams.get("bookingId");
    if (!bookingIdParam) return;
    if (autoOpenedFromBooking) return;

    const bookingIdNum = Number(bookingIdParam);
    if (!bookingIdNum || Number.isNaN(bookingIdNum)) return;

    if (loadingBookings) return;

    const exists = bookings.some((b) => b.id === bookingIdNum);
    if (!exists) return;

    setForm((prev) => ({ ...prev, bookingId: String(bookingIdNum) }));
    setIsEditing(false);
    setShowModal(true);
    setAutoOpenedFromBooking(true);
  }, [searchParams, bookings, loadingBookings, autoOpenedFromBooking]);

  const handleOpenCreate = () => {
    setIsEditing(false);
    setError(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const handleOpenEdit = (payment: Payment) => {
    setIsEditing(true);
    setError(null);
    setForm({
      id: payment.id,
      bookingId: String(payment.bookingId),
      amount: String(payment.amount),
      method: payment.method,
      status: payment.status,
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setForm(emptyForm);
    setIsEditing(false);
    setError(null);
  };

  const handleChange = (
    field: keyof PaymentFormState,
    value: string | PaymentMethod | PaymentStatus
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const selectedBookingId = form.bookingId ? Number(form.bookingId) : null;
  const selectedBooking = useMemo(() => {
    if (!selectedBookingId || Number.isNaN(selectedBookingId)) return null;
    return bookings.find((b) => b.id === selectedBookingId) ?? null;
  }, [bookings, selectedBookingId]);

  const completedPaymentsForSelected = useMemo(() => {
    if (!selectedBooking) return [];
    return payments.filter((p) => {
      if (p.bookingId !== selectedBooking.id) return false;
      if (p.status !== "completed") return false;
      if (isEditing && form.id != null && p.id === form.id) return false;
      return true;
    });
  }, [payments, selectedBooking, isEditing, form.id]);

  const totalPaidForSelected = completedPaymentsForSelected.reduce(
    (sum, p) => sum + p.amount,
    0
  );

  const totalPrice = selectedBooking?.totalPrice ?? 0;
  const remainingForSelected = totalPrice - totalPaidForSelected;

  const isBookingFullyPaid = !!selectedBooking && remainingForSelected <= 0;

  const handleFillRemainingAmount = () => {
    if (!selectedBooking) return;
    if (remainingForSelected <= 0) return;

    setForm((prev) => ({
      ...prev,
      amount: String(Math.max(0, Math.floor(remainingForSelected))),
    }));
  };

  const validateForm = () => {
    setError(null);

    if (!form.bookingId.trim()) {
      setError("Reservation is required.");
      return false;
    }

    const bookingIdNum = Number(form.bookingId);
    if (Number.isNaN(bookingIdNum) || bookingIdNum <= 0) {
      setError("Reservation ID must be a valid number.");
      return false;
    }

    const bookingExists = bookings.some((b) => b.id === bookingIdNum);
    if (!bookingExists) {
      setError("The selected reservation does not exist.");
      return false;
    }

    if (!form.amount.trim()) {
      setError("Amount is required.");
      return false;
    }

    const amountNumber = Number(form.amount);
    if (Number.isNaN(amountNumber) || amountNumber <= 0) {
      setError("Amount must be a number greater than 0.");
      return false;
    }

    if (selectedBooking && form.status === "completed") {
      if (amountNumber > remainingForSelected) {
        setError(
          `Amount exceeds the remaining balance (${formatCurrency(
            Math.max(0, remainingForSelected)
          )}).`
        );
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.warning(error ?? "Please review the form.");
      return;
    }

    const payload = {
      bookingId: Number(form.bookingId),
      amount: Number(form.amount),
      method: form.method,
      status: form.status,
    };

    try {
      setLoading(true);
      setError(null);

      if (isEditing && form.id != null) {
        await api.put(`/payments/${form.id}`, payload);
        toast.success("Payment updated");
      } else {
        await api.post("/payments", payload);
        toast.success("Payment created");
      }

      await loadPayments();
      handleCloseModal();
    } catch (err) {
      const message = mapApiError(err);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (payment: Payment) => {
    const ok = window.confirm(
      `Are you sure you want to delete payment #${payment.id} (reservation #${payment.bookingId})?`
    );
    if (!ok) return;

    try {
      setLoading(true);
      setError(null);

      await api.delete(`/payments/${payment.id}`);
      toast.success("Payment deleted");
      await loadPayments();
    } catch (err) {
      const message = mapApiError(err);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    loadPayments();
  };

  const handleClearFilters = () => {
    setFilterBookingId("");
    setFilterStatus("");
    loadPayments({ bookingId: "", status: "" });
  };

  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalByStatus: Record<PaymentStatus, number> = {
    pending: payments.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0),
    completed: payments.filter((p) => p.status === "completed").reduce((s, p) => s + p.amount, 0),
    failed: payments.filter((p) => p.status === "failed").reduce((s, p) => s + p.amount, 0),
  };

  const disableCreateCompletedWhenFullyPaid =
    !isEditing && isBookingFullyPaid && form.status === "completed";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Manage payments linked to reservations."
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => navigate("/reservations/new")}
            >
              New reservation
            </Button>
            <Button type="button" onClick={handleOpenCreate}>
              New payment
            </Button>
          </div>
        }
      />

      <Card>
        <CardBody>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-xs text-gray-500">Total payments</p>
              <p className="text-lg font-semibold mt-1">{formatCurrency(totalAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Completed</p>
              <p className="text-lg font-semibold mt-1">{formatCurrency(totalByStatus.completed)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Pending</p>
              <p className="text-lg font-semibold mt-1">{formatCurrency(totalByStatus.pending)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Failed</p>
              <p className="text-lg font-semibold mt-1">{formatCurrency(totalByStatus.failed)}</p>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <form onSubmit={handleApplyFilters} className="flex flex-wrap gap-4 items-end">
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700">Reservation ID</label>
              <input
                type="text"
                value={filterBookingId}
                onChange={(e) => setFilterBookingId(e.target.value)}
                className="mt-1 border rounded px-3 py-2 text-sm w-40"
                placeholder="e.g. 1"
              />
            </div>

            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as "" | PaymentStatus)}
                className="mt-1 border rounded px-3 py-2 text-sm w-44"
              >
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            <div className="flex gap-2">
              <Button type="submit" variant="secondary" disabled={loading}>
                Apply filters
              </Button>
              <Button type="button" variant="ghost" onClick={handleClearFilters} disabled={loading}>
                Clear
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {error && (
        <Card>
          <CardBody>
            <div className="bg-red-50 text-red-800 px-4 py-2 rounded text-sm">
              {error}
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">ID</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Reservation</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Guest</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Room</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-700">Amount</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Method</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Status</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Date</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-700">Actions</th>
                </tr>
              </thead>

              <tbody>
                {payments.length === 0 && !loading && (
                  <tr>
                    <td colSpan={9} className="px-4 py-6 text-center text-gray-500">
                      No payments found.
                    </td>
                  </tr>
                )}

                {payments.map((payment) => (
                  <tr key={payment.id} className="border-t last:border-b">
                    <td className="px-4 py-2 align-top">{payment.id}</td>
                    <td className="px-4 py-2 align-top">#{payment.bookingId}</td>
                    <td className="px-4 py-2 align-top">{payment.booking?.guest?.name || "-"}</td>
                    <td className="px-4 py-2 align-top">
                      {payment.booking?.room
                        ? `Room ${payment.booking.room.number} (floor ${payment.booking.room.floor})`
                        : "-"}
                    </td>
                    <td className="px-4 py-2 align-top text-right">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="px-4 py-2 align-top">{getMethodLabel(payment.method)}</td>
                    <td className="px-4 py-2 align-top">
                      <Badge variant={getStatusVariant(payment.status)}>
                        {getStatusLabel(payment.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 align-top">{formatDateTime(payment.createdAt)}</td>

                    <td className="px-4 py-2 align-top text-right space-x-2">
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-xs px-3 py-1"
                        onClick={() => handleOpenEdit(payment)}
                        disabled={loading}
                      >
                        Edit
                      </Button>

                      <RoleGate allowed={["admin"]}>
                        <Button
                          type="button"
                          variant="danger"
                          className="text-xs px-3 py-1"
                          onClick={() => handleDelete(payment)}
                          disabled={loading}
                        >
                          Delete
                        </Button>
                      </RoleGate>
                    </td>
                  </tr>
                ))}

                {loading && (
                  <tr>
                    <td colSpan={9} className="px-4 py-4 text-center text-gray-500">
                      Loading...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardBody>
              <h3 className="text-lg font-semibold mb-4">
                {isEditing ? "Edit payment" : "New payment"}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Reservation
                  </label>

                  <select
                    value={form.bookingId}
                    onChange={(e) => handleChange("bookingId", e.target.value)}
                    className="mt-1 w-full border rounded px-3 py-2 text-sm"
                    disabled={loadingBookings || loading}
                  >
                    <option value="">
                      {loadingBookings ? "Loading reservations..." : "Select a reservation"}
                    </option>

                    {bookings.map((b) => (
                      <option key={b.id} value={b.id}>
                        #{b.id} -{" "}
                        {b.room
                          ? `Room ${b.room.number} (floor ${b.room.floor})`
                          : "No room"}{" "}
                        - {b.guest?.name ?? "No guest"} - {formatDate(b.checkIn)} →{" "}
                        {formatDate(b.checkOut)}
                      </option>
                    ))}
                  </select>

                  <p className="text-xs text-gray-500 mt-1">
                    A reservation with this ID must exist.
                  </p>

                  <div className="flex flex-wrap gap-2 mt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-xs px-2 py-1"
                      onClick={() => navigate("/reservations/new")}
                    >
                      New reservation
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-xs px-2 py-1"
                      onClick={() => navigate("/guests/new")}
                    >
                      New guest
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-xs px-2 py-1"
                      onClick={() => navigate("/rooms/new")}
                    >
                      New room
                    </Button>
                  </div>

                  {selectedBooking && (
                    <div className="mt-2 text-xs text-gray-600 space-y-1 border rounded p-2 bg-gray-50">
                      <p>
                        <span className="font-semibold">Reservation total:</span>{" "}
                        {formatCurrency(selectedBooking.totalPrice)}
                      </p>
                      <p>
                        <span className="font-semibold">Total paid (completed):</span>{" "}
                        {formatCurrency(totalPaidForSelected)}
                      </p>
                      <p>
                        <span className="font-semibold">Due:</span>{" "}
                        {formatCurrency(Math.max(0, remainingForSelected))}
                      </p>
                      <p>
                        <span className="font-semibold">Status:</span>{" "}
                        {isBookingFullyPaid ? "✅ Fully paid" : "🟡 Balance due"}
                      </p>

                      {!isBookingFullyPaid && remainingForSelected > 0 && (
                        <div className="pt-2">
                          <Button
                            type="button"
                            variant="secondary"
                            className="text-xs px-2 py-1"
                            onClick={handleFillRemainingAmount}
                          >
                            Use balance due as amount
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {!isEditing && isBookingFullyPaid && (
                    <p className="mt-2 text-xs text-red-600">
                      This reservation is already fully paid. You can't register
                      more completed payments.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Amount
                  </label>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) => handleChange("amount", e.target.value)}
                    className="mt-1 w-full border rounded px-3 py-2 text-sm"
                    placeholder="e.g. 1200"
                    min={0}
                    step={1}
                    disabled={loading}
                  />
                  {selectedBooking && form.status === "completed" && (
                    <p className="mt-1 text-xs text-gray-500">
                      Completed payments can’t exceed the remaining balance.
                    </p>
                  )}
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Payment method
                    </label>
                    <select
                      value={form.method}
                      onChange={(e) =>
                        handleChange("method", e.target.value as PaymentMethod)
                      }
                      className="mt-1 w-full border rounded px-3 py-2 text-sm"
                      disabled={loading}
                    >
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="transfer">Bank transfer</option>
                    </select>
                  </div>

                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Status
                    </label>
                    <select
                      value={form.status}
                      onChange={(e) =>
                        handleChange("status", e.target.value as PaymentStatus)
                      }
                      className="mt-1 w-full border rounded px-3 py-2 text-sm"
                      disabled={loading}
                    >
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                      <option value="failed">Failed</option>
                    </select>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 text-red-800 px-3 py-2 rounded text-xs">
                    {error}
                  </div>
                )}

                <div className="flex justify-end gap-2 mt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleCloseModal}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading || disableCreateCompletedWhenFullyPaid}
                  >
                    {isEditing ? "Save changes" : "Create payment"}
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}  