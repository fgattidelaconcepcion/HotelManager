import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/api";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";

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

/* === Tipos de reservas (para el selector) === */

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

  // Para que sólo se auto-abra una vez desde /payments?bookingId=...
  const [autoOpenedFromBooking, setAutoOpenedFromBooking] = useState(false);

  const loadPayments = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: Record<string, string> = {};
      if (filterBookingId.trim()) {
        params.bookingId = filterBookingId.trim();
      }
      if (filterStatus) {
        params.status = filterStatus;
      }

      const response = await api.get("/payments", { params });
      const data = response.data?.data ?? response.data;
      setPayments(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Error loading payments", err);
      setError(
        err?.response?.data?.error ||
          "Hubo un error al cargar los pagos. Intenta nuevamente."
      );
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
      // No lo tomo como error crítico, solo deja el selector vacío
    } finally {
      setLoadingBookings(false);
    }
  };

  useEffect(() => {
    loadPayments();
    loadBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-abrir modal si venimos desde /payments?bookingId=...
  useEffect(() => {
    const bookingIdParam = searchParams.get("bookingId");
    if (!bookingIdParam) return;
    if (autoOpenedFromBooking) return;

    const bookingIdNum = Number(bookingIdParam);
    if (!bookingIdNum || Number.isNaN(bookingIdNum)) return;

    // Esperar a tener las reservas cargadas
    if (loadingBookings) return;

    const exists = bookings.some((b) => b.id === bookingIdNum);
    if (!exists) return;

    setForm((prev) => ({
      ...prev,
      bookingId: String(bookingIdNum),
    }));
    setIsEditing(false);
    setShowModal(true);
    setAutoOpenedFromBooking(true);
  }, [searchParams, bookings, loadingBookings, autoOpenedFromBooking]);

  const handleOpenCreate = () => {
    setIsEditing(false);
    setForm(emptyForm);
    setShowModal(true);
  };

  const handleOpenEdit = (payment: Payment) => {
    setIsEditing(true);
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
  };

  const handleChange = (
    field: keyof PaymentFormState,
    value: string | PaymentMethod | PaymentStatus
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const validateForm = () => {
    if (!form.bookingId.trim()) {
      setError("La reserva es obligatoria.");
      return false;
    }

    const bookingIdNum = Number(form.bookingId);
    if (isNaN(bookingIdNum)) {
      setError("El ID de reserva debe ser un número válido.");
      return false;
    }

    const bookingExists = bookings.some((b) => b.id === bookingIdNum);
    if (!bookingExists) {
      setError("La reserva seleccionada no existe.");
      return false;
    }

    if (!form.amount.trim()) {
      setError("El monto es obligatorio.");
      return false;
    }
    const amountNumber = Number(form.amount);
    if (isNaN(amountNumber) || amountNumber <= 0) {
      setError("El monto debe ser un número mayor que 0.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) return;

    const payload = {
      bookingId: Number(form.bookingId),
      amount: Number(form.amount),
      method: form.method,
      status: form.status,
    };

    try {
      setLoading(true);

      if (isEditing && form.id != null) {
        await api.put(`/payments/${form.id}`, payload);
      } else {
        await api.post("/payments", payload);
      }

      await loadPayments();
      handleCloseModal();
    } catch (err: any) {
      console.error("Error saving payment", err);
      setError(
        err?.response?.data?.error ||
          "No se pudo guardar el pago. Revisa los datos e intenta nuevamente."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (payment: Payment) => {
    const ok = window.confirm(
      `¿Seguro que quieres eliminar el pago #${payment.id} (reserva #${payment.bookingId})?`
    );
    if (!ok) return;

    try {
      setLoading(true);
      setError(null);

      await api.delete(`/payments/${payment.id}`);
      await loadPayments();
    } catch (err: any) {
      console.error("Error deleting payment", err);
      setError(
        err?.response?.data?.error ||
          "No se pudo eliminar el pago. Intenta nuevamente."
      );
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
    loadPayments();
  };

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

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("es-UY", {
      style: "currency",
      currency: "UYU",
      minimumFractionDigits: 0,
    }).format(value);

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

  const getMethodLabel = (method: PaymentMethod) => {
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

  // === Totales generales de pagos ===
  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalByStatus: Record<PaymentStatus, number> = {
    pending: payments
      .filter((p) => p.status === "pending")
      .reduce((s, p) => s + p.amount, 0),
    completed: payments
      .filter((p) => p.status === "completed")
      .reduce((s, p) => s + p.amount, 0),
    failed: payments
      .filter((p) => p.status === "failed")
      .reduce((s, p) => s + p.amount, 0),
  };

  // === Info de la reserva seleccionada en el modal ===
  const selectedBookingId = form.bookingId ? Number(form.bookingId) : null;
  const selectedBooking = selectedBookingId
    ? bookings.find((b) => b.id === selectedBookingId) || null
    : null;

  const totalPaidForSelected = selectedBooking
    ? payments
        .filter(
          (p) =>
            p.bookingId === selectedBooking.id && p.status === "completed"
        )
        .reduce((sum, p) => sum + p.amount, 0)
    : 0;

  const remainingForSelected =
    selectedBooking && selectedBooking.totalPrice != null
      ? selectedBooking.totalPrice - totalPaidForSelected
      : 0;

  const isBookingFullyPaid =
    !!selectedBooking && remainingForSelected <= 0;

  const handleFillRemainingAmount = () => {
    if (!selectedBooking) return;
    if (remainingForSelected <= 0) return;

    setForm((prev) => ({
      ...prev,
      amount: String(remainingForSelected),
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Pagos"
        description="Gestiona los pagos asociados a las reservas."
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => navigate("/reservations/new")}
            >
              Nueva reserva
            </Button>
            <Button type="button" onClick={handleOpenCreate}>
              Nuevo pago
            </Button>
          </div>
        }
      />

      {/* Resumen de totales */}
      <Card>
        <CardBody>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-xs text-gray-500">Total de pagos</p>
              <p className="text-lg font-semibold mt-1">
                {formatCurrency(totalAmount)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Completados</p>
              <p className="text-lg font-semibold mt-1">
                {formatCurrency(totalByStatus.completed)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Pendientes</p>
              <p className="text-lg font-semibold mt-1">
                {formatCurrency(totalByStatus.pending)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Fallidos</p>
              <p className="text-lg font-semibold mt-1">
                {formatCurrency(totalByStatus.failed)}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Filtros */}
      <Card>
        <CardBody>
          <form
            onSubmit={handleApplyFilters}
            className="flex flex-wrap gap-4 items-end"
          >
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700">
                ID de reserva
              </label>
              <input
                type="text"
                value={filterBookingId}
                onChange={(e) => setFilterBookingId(e.target.value)}
                className="mt-1 border rounded px-3 py-2 text-sm w-40"
                placeholder="Ej: 1"
              />
            </div>

            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700">
                Estado
              </label>
              <select
                value={filterStatus}
                onChange={(e) =>
                  setFilterStatus(e.target.value as "" | PaymentStatus)
                }
                className="mt-1 border rounded px-3 py-2 text-sm w-44"
              >
                <option value="">Todos</option>
                <option value="pending">Pendiente</option>
                <option value="completed">Completado</option>
                <option value="failed">Fallido</option>
              </select>
            </div>

            <div className="flex gap-2">
              <Button type="submit" variant="secondary">
                Aplicar filtros
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={handleClearFilters}
              >
                Limpiar
              </Button>
            </div>
          </form>
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

      {/* Tabla de pagos */}
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
                    Reserva
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">
                    Huésped
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">
                    Habitación
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-gray-700">
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
                  <th className="px-4 py-2 text-right font-medium text-gray-700">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-6 text-center text-gray-500"
                    >
                      No hay pagos registrados.
                    </td>
                  </tr>
                )}

                {payments.map((payment) => (
                  <tr key={payment.id} className="border-t last:border-b">
                    <td className="px-4 py-2 align-top">{payment.id}</td>
                    <td className="px-4 py-2 align-top">
                      #{payment.bookingId}
                    </td>
                    <td className="px-4 py-2 align-top">
                      {payment.booking?.guest?.name || "-"}
                    </td>
                    <td className="px-4 py-2 align-top">
                      {payment.booking?.room
                        ? `Hab ${payment.booking.room.number} (piso ${payment.booking.room.floor})`
                        : "-"}
                    </td>
                    <td className="px-4 py-2 align-top text-right">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="px-4 py-2 align-top">
                      {getMethodLabel(payment.method)}
                    </td>
                    <td className="px-4 py-2 align-top">
                      <Badge
                        variant={
                          payment.status === "completed"
                            ? "success"
                            : payment.status === "pending"
                            ? "warning"
                            : "danger"
                        }
                      >
                        {getStatusLabel(payment.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 align-top">
                      {formatDateTime(payment.createdAt)}
                    </td>
                    <td className="px-4 py-2 align-top text-right space-x-2">
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-xs px-3 py-1"
                        onClick={() => handleOpenEdit(payment)}
                      >
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        className="text-xs px-3 py-1"
                        onClick={() => handleDelete(payment)}
                      >
                        Eliminar
                      </Button>
                    </td>
                  </tr>
                ))}

                {loading && (
                  <tr>
                    <td
                      colSpan={9}
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

      {/* Modal crear/editar pago */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardBody>
              <h3 className="text-lg font-semibold mb-4">
                {isEditing ? "Editar pago" : "Nuevo pago"}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Selector de reserva */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Reserva
                  </label>
                  <select
                    value={form.bookingId}
                    onChange={(e) =>
                      handleChange("bookingId", e.target.value)
                    }
                    className="mt-1 w-full border rounded px-3 py-2 text-sm"
                    disabled={loadingBookings}
                  >
                    <option value="">
                      {loadingBookings
                        ? "Cargando reservas..."
                        : "Selecciona una reserva"}
                    </option>
                    {bookings.map((b) => (
                      <option key={b.id} value={b.id}>
                        #{b.id} -{" "}
                        {b.room
                          ? `Hab ${b.room.number} (piso ${b.room.floor})`
                          : "Sin habitación"}{" "}
                        - {b.guest?.name ?? "Sin huésped"} -{" "}
                        {formatDate(b.checkIn)} → {formatDate(b.checkOut)}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Debe existir una reserva con este ID.
                  </p>

                  {/* Acciones rápidas: nueva reserva, huésped, habitación */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-xs px-2 py-1"
                      onClick={() => navigate("/reservations/new")}
                    >
                      Nueva reserva
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-xs px-2 py-1"
                      onClick={() => navigate("/guests/new")}
                    >
                      Nuevo huésped
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-xs px-2 py-1"
                      onClick={() => navigate("/rooms/new")}
                    >
                      Nueva habitación
                    </Button>
                  </div>

                  {selectedBooking && (
                    <div className="mt-2 text-xs text-gray-600 space-y-1 border rounded p-2 bg-gray-50">
                      <p>
                        <span className="font-semibold">Total reserva:</span>{" "}
                        {formatCurrency(selectedBooking.totalPrice)}
                      </p>
                      <p>
                        <span className="font-semibold">Total pagado:</span>{" "}
                        {formatCurrency(totalPaidForSelected)}
                      </p>
                      <p>
                        <span className="font-semibold">Pendiente:</span>{" "}
                        {formatCurrency(remainingForSelected)}
                      </p>
                      <p>
                        <span className="font-semibold">Estado:</span>{" "}
                        {isBookingFullyPaid
                          ? "✅ Completamente pagada"
                          : "🟡 Con saldo pendiente"}
                      </p>

                      {!isBookingFullyPaid && remainingForSelected > 0 && (
                        <div className="pt-2">
                          <Button
                            type="button"
                            variant="secondary"
                            className="text-xs px-2 py-1"
                            onClick={handleFillRemainingAmount}
                          >
                            Usar saldo pendiente como monto
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {!isEditing && isBookingFullyPaid && (
                    <p className="mt-2 text-xs text-red-600">
                      Esta reserva ya está completamente pagada. No puedes
                      registrar más pagos completados.
                    </p>
                  )}
                </div>

                {/* Monto */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Monto
                  </label>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) => handleChange("amount", e.target.value)}
                    className="mt-1 w-full border rounded px-3 py-2 text-sm"
                    placeholder="Ej: 1200"
                    min={0}
                    step={1}
                  />
                </div>

                {/* Método + Estado */}
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Método de pago
                    </label>
                    <select
                      value={form.method}
                      onChange={(e) =>
                        handleChange(
                          "method",
                          e.target.value as PaymentMethod
                        )
                      }
                      className="mt-1 w-full border rounded px-3 py-2 text-sm"
                    >
                      <option value="cash">Efectivo</option>
                      <option value="card">Tarjeta</option>
                      <option value="transfer">Transferencia</option>
                    </select>
                  </div>

                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Estado
                    </label>
                    <select
                      value={form.status}
                      onChange={(e) =>
                        handleChange(
                          "status",
                          e.target.value as PaymentStatus
                        )
                      }
                      className="mt-1 w-full border rounded px-3 py-2 text-sm"
                    >
                      <option value="pending">Pendiente</option>
                      <option value="completed">Completado</option>
                      <option value="failed">Fallido</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleCloseModal}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading || (!isEditing && isBookingFullyPaid)}
                  >
                    {isEditing ? "Guardar cambios" : "Crear pago"}
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
