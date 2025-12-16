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

function toDate(value: string) {
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function startOfLocalDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfLocalDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function isWithinLocalDay(dateStr: string, day: Date) {
  const d = toDate(dateStr);
  if (!d) return false;
  const start = startOfLocalDay(day);
  const end = endOfLocalDay(day);
  return d >= start && d <= end;
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
          "There was an error loading the dashboard. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // ✅ No lo “congelamos”: cada render toma el día actual del usuario
  const today = useMemo(() => new Date(), []);

  // KPIs
  const totalRooms = rooms.length;

  const activeBookings = bookings.filter((b) =>
    ["confirmed", "checked_in"].includes(b.status)
  );

  // ✅ Check-ins / check-outs “de hoy” por rango local (evita bug UTC/Z)
  // ✅ Y además: sólo cuenta reservas activas (confirmed/checked_in/checked_out)
  const todaysCheckIns = bookings.filter(
    (b) =>
      ["confirmed", "checked_in", "checked_out"].includes(b.status) &&
      isWithinLocalDay(b.checkIn, today)
  );

  const todaysCheckOuts = bookings.filter(
    (b) =>
      ["confirmed", "checked_in", "checked_out"].includes(b.status) &&
      isWithinLocalDay(b.checkOut, today)
  );

  const completedPayments = payments.filter((p) => p.status === "completed");
  const totalRevenue = completedPayments.reduce((sum, p) => sum + p.amount, 0);

  const occupancyRate =
    totalRooms > 0 ? Math.round((activeBookings.length / totalRooms) * 100) : 0;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-UY", {
      style: "currency",
      currency: "UYU",
      minimumFractionDigits: 0,
    }).format(value);

  const latestBookings = [...bookings]
    .sort((a, b) => {
      const aD = toDate(a.checkIn)?.getTime() ?? 0;
      const bD = toDate(b.checkIn)?.getTime() ?? 0;
      return bD - aD;
    })
    .slice(0, 5);

  const latestPayments = [...completedPayments]
    .sort((a, b) => {
      const aD = toDate(a.createdAt)?.getTime() ?? 0;
      const bD = toDate(b.createdAt)?.getTime() ?? 0;
      return bD - aD;
    })
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overall hotel summary."
        actions={
          <Button variant="secondary" onClick={loadData} disabled={loading}>
            {loading ? "Updating..." : "Refresh data"}
          </Button>
        }
      />

      <Card>
        <CardBody>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Welcome to the Hotel Dashboard
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Here you can see a quick summary of occupancy, reservations and
                revenue.
              </p>
            </div>
            <div className="flex gap-2">
              <Badge variant="success">Demo production</Badge>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardBody>
            <p className="text-xs text-slate-500">Total rooms</p>
            <p className="text-2xl font-semibold mt-1">{totalRooms}</p>
            <p className="text-xs text-slate-400 mt-1">
              Rooms registered in the system.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="text-xs text-slate-500">Current occupancy</p>
            <p className="text-2xl font-semibold mt-1">{occupancyRate}%</p>
            <p className="text-xs text-slate-400 mt-1">
              {activeBookings.length} active reservations.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="text-xs text-slate-500">Payment revenue</p>
            <p className="text-2xl font-semibold mt-1">
              {formatCurrency(totalRevenue)}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Total completed payments.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="text-xs text-slate-500">Today</p>
            <p className="text-base font-semibold mt-1">
              Check-in: {todaysCheckIns.length} · Check-out:{" "}
              {todaysCheckOuts.length}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Scheduled activity for today.
            </p>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardBody>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800">
                Latest reservations
              </h3>
            </div>

            {latestBookings.length === 0 && (
              <p className="text-sm text-slate-500">
                There are no reservations yet.
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
                        Reservation #{b.id}
                      </p>
                      <p className="text-xs text-slate-500">
                        {toDate(b.checkIn)?.toLocaleDateString() ?? "-"} →{" "}
                        {toDate(b.checkOut)?.toLocaleDateString() ?? "-"}
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

        <Card>
          <CardBody>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800">
                Latest payments
              </h3>
            </div>

            {latestPayments.length === 0 && (
              <p className="text-sm text-slate-500">
                There are no completed payments yet.
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
                        Payment #{p.id}
                      </p>
                      <p className="text-xs text-slate-500">
                        {toDate(p.createdAt)?.toLocaleString() ?? "-"}
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

