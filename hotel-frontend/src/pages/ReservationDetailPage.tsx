import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type React from "react";
import api from "../api/api";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";

type PaymentStatus = "pending" | "completed" | "failed";
type BookingStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "checked_in"
  | "checked_out";

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
  status: BookingStatus | string;
  createdAt?: string;
  updatedAt?: string;
}

interface Payment {
  id: number;
  bookingId: number;
  amount: number;
  status: PaymentStatus;
  method: "cash" | "card" | "transfer";
  createdAt: string;
}

function normalizeStatus(status: string): BookingStatus | null {
  const s = String(status || "").toLowerCase();
  if (
    s === "pending" ||
    s === "confirmed" ||
    s === "cancelled" ||
    s === "checked_in" ||
    s === "checked_out"
  ) {
    return s;
  }
  if (s === "canceled") return "cancelled";
  return null;
}

function mapApiError(err: any): string {
  const code = err?.response?.data?.code as string | undefined;
  const serverMsg = err?.response?.data?.error as string | undefined;

  switch (code) {
    case "ROOM_NOT_AVAILABLE":
      return "Room is not available for the selected dates.";
    case "ROOM_IN_MAINTENANCE":
      return "This room is under maintenance and can’t be booked.";
    case "INVALID_DATES":
      return "Check-out must be after check-in.";
    case "BOOKING_LOCKED":
      return "This reservation can’t be edited in its current status.";
    default:
      return serverMsg || "Something went wrong. Please try again.";
  }
}


const transitions: Record<BookingStatus, BookingStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["checked_in", "cancelled"],
  checked_in: ["checked_out"],
  checked_out: [],
  cancelled: [],
};

