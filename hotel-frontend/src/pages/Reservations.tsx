import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../api/api";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import RoleGate from "../auth/RoleGate";

type PaymentStatus = "pending" | "completed" | "failed";

// Booking status (backend)
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

  /**
   * Here I support enriched fields returned by backend.
   * If they exist, I will use them to compute Paid/Due including charges.
   */
  paidCompleted?: number;
  chargesTotal?: number;
  dueAmount?: number;
}

interface Payment {
  id: number;
  bookingId: number;
  amount: number;
  status: PaymentStatus;
}

/**
 * ===========================
 *  CONFIRM MODAL (PRO UX)
 * ===========================
 * Here I replace window.confirm() with a styled modal:
 * - consistent UI
 * - smooth animation
 * - optional loading state
 */
function ConfirmModal({
  open,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        onClick={loading ? undefined : onCancel}
      />

      {/* Modal */}
      <div className="absolute inset-0 flex items-center justify-center px-4">
        <div
          className={[
            "w-full max-w-md rounded-xl border bg-white shadow-xl",
            "transform transition-all duration-200",
            "animate-[modalIn_180ms_ease-out]",
          ].join(" ")}
        >
          <div className="p-4 border-b">
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>

            {description && (
              <p className="text-sm text-slate-600 mt-1">{description}</p>
            )}
          </div>

          <div className="p-4 flex justify-end gap-2">
            <button
              type="button"
              className="text-sm px-4 py-2 rounded-lg border bg-white hover:bg-slate-50 transition disabled:opacity-60"
              onClick={onCancel}
              disabled={!!loading}
            >
              {cancelText}
            </button>

            <button
              type="button"
              className="text-sm px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition disabled:opacity-60"
              onClick={onConfirm}
              disabled={!!loading}
            >
              {loading ? "Please wait..." : confirmText}
            </button>
          </div>
        </div>
      </div>

      {/* Keyframes (inline so you don't need Tailwind config changes) */}
      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: translateY(6px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

/**
 * Here I map backend errors into user-friendly messages.
 * I also support BOOKING_HAS_DUE and display the due amount when possible.
 */
function mapApiError(err: any): string {
  const code = err?.response?.data?.code as string | undefined;
  const serverMsg = err?.response?.data?.error as string | undefined;

  // Here I read optional extra info from the backend (like due amount).
  const due = err?.response?.data?.details?.due as number | undefined;

  switch (code) {
    case "ROOM_NOT_AVAILABLE":
      return "Room is not available for the selected dates.";
    case "ROOM_IN_MAINTENANCE":
      return "This room is under maintenance and can’t be booked.";
    case "INVALID_DATES":
      return "Check-out must be after check-in.";
    case "BOOKING_LOCKED":
      return "This booking can’t be edited in its current status.";

    // Here I show a clear message when backend blocks check-out due to outstanding balance.
    case "BOOKING_HAS_DUE":
      return typeof due === "number"
        ? `Cannot check-out. Outstanding balance: ${new Intl.NumberFormat(
            "en-UY",
            {
              style: "currency",
              currency: "UYU",
              minimumFractionDigits: 0,
            }
          ).format(due)}`
        : "Cannot check-out while there is an outstanding balance.";

    default:
      return serverMsg || "There was an error. Please try again.";
  }
}

/**
 * Here I normalize booking status for safety (backend can return strings).
 */
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

export default function Reservations() {
  const navigate = useNavigate();

  const [filterGuest, setFilterGuest] = useState("");
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<
    "" | "none" | "partial" | "full"
  >("");
  const [filterBookingStatus, setFilterBookingStatus] = useState<
    "" | BookingStatus
  >("");

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);

  // Here I store a local error banner message (so I avoid duplicate global toasts).
  const [error, setError] = useState<string | null>(null);

  // Here I track which booking is being updated (for button loading states).
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  /**
   *  Here I store the "confirm action" request.
   * This replaces window.confirm() with a professional modal UI.
   */
  const [confirm, setConfirm] = useState<null | {
    bookingId: number;
    next: BookingStatus;
    title: string;
    description?: string;
  }>(null);

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

  /**
   * Here I load bookings from the backend.
   * I set silentErrorToast=true because I render my own banner in this page.
   */
  const loadBookings = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await api.get("/bookings", {
        // Here I prevent global toast duplication on this page.
        silentErrorToast: true,
      } as any);

      const data = res.data?.data ?? res.data;
      setBookings(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Error loading bookings", err);
      setError(mapApiError(err));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Here I load payments so I can compute paid amounts per booking
   * when backend does not provide paidCompleted/dueAmount.
   */
  const loadPayments = async () => {
    try {
      setLoadingPayments(true);

      const res = await api.get("/payments", {
        silentErrorToast: true,
      } as any);

      const data = res.data?.data ?? res.data;
      setPayments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error loading payments for reservations", err);
      // Here I do not block the whole page if payments fail; bookings can still render.
    } finally {
      setLoadingPayments(false);
    }
  };

  /**
   * Here I refresh both bookings and payments at the same time.
   */
  const refreshAll = async () => {
    await Promise.all([loadBookings(), loadPayments()]);
  };

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const totalBookings = bookings.length;

  /**
   * Here I keep "total revenue" based on base booking totals.
   * If later you want "total revenue including charges", tell me and I’ll adjust it.
   */
  const totalRevenue = bookings.reduce((sum, b) => sum + (b.totalPrice ?? 0), 0);

  const totalPaidAllBookings = payments
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + p.amount, 0);

  /**
   * Here I build a helper map: bookingId -> { paid, due }.
   * Priority:
   * 1) If backend provides dueAmount/paidCompleted => I use them (includes charges).
   * 2) Otherwise I fallback to payments-based calculation (legacy mode).
   */
  const bookingMoneyMap = useMemo(() => {
    const map = new Map<number, { paid: number; due: number }>();

    for (const b of bookings) {
      //  Best: use backend enriched values (already includes charges).
      if (
        typeof b.paidCompleted === "number" &&
        typeof b.dueAmount === "number"
      ) {
        map.set(b.id, { paid: b.paidCompleted, due: b.dueAmount });
        continue;
      }

      // Fallback: compute from payments only (does NOT include charges).
      const paid = payments
        .filter((p) => p.bookingId === b.id && p.status === "completed")
        .reduce((sum, p) => sum + p.amount, 0);

      const due =
        b.totalPrice != null ? Math.max((b.totalPrice ?? 0) - paid, 0) : 0;

      map.set(b.id, { paid, due });
    }

    return map;
  }, [bookings, payments]);

  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      const guestName = booking.guest?.name?.toLowerCase() ?? "";

      const matchesGuest =
        !filterGuest.trim() ||
        guestName.includes(filterGuest.trim().toLowerCase());

      const normalized = normalizeStatus(booking.status);

      const matchesBookingStatus =
        !filterBookingStatus || normalized === filterBookingStatus;

      const money = bookingMoneyMap.get(booking.id) ?? { paid: 0, due: 0 };
      const totalPaid = money.paid;
      const remaining = money.due;

      let paymentStatus: "none" | "partial" | "full" = "none";
      if (totalPaid <= 0) paymentStatus = "none";
      else if (remaining > 0) paymentStatus = "partial";
      else paymentStatus = "full";

      const matchesPaymentStatus =
        !filterPaymentStatus || paymentStatus === filterPaymentStatus;

      return matchesGuest && matchesPaymentStatus && matchesBookingStatus;
    });
  }, [
    bookings,
    bookingMoneyMap,
    filterGuest,
    filterPaymentStatus,
    filterBookingStatus,
  ]);

  /**
   * Here I define quick actions for each status.
   * Important: I disable Check-out when due > 0 to match backend rule.
   */
  const getQuickActions = (
    status: BookingStatus,
    due: number
  ): Array<{
    label: string;
    next: BookingStatus;
    variant?: "secondary" | "danger" | "ghost" | "default";
    disabled?: boolean;
    disabledReason?: string;
  }> => {
    if (status === "pending") {
      return [
        { label: "Confirm", next: "confirmed", variant: "secondary" },
        { label: "Cancel", next: "cancelled", variant: "danger" },
      ];
    }

    if (status === "confirmed") {
      return [
        { label: "Check-in", next: "checked_in", variant: "secondary" },
        { label: "Cancel", next: "cancelled", variant: "danger" },
      ];
    }

    if (status === "checked_in") {
      return [
        {
          label: "Check-out",
          next: "checked_out",
          variant: "secondary",
          disabled: due > 0,
          disabledReason:
            due > 0 ? `Outstanding balance: ${formatCurrency(due)}` : undefined,
        },
      ];
    }

    return [];
  };

  /**
   * Here I open the confirmation modal instead of window.confirm().
   * This makes the experience look modern and professional.
   */
  const requestStatusChange = (bookingId: number, next: BookingStatus) => {
    setConfirm({
      bookingId,
      next,
      title: `Confirm status change`,
      description: `Are you sure you want to set booking #${bookingId} to "${next}"?`,
    });
  };

  /**
   * Here I patch booking status (real API call).
   * I set silentErrorToast=true because I show the banner with setError().
   */
  const updateStatus = async (bookingId: number, next: BookingStatus) => {
    try {
      setUpdatingId(bookingId);
      setError(null);

      await api.patch(
        `/bookings/${bookingId}/status`,
        { status: next },
        { silentErrorToast: true } as any
      );

      // Here I refresh both lists so Paid/Due and status stay in sync.
      await refreshAll();
    } catch (err: any) {
      console.error("Error updating booking status", err);
      setError(mapApiError(err));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
  <div className="space-y-6">

    {/* HEADER */}
    <PageHeader
      title="Reservations"
      description="View and manage all hotel reservations."
      actions={
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button
            variant="secondary"
            type="button"
            onClick={refreshAll}
            className="w-full sm:w-auto"
          >
            Refresh
          </Button>

          <RoleGate allowed={["admin", "receptionist"]}>
            <Button
              variant="secondary"
              type="button"
              onClick={() => navigate("/payments")}
              className="w-full sm:w-auto"
            >
              Go to payments
            </Button>
          </RoleGate>

          <Button
            type="button"
            onClick={() => navigate("/reservations/new")}
            className="w-full sm:w-auto"
          >
            New reservation
          </Button>
        </div>
      }
    />

    {/* STATS */}
    <Card>
      <CardBody>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatBlock label="Total reservations" value={totalBookings} />
          <StatBlock
            label="Total reservation amount"
            value={formatCurrency(totalRevenue)}
          />
          <StatBlock
            label="Total paid"
            value={
              loadingPayments
                ? "Loading..."
                : formatCurrency(totalPaidAllBookings)
            }
          />
        </div>
      </CardBody>
    </Card>

    {/* ERROR */}
    {error && (
      <Card>
        <CardBody>
          <div className="bg-red-50 text-red-800 px-4 py-2 rounded text-sm">
            {error}
          </div>
        </CardBody>
      </Card>
    )}

    {/* FILTERS */}
    <Card>
      <CardBody>
        <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          <div>
            <label className="text-sm font-medium text-gray-700">
              Search by guest
            </label>
            <input
              type="text"
              value={filterGuest}
              onChange={(e) => setFilterGuest(e.target.value)}
              className="mt-1 w-full border rounded px-3 py-2 text-sm"
              placeholder="Guest name"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">
              Booking status
            </label>
            <select
              value={filterBookingStatus}
              onChange={(e) => setFilterBookingStatus(e.target.value as any)}
              className="mt-1 w-full border rounded px-3 py-2 text-sm"
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="checked_in">Checked in</option>
              <option value="checked_out">Checked out</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
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
              className="mt-1 w-full border rounded px-3 py-2 text-sm"
            >
              <option value="">All</option>
              <option value="none">No payments</option>
              <option value="partial">Partially paid</option>
              <option value="full">Fully paid</option>
            </select>
          </div>

          <div className="flex items-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setFilterGuest("");
                setFilterPaymentStatus("");
                setFilterBookingStatus("");
              }}
              className="w-full"
            >
              Clear filters
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>

    {/* TABLE */}
    <Card>
      <CardBody>
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] text-sm">
            <thead className="bg-gray-50">
              <tr>
                <Th>ID</Th>
                <Th>Guest</Th>
                <Th>Room</Th>
                <Th>Dates</Th>
                <Th align="right">Total</Th>
                <Th align="right">Paid</Th>
                <Th align="right">Due</Th>
                <Th>Status</Th>
                <Th>Payment</Th>
                <Th>Quick actions</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>

            <tbody>
              {filteredBookings.map((booking) => {
                const normalized = normalizeStatus(booking.status);
                const money = bookingMoneyMap.get(booking.id) ?? { paid: 0, due: 0 };
                const totalPaid = money.paid;
                const remaining = money.due;

                let paymentStatusLabel = "No payments";
                let paymentStatusVariant: "success" | "warning" | "danger" = "danger";

                if (totalPaid > 0 && remaining > 0) {
                  paymentStatusLabel = "Partially paid";
                  paymentStatusVariant = "warning";
                }
                if (remaining <= 0 && totalPaid > 0) {
                  paymentStatusLabel = "Fully paid";
                  paymentStatusVariant = "success";
                }

                const quickActions = normalized
                  ? getQuickActions(normalized, remaining)
                  : [];

                const isUpdating = updatingId === booking.id;

                return (
                  <tr key={booking.id} className="border-t hover:bg-slate-50 transition">
                    <Td>{booking.id}</Td>
                    <Td>{booking.guest?.name || "-"}</Td>
                    <Td>
                      {booking.room
                        ? `Room ${booking.room.number} (floor ${booking.room.floor})`
                        : "-"}
                    </Td>
                    <Td>
                      {formatDate(booking.checkIn)} → {formatDate(booking.checkOut)}
                    </Td>
                    <Td align="right">{formatCurrency(booking.totalPrice ?? 0)}</Td>
                    <Td align="right">{formatCurrency(totalPaid)}</Td>
                    <Td align="right">{formatCurrency(remaining)}</Td>

                    <Td>
                      <Badge variant={getBookingStatusVariant(booking.status)}>
                        {getBookingStatusLabel(booking.status)}
                      </Badge>
                    </Td>

                    <Td>
                      <Badge variant={paymentStatusVariant}>
                        {paymentStatusLabel}
                      </Badge>
                    </Td>

                    <Td>
                      <div className="flex flex-wrap gap-2">
                        {quickActions.map((a) => (
                          <Button
                            key={a.next}
                            type="button"
                            variant={a.variant ?? "secondary"}
                            className="text-xs px-3 py-1"
                            disabled={isUpdating || a.disabled}
                            onClick={() =>
                              requestStatusChange(booking.id, a.next)
                            }
                          >
                            {isUpdating ? "..." : a.label}
                          </Button>
                        ))}
                      </div>
                    </Td>

                    <Td align="right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-xs px-3 py-1"
                          onClick={() =>
                            navigate(`/reservations/${booking.id}`)
                          }
                        >
                          View
                        </Button>

                        <RoleGate allowed={["admin", "receptionist"]}>
                          <Button
                            type="button"
                            variant="secondary"
                            className="text-xs px-3 py-1"
                            onClick={() =>
                              navigate(`/payments?bookingId=${booking.id}`)
                            }
                          >
                            Payments
                          </Button>
                        </RoleGate>
                      </div>
                    </Td>
                  </tr>
                );
              })}

              {loading && (
                <tr>
                  <td colSpan={11} className="text-center py-6 text-gray-500">
                    Loading...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>

    <ConfirmModal
      open={!!confirm}
      title={confirm?.title ?? ""}
      description={confirm?.description}
      confirmText="Accept"
      cancelText="Cancel"
      loading={!!confirm && updatingId === confirm.bookingId}
      onCancel={() => setConfirm(null)}
      onConfirm={async () => {
        if (!confirm) return;
        const { bookingId, next } = confirm;
        setConfirm(null);
        await updateStatus(bookingId, next);
      }}
    />
  </div>
);
function StatBlock({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="bg-slate-50 border rounded-lg p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-semibold mt-1 text-slate-800">
        {value}
      </p>
    </div>
  );
}
};
function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  const alignClass = align === "right" ? "text-right" : "text-left";

  return (
    <th className={`px-4 py-2 font-medium text-gray-700 ${alignClass}`}>
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  const alignClass = align === "right" ? "text-right" : "text-left";

  return (
    <td className={`px-4 py-2 align-top ${alignClass}`}>
      {children}
    </td>
  );
}
