import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
    } catch (err: any) {
      console.error("Error loading bookings", err);
      setError(
        err?.response?.data?.error ||
          "Hubo un error al cargar las reservas. Intenta nuevamente."
      );
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
      // no lo considero crítico, solo no mostramos resumen de pagos
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
    new Intl.NumberFormat("es-UY", {
      style: "currency",
      currency: "UYU",
      minimumFractionDigits: 0,
    }).format(value);

  const getBookingStatusLabel = (status: string) => {
    const lower = status.toLowerCase();
    if (lower === "pending") return "Pendiente";
    if (lower === "confirmed") return "Confirmada";
    if (lower === "cancelled" || lower === "canceled") return "Cancelada";
    if (lower === "checked_in") return "Check-in realizado";
    if (lower === "checked_out") return "Check-out realizado";
    return status;
  };

  const getBookingStatusVariant = (status: string) => {
    const lower = status.toLowerCase();
    if (lower === "pending") return "warning";
    if (lower === "confirmed") return "info";
    if (lower === "cancelled" || lower === "canceled") return "danger";
    if (lower === "checked_in") return "success";
    if (lower === "checked_out") return "secondary";
    return "secondary";
  };

  // Totales generales (sobre todas las reservas)
  const totalBookings = bookings.length;
  const totalRevenue = bookings.reduce(
    (sum, b) => sum + (b.totalPrice ?? 0),
    0
  );

  const totalPaidAllBookings = payments
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + p.amount, 0);

  // Filtros: por huésped y estado de pago
  const filteredBookings = bookings.filter((booking) => {
    const guestName = booking.guest?.name?.toLowerCase() ?? "";
    const matchesGuest =
      !filterGuest.trim() ||
      guestName.includes(filterGuest.trim().toLowerCase());

    const paymentsForBooking = payments.filter(
      (p) => p.bookingId === booking.id && p.status === "completed"
    );
    const totalPaid = paymentsForBooking.reduce(
      (sum, p) => sum + p.amount,
      0
    );
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
      {/* Header */}
      <PageHeader
        title="Reservas"
        description="Consulta y gestiona todas las reservas del hotel."
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => navigate("/payments")}
            >
              Ir a pagos
            </Button>
            <Button
              type="button"
              onClick={() => navigate("/reservations/new")}
            >
              Nueva reserva
            </Button>
          </div>
        }
      />

      {/* Resumen general */}
      <Card>
        <CardBody>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs text-gray-500">Total de reservas</p>
              <p className="text-lg font-semibold mt-1">{totalBookings}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">
                Importe total de reservas
              </p>
              <p className="text-lg font-semibold mt-1">
                {formatCurrency(totalRevenue)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">
                Total pagado (pagos completados)
              </p>
              <p className="text-lg font-semibold mt-1">
                {loadingPayments
                  ? "Cargando..."
                  : formatCurrency(totalPaidAllBookings)}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Mensajes de estado */}
      {error && (
        <Card>
          <CardBody>
            <div className="bg-red-50 text-red-800 px-4 py-2 rounded text-sm">
              {error}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Filtros */}
      <Card>
        <CardBody>
          <form className="flex flex-wrap gap-4 items-end">
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700">
                Buscar por huésped
              </label>
              <input
                type="text"
                value={filterGuest}
                onChange={(e) => setFilterGuest(e.target.value)}
                className="mt-1 border rounded px-3 py-2 text-sm w-60"
                placeholder="Nombre del huésped"
              />
            </div>

            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700">
                Estado de pago
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
                <option value="">Todos</option>
                <option value="none">Sin pagos</option>
                <option value="partial">Parcialmente pagada</option>
                <option value="full">Totalmente pagada</option>
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
                Limpiar filtros
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {/* Tabla de reservas */}
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
                    Huésped
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">
                    Habitación
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">
                    Fechas
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-gray-700">
                    Total reserva
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-gray-700">
                    Pagado
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-gray-700">
                    Pendiente
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">
                    Estado reserva
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">
                    Estado de pago
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-gray-700">
                    Acciones
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
                        ? "No hay reservas registradas."
                        : "No hay reservas que coincidan con los filtros."}
                    </td>
                  </tr>
                )}

                {filteredBookings.map((booking) => {
                  const paymentsForBooking = payments.filter(
                    (p) =>
                      p.bookingId === booking.id && p.status === "completed"
                  );
                  const totalPaid = paymentsForBooking.reduce(
                    (sum, p) => sum + p.amount,
                    0
                  );
                  const remaining =
                    booking.totalPrice != null
                      ? booking.totalPrice - totalPaid
                      : 0;

                  let paymentStatusLabel = "Sin pagos";
                  let paymentStatusVariant: "success" | "warning" | "danger" =
                    "danger";

                  if (totalPaid <= 0) {
                    paymentStatusLabel = "Sin pagos";
                    paymentStatusVariant = "danger";
                  } else if (remaining > 0) {
                    paymentStatusLabel = "Parcialmente pagada";
                    paymentStatusVariant = "warning";
                  } else {
                    paymentStatusLabel = "Totalmente pagada";
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
                          ? `Hab ${booking.room.number} (piso ${booking.room.floor})`
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
                          onClick={() =>
                            navigate(`/reservations/${booking.id}`)
                          }
                        >
                          Ver detalle
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          className="text-xs px-3 py-1"
                          onClick={() => navigate("/payments")}
                        >
                          Gestionar pagos
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
                      Cargando...
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
