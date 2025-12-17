import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import api from "../api/api";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";

type PaymentStatus = "pending" | "completed" | "failed";

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

interface Payment {
  id: number;
  bookingId: number;
  amount: number;
  status: PaymentStatus;
}

export default function Reservations() {
  const navigate = useNavigate();

  const [filterGuest, setFilterGuest] = useState("");
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<
    "" | "none" | "partial" | "full"
  >("");

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBookings = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get("/bookings");
      const data = res.data?.data ?? res.data;
      setBookings(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      console.error("Error loading bookings", err);

      const message =
        axios.isAxiosError(err)
          ? (err.response?.data as any)?.error || err.message
          : err instanceof Error
          ? err.message
          : "There was an error loading reservations. Please try again.";

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const loadPayments = async () => {
    try {
      setLoadingPayments(true);
      const res = await api.get("/payments");
      const data = res.data?.data ?? res.data;
      setPayments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error loading payments for reservations", err);
      // not critical, we just won't show payment summary accurately
    } finally {
      setLoadingPayments(false);
    }
  };

  useEffect(() => {
    loadBookings();
    loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatDate = (value: string) => {
    try {
      return new Date(value).toLocaleDateString();
    } catch {
      return value;
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-UY", {
      style: "currency",
      currency: "UYU",
      minimumFractionDigits: 0,
    }).format(value);

  const getBookingStatusLabel = (status: string) => {
    const lower = status.toLowerCase();
    if (lower === "pending") return "Pending";
    if (lower === "confirmed") return "Confirmed";
    if (lower === "cancelled" || lower === "canceled") return "Cancelled";
    if (lower === "checked_in") return "Checked in";
    if (lower === "checked_out") return "Checked out";
    return status;
  };

  // Must match BadgeVariant: "default" | "success" | "warning" | "danger"
  const getBookingStatusVariant = (status: string) => {
    const lower = status.toLowerCase();

    if (lower === "pending") return "warning";
    if (lower === "confirmed") return "default";
    if (lower === "cancelled" || lower === "canceled") return "danger";
    if (lower === "checked_in") return "success";
    if (lower === "checked_out") return "default";

    return "default";
  };

  // Overall totals
  const totalBookings = bookings.length;
  const totalRevenue = bookings.reduce((sum, b) => sum + (b.totalPrice ?? 0), 0);

  const totalPaidAllBookings = payments
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + p.amount, 0);

  // Filters: by guest and payment status
  const filteredBookings = bookings.filter((booking) => {
    const guestName = booking.guest?.name?.toLowerCase() ?? "";
    const matchesGuest =
      !filterGuest.trim() ||
      guestName.includes(filterGuest.trim().toLowerCase());

    const paymentsForBooking = payments.filter(
      (p) => p.bookingId === booking.id && p.status === "completed"
    );
    const totalPaid = paymentsForBooking.reduce((sum, p) => sum + p.amount, 0);
    const remaining =
      booking.totalPrice != null ? booking.totalPrice - totalPaid : 0;

    let paymentStatus: "none" | "partial" | "full" = "none";
    if (totalPaid <= 0) paymentStatus = "none";
    else if (remaining > 0) paymentStatus = "partial";
    else paymentStatus = "full";

    const matchesPaymentStatus =
      !filterPaymentStatus || paymentStatus === filterPaymentStatus;

    return matchesGuest && matchesPaymentStatus;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservations"
        description="View and manage all hotel reservations."
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => navigate("/payments")}
            >
              Go to payments
            </Button>
            <Button type="button" onClick={() => navigate("/reservations/new")}>
              New reservation
            </Button>
          </div>
        }
      />

      <Card>
        <CardBody>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs text-gray-500">Total reservations</p>
              <p className="text-lg font-semibold mt-1">{totalBookings}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total reservation amount</p>
              <p className="text-lg font-semibold mt-1">
                {formatCurrency(totalRevenue)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">
                Total paid (completed payments)
              </p>
              <p className="text-lg font-semibold mt-1">
                {loadingPayments
                  ? "Loading..."
                  : formatCurrency(totalPaidAllBookings)}
              </p>
            </div>
          </div>
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
          <form className="flex flex-wrap gap-4 items-end">
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700">
                Search by guest
              </label>
              <input
                type="text"
                value={filterGuest}
                onChange={(e) => setFilterGuest(e.target.value)}
                className="mt-1 border rounded px-3 py-2 text-sm w-60"
                placeholder="Guest name"
              />
            </div>

            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700">
                Payment status
              </label>
              <select
                value={filterPaymentStatus}
                onChange={(e) =>
                  setFilterPaymentStatus(
                    e.target.value as "" | "none" | "partial" | "full"
                  )
                }
                className="mt-1 border rounded px-3 py-2 text-sm w-52"
              >
                <option value="">All</option>
                <option value="none">No payments</option>
                <option value="partial">Partially paid</option>
                <option value="full">Fully paid</option>
              </select>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setFilterGuest("");
                  setFilterPaymentStatus("");
                }}
              >
                Clear filters
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">
                    ID
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">
                    Guest
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">
                    Room
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">
                    Dates
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-gray-700">
                    Total
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-gray-700">
                    Paid
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-gray-700">
                    Due
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">
                    Reservation status
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">
                    Payment status
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredBookings.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-6 text-center text-gray-500"
                    >
                      {bookings.length === 0
                        ? "No reservations found."
                        : "No reservations match your filters."}
                    </td>
                  </tr>
                )}

                {filteredBookings.map((booking) => {
                  const paymentsForBooking = payments.filter(
                    (p) => p.bookingId === booking.id && p.status === "completed"
                  );
                  const totalPaid = paymentsForBooking.reduce(
                    (sum, p) => sum + p.amount,
                    0
                  );
                  const remaining =
                    booking.totalPrice != null
                      ? booking.totalPrice - totalPaid
                      : 0;

                  let paymentStatusLabel = "No payments";
                  let paymentStatusVariant: "success" | "warning" | "danger" =
                    "danger";

                  if (totalPaid <= 0) {
                    paymentStatusLabel = "No payments";
                    paymentStatusVariant = "danger";
                  } else if (remaining > 0) {
                    paymentStatusLabel = "Partially paid";
                    paymentStatusVariant = "warning";
                  } else {
                    paymentStatusLabel = "Fully paid";
                    paymentStatusVariant = "success";
                  }

                  return (
                    <tr key={booking.id} className="border-t last:border-b">
                      <td className="px-4 py-2 align-top">{booking.id}</td>
                      <td className="px-4 py-2 align-top">
                        {booking.guest?.name || "-"}
                      </td>
                      <td className="px-4 py-2 align-top">
                        {booking.room
                          ? `Room ${booking.room.number} (floor ${booking.room.floor})`
                          : "-"}
                      </td>
                      <td className="px-4 py-2 align-top">
                        {formatDate(booking.checkIn)} →{" "}
                        {formatDate(booking.checkOut)}
                      </td>
                      <td className="px-4 py-2 align-top text-right">
                        {formatCurrency(booking.totalPrice ?? 0)}
                      </td>
                      <td className="px-4 py-2 align-top text-right">
                        {formatCurrency(totalPaid)}
                      </td>
                      <td className="px-4 py-2 align-top text-right">
                        {formatCurrency(remaining)}
                      </td>
                      <td className="px-4 py-2 align-top">
                        <Badge variant={getBookingStatusVariant(booking.status)}>
                          {getBookingStatusLabel(booking.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 align-top">
                        <Badge variant={paymentStatusVariant}>
                          {paymentStatusLabel}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 align-top text-right space-x-2">
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-xs px-3 py-1"
                          onClick={() => navigate(`/reservations/${booking.id}`)}
                        >
                          View details
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          className="text-xs px-3 py-1"
                          onClick={() => navigate("/payments")}
                        >
                          Manage payments
                        </Button>
                      </td>
                    </tr>
                  );
                })}

                {loading && (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-4 text-center text-gray-500"
                    >
                      Loading...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
