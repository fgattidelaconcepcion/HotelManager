import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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

export default function ReservationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
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

  const getMethodLabel = (method: Payment["method"]) => {
    switch (method) {
      case "cash":
        return "Efectivo";
      case "card":
        return "Tarjeta";
      case "transfer":
        return "Transferencia";
      default:
        return method;
    }
  };

  const getStatusLabel = (status: PaymentStatus) => {
    switch (status) {
      case "pending":
        return "Pendiente";
      case "completed":
        return "Completado";
      case "failed":
        return "Fallido";
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
      setError(
        err?.response?.data?.error ||
          "No se pudo cargar la reserva. Intenta nuevamente."
      );
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
      // no lo tomo como error crítico
    } finally {
      setLoadingPayments(false);
    }
  };

  useEffect(() => {
    if (!id || isNaN(bookingIdNumber)) {
      setError("ID de reserva inválido.");
      setLoading(false);
      return;
    }

    loadBooking();
    loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const totalPaid = payments
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + p.amount, 0);

  const totalPrice = booking?.totalPrice ?? 0;
  const remaining = totalPrice - totalPaid;

  let paymentStatusLabel = "Sin pagos";
  let paymentStatusVariant: "success" | "warning" | "danger" = "danger";

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

  const handleGoBack = () => {
    navigate("/reservations");
  };

  const handleGoToAddPayment = () => {
    if (!booking) return;
    navigate(`/payments?bookingId=${booking.id}`);
  };

  const handleChangeStatus = async (nextStatus: BookingStatus) => {
    if (!booking) return;

    const current = (booking.status || "").toString().toLowerCase() as BookingStatus;

    // Reglas simples de transición
    if (current === "cancelled" || current === "checked_out") {
      alert("Esta reserva ya está finalizada y no puede cambiar de estado.");
      return;
    }

    let actionLabel = "";
    if (nextStatus === "confirmed") actionLabel = "confirmar esta reserva";
    if (nextStatus === "cancelled") actionLabel = "cancelar esta reserva";
    if (nextStatus === "checked_in") actionLabel = "registrar el check-in";
    if (nextStatus === "checked_out") actionLabel = "registrar el check-out";

    const ok = window.confirm(
      `¿Seguro que quieres ${actionLabel}?`
    );
    if (!ok) return;

    try {
      setUpdatingStatus(true);
      setError(null);

      // 👇 AJUSTE IMPORTANTE: usamos /bookings/:id/status
      await api.patch(`/bookings/${booking.id}/status`, {
        status: nextStatus,
      });

      await loadBooking();
    } catch (err: any) {
      console.error("Error updating booking status", err);
      setError(
        err?.response?.data?.error ||
          "No se pudo actualizar el estado de la reserva. Intenta nuevamente."
      );
    } finally {
      setUpdatingStatus(false);
    }
  };

  const renderStatusActions = () => {
    if (!booking) return null;

    const current = (booking.status || "").toString().toLowerCase() as BookingStatus;

    const buttons: JSX.Element[] = [];

    if (current === "pending") {
      buttons.push(
        <Button
          key="confirm"
          type="button"
          variant="secondary"
          className="text-xs px-3 py-1"
          disabled={updatingStatus}
          onClick={() => handleChangeStatus("confirmed")}
        >
          Confirmar
        </Button>
      );
      buttons.push(
        <Button
          key="cancel"
          type="button"
          variant="danger"
          className="text-xs px-3 py-1"
          disabled={updatingStatus}
          onClick={() => handleChangeStatus("cancelled")}
        >
          Cancelar
        </Button>
      );
    } else if (current === "confirmed") {
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
      buttons.push(
        <Button
          key="cancel"
          type="button"
          variant="danger"
          className="text-xs px-3 py-1"
          disabled={updatingStatus}
          onClick={() => handleChangeStatus("cancelled")}
        >
          Cancelar
        </Button>
      );
    } else if (current === "checked_in") {
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

    if (buttons.length === 0) {
      return (
        <p className="text-xs text-gray-500">
          Esta reserva ya está finalizada. No se pueden realizar más cambios de estado.
        </p>
      );
    }

    return (
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-gray-500 mr-1">
          Cambiar estado:
        </span>
        {buttons}
        {updatingStatus && (
          <span className="text-xs text-gray-500">
            Actualizando estado...
          </span>
        )}
      </div>
    );
  };

  if (loading && !booking) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Detalle de reserva"
          description="Cargando información de la reserva..."
        />
        <Card>
          <CardBody>
            <p className="text-sm text-gray-500">Cargando...</p>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Detalle de reserva"
          description="No se pudo cargar la reserva."
          actions={
            <Button type="button" onClick={handleGoBack}>
              Volver a reservas
            </Button>
          }
        />
        <Card>
          <CardBody>
            <div className="bg-red-50 text-red-800 px-4 py-2 rounded text-sm">
              {error || "Reserva no encontrada."}
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Reserva #${booking.id}`}
        description={`Detalle completo de la reserva.`}
        actions={
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={handleGoBack}>
              Volver a reservas
            </Button>
            <Button type="button" onClick={handleGoToAddPayment}>
              Agregar pago
            </Button>
          </div>
        }
      />

      {/* Datos principales de la reserva */}
      <Card>
        <CardBody>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-800">
                Información general
              </h3>
              <p className="text-sm">
                <span className="font-medium text-gray-700">Huésped:</span>{" "}
                {booking.guest?.name || "-"}
              </p>
              <p className="text-sm">
                <span className="font-medium text-gray-700">Email:</span>{" "}
                {booking.guest?.email || "-"}
              </p>
              <p className="text-sm">
                <span className="font-medium text-gray-700">Habitación:</span>{" "}
                {booking.room
                  ? `Hab ${booking.room.number} (piso ${booking.room.floor})`
                  : "-"}
              </p>
              <p className="text-sm">
                <span className="font-medium text-gray-700">
                  Tipo de habitación:
                </span>{" "}
                {booking.room?.roomType?.name || "-"}
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-gray-800">Fechas y estado</h3>
              <p className="text-sm">
                <span className="font-medium text-gray-700">Check-in:</span>{" "}
                {formatDate(booking.checkIn)}
              </p>
              <p className="text-sm">
                <span className="font-medium text-gray-700">Check-out:</span>{" "}
                {formatDate(booking.checkOut)}
              </p>
              <p className="text-sm flex items-center gap-2">
                <span className="font-medium text-gray-700">Estado actual:</span>{" "}
                <Badge variant={getBookingStatusVariant(booking.status as string)}>
                  {getBookingStatusLabel(booking.status as string)}
                </Badge>
              </p>
              <p className="text-xs text-gray-500">
                Creada: {formatDateTime(booking.createdAt)} | Última
                actualización: {formatDateTime(booking.updatedAt)}
              </p>

              {/* Acciones de cambio de estado */}
              <div className="mt-3">{renderStatusActions()}</div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Resumen de pagos */}
      <Card>
        <CardBody>
          <h3 className="font-semibold text-gray-800 mb-3">
            Resumen de pagos
          </h3>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs text-gray-500">Total de la reserva</p>
              <p className="text-lg font-semibold mt-1">
                {formatCurrency(totalPrice)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total pagado</p>
              <p className="text-lg font-semibold mt-1">
                {formatCurrency(totalPaid)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Pendiente</p>
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
              Agregar pago para esta reserva
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Lista de pagos */}
      <Card>
        <CardBody>
          <h3 className="font-semibold text-gray-800 mb-3">
            Pagos asociados
          </h3>

          {loadingPayments && (
            <p className="text-sm text-gray-500 mb-2">Cargando pagos...</p>
          )}

          {payments.length === 0 && !loadingPayments && (
            <p className="text-sm text-gray-500">
              No hay pagos registrados para esta reserva.
            </p>
          )}

          {payments.length > 0 && (
            <div className="overflow-x-auto mt-2">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">
                      ID
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">
                      Monto
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">
                      Método
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">
                      Estado
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">
                      Fecha
                    </th>
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
