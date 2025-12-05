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

interface Room {
  id: number;
  number: string;
  floor: number;
}

interface Booking {
  id: number;
  status: BookingStatus;
  checkIn: string;
  checkOut: string;
  totalPrice: number;
}

interface Payment {
  id: number;
  amount: number;
  status: "pending" | "completed" | "failed" | string;
  createdAt: string;
}

export default function Home() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [roomsRes, bookingsRes, paymentsRes] = await Promise.all([
        api.get("/rooms"),
        api.get("/bookings"),
        api.get("/payments"),
      ]);

      const roomsData = roomsRes.data?.data ?? roomsRes.data;
      const bookingsData = bookingsRes.data?.data ?? bookingsRes.data;
      const paymentsData = paymentsRes.data?.data ?? paymentsRes.data;

      setRooms(Array.isArray(roomsData) ? roomsData : []);
      setBookings(Array.isArray(bookingsData) ? bookingsData : []);
      setPayments(Array.isArray(paymentsData) ? paymentsData : []);
    } catch (err: any) {
      console.error("Error loading dashboard data", err);
      setError(
        err?.response?.data?.error ||
          "Hubo un error al cargar el dashboard. Intenta nuevamente."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const today = useMemo(() => new Date(), []);
  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  // KPIs
  const totalRooms = rooms.length;

  const activeBookings = bookings.filter((b) =>
    ["confirmed", "checked_in"].includes(b.status)
  );

  const todaysCheckIns = bookings.filter((b) =>
    isSameDay(new Date(b.checkIn), today)
  );
  const todaysCheckOuts = bookings.filter((b) =>
    isSameDay(new Date(b.checkOut), today)
  );

  const completedPayments = payments.filter((p) => p.status === "completed");
  const totalRevenue = completedPayments.reduce(
    (sum, p) => sum + p.amount,
    0
  );

  const occupancyRate =
    totalRooms > 0 ? Math.round((activeBookings.length / totalRooms) * 100) : 0;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("es-UY", {
      style: "currency",
      currency: "UYU",
      minimumFractionDigits: 0,
    }).format(value);

  const latestBookings = [...bookings]
    .sort(
      (a, b) => new Date(b.checkIn).getTime() - new Date(a.checkIn).getTime()
    )
    .slice(0, 5);

  const latestPayments = [...completedPayments]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Dashboard"
        description="Resumen general del hotel."
        actions={
          <Button variant="secondary" onClick={loadData} disabled={loading}>
            {loading ? "Actualizando..." : "Refrescar datos"}
          </Button>
        }
      />

      {/* Bienvenida */}
      <Card>
        <CardBody>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Bienvenido al panel del Hotel
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Acá puedes ver un resumen rápido de ocupación, reservas y
                ingresos.
              </p>
            </div>
            <div className="flex gap-2">
              <Badge variant="success">Producción demo</Badge>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* KPIs principales */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardBody>
            <p className="text-xs text-slate-500">Habitaciones totales</p>
            <p className="text-2xl font-semibold mt-1">{totalRooms}</p>
            <p className="text-xs text-slate-400 mt-1">
              Habitaciones registradas en el sistema.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="text-xs text-slate-500">Ocupación actual</p>
            <p className="text-2xl font-semibold mt-1">
              {occupancyRate}%
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {activeBookings.length} reservas activas.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="text-xs text-slate-500">Ingresos por pagos</p>
            <p className="text-2xl font-semibold mt-1">
              {formatCurrency(totalRevenue)}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Total de pagos completados.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="text-xs text-slate-500">Hoy</p>
            <p className="text-base font-semibold mt-1">
              Check-in: {todaysCheckIns.length} · Check-out:{" "}
              {todaysCheckOuts.length}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Movimientos programados para hoy.
            </p>
          </CardBody>
        </Card>
      </div>

      {/* Listas rápidas: últimas reservas y pagos */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Últimas reservas */}
        <Card>
          <CardBody>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800">
                Últimas reservas
              </h3>
            </div>

            {latestBookings.length === 0 && (
              <p className="text-sm text-slate-500">
                Aún no hay reservas registradas.
              </p>
            )}

            {latestBookings.length > 0 && (
              <div className="space-y-2">
                {latestBookings.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 bg-white"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        Reserva #{b.id}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(b.checkIn).toLocaleDateString()} →{" "}
                        {new Date(b.checkOut).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge
                      variant={
                        b.status === "confirmed" || b.status === "checked_in"
                          ? "success"
                          : b.status === "pending"
                          ? "warning"
                          : "danger"
                      }
                    >
                      {b.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Últimos pagos */}
        <Card>
          <CardBody>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800">
                Últimos pagos
              </h3>
            </div>

            {latestPayments.length === 0 && (
              <p className="text-sm text-slate-500">
                Aún no hay pagos completados.
              </p>
            )}

            {latestPayments.length > 0 && (
              <div className="space-y-2">
                {latestPayments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 bg-white"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        Pago #{p.id}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(p.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <p className="text-sm font-semibold">
                      {formatCurrency(p.amount)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Error */}
      {error && (
        <Card>
          <CardBody>
            <div className="bg-red-50 text-red-800 px-4 py-2 rounded text-sm">
              {error}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