export default function ReservationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bookingIdNumber = id ? Number(id) : NaN;

  const formatDate = (value: string) => {
    try {
      return new Date(value).toLocaleDateString();
    } catch {
      return value;
    }
  };

  const formatDateTime = (value?: string) => {
    if (!value) return "-";
    try {
      return new Date(value).toLocaleString();
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

  const getBookingStatusVariant = (status: string) => {
    const lower = status.toLowerCase();

    if (lower === "pending") return "warning";
    if (lower === "confirmed") return "default";
    if (lower === "cancelled" || lower === "canceled") return "danger";
    if (lower === "checked_in") return "success";
    if (lower === "checked_out") return "default";

    return "default";
  };

  const getMethodLabel = (method: Payment["method"]) => {
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

  const loadBooking = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await api.get(`/bookings/${bookingIdNumber}`);
      const data = res.data?.data ?? res.data;
      setBooking(data ?? null);
    } catch (err: any) {
      console.error("Error loading booking detail", err);
      setError(mapApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const loadPayments = async () => {
    try {
      setLoadingPayments(true);
      const res = await api.get("/payments", {
        params: { bookingId: bookingIdNumber },
      });
      const data = res.data?.data ?? res.data;
      setPayments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error loading payments for booking", err);
      // not critical
    } finally {
      setLoadingPayments(false);
    }
  };

  const refreshAll = async () => {
    await Promise.all([loadBooking(), loadPayments()]);
  };

  useEffect(() => {
    if (!id || Number.isNaN(bookingIdNumber)) {
      setError("Invalid reservation ID.");
      setLoading(false);
      return;
    }

    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const normalizedStatus = useMemo(
    () => (booking ? normalizeStatus(booking.status as string) : null),
    [booking]
  );

  const isLocked = normalizedStatus === "checked_out" || normalizedStatus === "cancelled";

  const totalPaid = payments
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + p.amount, 0);

  const totalPrice = booking?.totalPrice ?? 0;
  const remaining = totalPrice - totalPaid;

  let paymentStatusLabel = "No payments";
  let paymentStatusVariant: "success" | "warning" | "danger" = "danger";

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

  const handleGoBack = () => {
    navigate("/reservations");
  };

  const handleGoToAddPayment = () => {
    if (!booking) return;
    navigate(`/payments?bookingId=${booking.id}`);
  };

  const handleGoToEdit = () => {
    if (!booking) return;
    
    navigate(`/reservations/${booking.id}/edit`);
  };

  const handleDelete = async () => {
    if (!booking || !normalizedStatus) return;

    
    if (!(normalizedStatus === "pending" || normalizedStatus === "cancelled")) {
      setError("Only pending or cancelled reservations can be deleted.");
      return;
    }

    const ok = window.confirm(
      `Delete reservation #${booking.id}? This action cannot be undone.`
    );
    if (!ok) return;

    try {
      setDeleting(true);
      setError(null);

      await api.delete(`/bookings/${booking.id}`);

      navigate("/reservations");
    } catch (err: any) {
      console.error("Error deleting booking", err);
      setError(mapApiError(err));
    } finally {
      setDeleting(false);
    }
  };

  const handleChangeStatus = async (nextStatus: BookingStatus) => {
    if (!booking || !normalizedStatus) return;

  
    const allowed = transitions[normalizedStatus]?.includes(nextStatus);
    if (!allowed) {
      setError(`Invalid status transition: ${normalizedStatus} → ${nextStatus}`);
      return;
    }

    const ok = window.confirm(
      `Are you sure you want to set status to "${nextStatus}"?`
    );
    if (!ok) return;

    try {
      setUpdatingStatus(true);
      setError(null);

      await api.patch(`/bookings/${booking.id}/status`, { status: nextStatus });

      await refreshAll();
    } catch (err: any) {
      console.error("Error updating booking status", err);
      setError(mapApiError(err));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const renderStatusActions = () => {
    if (!booking || !normalizedStatus) return null;

    const nexts = transitions[normalizedStatus] ?? [];

    if (nexts.length === 0) {
      return (
        <p className="text-xs text-gray-500">
          This reservation is finished. No further status changes can be made.
        </p>
      );
    }

    const buttons: React.ReactElement[] = [];

    if (nexts.includes("confirmed")) {
      buttons.push(
        <Button
          key="confirm"
          type="button"
          variant="secondary"
          className="text-xs px-3 py-1"
          disabled={updatingStatus}
          onClick={() => handleChangeStatus("confirmed")}
        >
          Confirm
        </Button>
      );
    }

    if (nexts.includes("checked_in")) {
      buttons.push(
        <Button
          key="checkin"
          type="button"
          variant="secondary"
          className="text-xs px-3 py-1"
          disabled={updatingStatus}
          onClick={() => handleChangeStatus("checked_in")}
        >
          Check-in
        </Button>
      );
    }

    if (nexts.includes("checked_out")) {
      buttons.push(
        <Button
          key="checkout"
          type="button"
          variant="secondary"
          className="text-xs px-3 py-1"
          disabled={updatingStatus}
          onClick={() => handleChangeStatus("checked_out")}
        >
          Check-out
        </Button>
      );
    }

    if (nexts.includes("cancelled")) {
      buttons.push(
        <Button
          key="cancel"
          type="button"
          variant="danger"
          className="text-xs px-3 py-1"
          disabled={updatingStatus}
          onClick={() => handleChangeStatus("cancelled")}
        >
          Cancel
        </Button>
      );
    }

    return (
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-gray-500 mr-1">Change status:</span>
        {buttons}
        {updatingStatus && (
          <span className="text-xs text-gray-500">Updating status...</span>
        )}
      </div>
    );
  };

  if (loading && !booking) {
    return (
      <div className="space-y-6">
        <PageHeader title="Reservation details" description="Loading reservation information..." />
        <Card>
          <CardBody>
            <p className="text-sm text-gray-500">Loading...</p>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Reservation details"
          description="Could not load the reservation."
          actions={
            <Button type="button" onClick={handleGoBack}>
              Back to reservations
            </Button>
          }
        />
        <Card>
          <CardBody>
            <div className="bg-red-50 text-red-800 px-4 py-2 rounded text-sm">
              {error || "Reservation not found."}
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Reservation #${booking.id}`}
        description="Full reservation details."
        actions={
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={handleGoBack}>
              Back to reservations
            </Button>

            <Button type="button" variant="secondary" onClick={refreshAll}>
              Refresh
            </Button>

            <Button type="button" onClick={handleGoToAddPayment}>
              Add payment
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={handleGoToEdit}
              disabled={isLocked}
              title={isLocked ? "This reservation can’t be edited." : "Edit reservation"}
            >
              Edit
            </Button>

            <Button
              type="button"
              variant="danger"
              onClick={handleDelete}
              disabled={deleting || !normalizedStatus || !(normalizedStatus === "pending" || normalizedStatus === "cancelled")}
              title={
                normalizedStatus && !(normalizedStatus === "pending" || normalizedStatus === "cancelled")
                  ? "Only pending/cancelled reservations can be deleted."
                  : "Delete reservation"
              }
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        }
      />

      {isLocked && (
        <Card>
          <CardBody>
            <div className="bg-amber-50 text-amber-900 px-4 py-2 rounded text-sm">
              This reservation is <span className="font-semibold">{String(booking.status)}</span> and editing is locked.
            </div>
          </CardBody>
        </Card>
      )}

      {/* Main reservation data */}
      <Card>
        <CardBody>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-800">General information</h3>
              <p className="text-sm">
                <span className="font-medium text-gray-700">Guest:</span>{" "}
                {booking.guest?.name || "-"}
              </p>
              <p className="text-sm">
                <span className="font-medium text-gray-700">Email:</span>{" "}
                {booking.guest?.email || "-"}
              </p>
              <p className="text-sm">
                <span className="font-medium text-gray-700">Room:</span>{" "}
                {booking.room
                  ? `Room ${booking.room.number} (floor ${booking.room.floor})`
                  : "-"}
              </p>
              <p className="text-sm">
                <span className="font-medium text-gray-700">Room type:</span>{" "}
                {booking.room?.roomType?.name || "-"}
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-gray-800">Dates and status</h3>
              <p className="text-sm">
                <span className="font-medium text-gray-700">Check-in:</span>{" "}
                {formatDate(booking.checkIn)}
              </p>
              <p className="text-sm">
                <span className="font-medium text-gray-700">Check-out:</span>{" "}
                {formatDate(booking.checkOut)}
              </p>
              <p className="text-sm flex items-center gap-2">
                <span className="font-medium text-gray-700">Current status:</span>{" "}
                <Badge variant={getBookingStatusVariant(booking.status as string)}>
                  {getBookingStatusLabel(booking.status as string)}
                </Badge>
              </p>
              <p className="text-xs text-gray-500">
                Created: {formatDateTime(booking.createdAt)} | Last updated: {formatDateTime(booking.updatedAt)}
                {formatDateTime(booking.updatedAt)}
              </p>

              <div className="mt-3">{renderStatusActions()}</div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Payments summary */}
      <Card>
        <CardBody>
          <h3 className="font-semibold text-gray-800 mb-3">Payments summary</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs text-gray-500">Reservation total</p>
              <p className="text-lg font-semibold mt-1">
                {formatCurrency(totalPrice)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total paid</p>
              <p className="text-lg font-semibold mt-1">
                {formatCurrency(totalPaid)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Due</p>
              <p className="text-lg font-semibold mt-1">
                {formatCurrency(remaining)}
              </p>
            </div>
          </div>
          <div className="mt-3">
            <Badge variant={paymentStatusVariant}>{paymentStatusLabel}</Badge>
          </div>
          <div className="mt-4">
            <Button type="button" onClick={handleGoToAddPayment}>
              Add payment for this reservation
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Payments list */}
      <Card>
        <CardBody>
          <h3 className="font-semibold text-gray-800 mb-3">Related payments</h3>

          {loadingPayments && (
            <p className="text-sm text-gray-500 mb-2">Loading payments...</p>
          )}

          {payments.length === 0 && !loadingPayments && (
            <p className="text-sm text-gray-500">
              No payments recorded for this reservation.
            </p>
          )}

          {payments.length > 0 && (
            <div className="overflow-x-auto mt-2">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">ID</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Amount</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Method</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Status</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-t last:border-b">
                      <td className="px-4 py-2 align-top">{p.id}</td>
                      <td className="px-4 py-2 align-top">
                        {formatCurrency(p.amount)}
                      </td>
                      <td className="px-4 py-2 align-top">
                        {getMethodLabel(p.method)}
                      </td>
                      <td className="px-4 py-2 align-top">
                        <Badge variant={getStatusVariant(p.status)}>
                          {getStatusLabel(p.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 align-top">
                        {formatDateTime(p.createdAt)}
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
