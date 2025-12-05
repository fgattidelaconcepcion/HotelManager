import { useEffect, useMemo, useState } from "react";
import api from "../api/api";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";

type BookingStatus =
  | "pending"
  | "confirmed"
  | "checked_in"
  | "checked_out"
  | "cancelled"
  | string;

interface Guest {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
}

interface RoomType {
  id: number;
  name: string;
  basePrice?: number | null;
}

interface Room {
  id: number;
  number: string;
  floor: number;
  roomType?: RoomType | null;
}

export interface Booking {
  id: number;
  guest?: Guest | null;
  room?: Room | null;
  checkIn: string;
  checkOut: string;
  totalPrice: number;
  status: BookingStatus;
  createdAt?: string;
  updatedAt?: string;
}

export default function Reservations() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // filtros en front (no tocan el backend)
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | BookingStatus>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

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

  useEffect(() => {
    loadBookings();
  }, []);

  // helpers
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

  const getStatusLabel = (status: BookingStatus) => {
    switch (status) {
      case "pending":
        return "Pendiente";
      case "confirmed":
        return "Confirmada";
      case "checked_in":
        return "Check-in";
      case "checked_out":
        return "Check-out";
      case "cancelled":
        return "Cancelada";
      default:
        return status;
    }
  };

  const getStatusVariant = (status: BookingStatus) => {
    switch (status) {
      case "confirmed":
      case "checked_in":
      case "checked_out":
        return "success" as const;
      case "pending":
        return "warning" as const;
      case "cancelled":
        return "danger" as const;
      default:
        return "default" as const;
    }
  };

  // aplicar filtros en memoria
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      let ok = true;

      if (searchText.trim()) {
        const text = searchText.toLowerCase();
        const guestName = b.guest?.name?.toLowerCase() || "";
        const roomNumber = b.room?.number?.toLowerCase() || "";
        ok =
          ok &&
          (guestName.includes(text) ||
            roomNumber.includes(text) ||
            String(b.id).includes(text));
      }

      if (statusFilter) {
        ok = ok && b.status === statusFilter;
      }

      if (dateFrom) {
        const from = new Date(dateFrom);
        const checkIn = new Date(b.checkIn);
        ok = ok && checkIn >= from;
      }

      if (dateTo) {
        const to = new Date(dateTo);
        const checkOut = new Date(b.checkOut);
        ok = ok && checkOut <= to;
      }

      return ok;
    });
  }, [bookings, searchText, statusFilter, dateFrom, dateTo]);

  // totales rápido
  const totalReservations = bookings.length;
  const totalConfirmed = bookings.filter((b) => b.status === "confirmed").length;
  const totalPending = bookings.filter((b) => b.status === "pending").length;
  const totalCancelled = bookings.filter((b) => b.status === "cancelled").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Reservas"
        description="Gestiona las reservas del hotel."
        actions={
          // Más adelante podemos abrir un modal para crear reserva
          <Button disabled className="opacity-70 cursor-not-allowed">
            Nueva reserva (pronto)
          </Button>
        }
      />

      {/* Resumen */}
      <Card>
        <CardBody>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-xs text-slate-500">Total de reservas</p>
              <p className="text-lg font-semibold mt-1">
                {totalReservations}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Confirmadas</p>
              <p className="text-lg font-semibold mt-1">
                {totalConfirmed}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Pendientes</p>
              <p className="text-lg font-semibold mt-1">
                {totalPending}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Canceladas</p>
              <p className="text-lg font-semibold mt-1">
                {totalCancelled}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Filtros */}
      <Card>
        <CardBody>
          <form className="flex flex-wrap gap-4 items-end">
            <div className="flex flex-col">
              <label className="text-sm font-medium text-slate-700">
                Buscar
              </label>
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="mt-1 border rounded px-3 py-2 text-sm w-56"
                placeholder="ID, huésped o habitación"
              />
            </div>

            <div className="flex flex-col">
              <label className="text-sm font-medium text-slate-700">
                Estado
              </label>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as "" | BookingStatus)
                }
                className="mt-1 border rounded px-3 py-2 text-sm w-44"
              >
                <option value="">Todos</option>
                <option value="pending">Pendiente</option>
                <option value="confirmed">Confirmada</option>
                <option value="checked_in">Check-in</option>
                <option value="checked_out">Check-out</option>
                <option value="cancelled">Cancelada</option>
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-sm font-medium text-slate-700">
                Desde
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="mt-1 border rounded px-3 py-2 text-sm"
              />
            </div>

            <div className="flex flex-col">
              <label className="text-sm font-medium text-slate-700">
                Hasta
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="mt-1 border rounded px-3 py-2 text-sm"
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => loadBookings()}
              >
                Refrescar
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setSearchText("");
                  setStatusFilter("");
                  setDateFrom("");
                  setDateTo("");
                }}
              >
                Limpiar filtros
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

      {/* Tabla de reservas */}
      <Card>
        <CardBody>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">
                    ID
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">
                    Huésped
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">
                    Habitación
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">
                    Fechas
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-slate-700">
                    Total
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">
                    Estado
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-slate-700">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-6 text-center text-slate-500"
                    >
                      No hay reservas que coincidan con los filtros.
                    </td>
                  </tr>
                )}

                {filteredBookings.map((b) => (
                  <tr key={b.id} className="border-t last:border-b">
                    <td className="px-4 py-2 align-top">{b.id}</td>
                    <td className="px-4 py-2 align-top">
                      <div className="flex flex-col">
                        <span>{b.guest?.name ?? "-"}</span>
                        {b.guest?.email && (
                          <span className="text-xs text-slate-500">
                            {b.guest.email}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 align-top">
                      {b.room
                        ? `Hab ${b.room.number} (piso ${b.room.floor})${
                            b.room.roomType
                              ? ` · ${b.room.roomType.name}`
                              : ""
                          }`
                        : "-"}
                    </td>
                    <td className="px-4 py-2 align-top">
                      {formatDate(b.checkIn)} → {formatDate(b.checkOut)}
                    </td>
                    <td className="px-4 py-2 align-top text-right">
                      {formatCurrency(b.totalPrice)}
                    </td>
                    <td className="px-4 py-2 align-top">
                      <Badge variant={getStatusVariant(b.status)}>
                        {getStatusLabel(b.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 align-top text-right space-x-2">
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-xs px-3 py-1"
                        disabled
                      >
                        Ver
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-xs px-3 py-1"
                        disabled
                      >
                        Editar
                      </Button>
                    </td>
                  </tr>
                ))}

                {loading && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-4 text-center text-slate-500"
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
