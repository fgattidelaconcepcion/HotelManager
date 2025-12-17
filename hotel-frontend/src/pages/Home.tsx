import { useEffect, useState } from "react";
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

interface LatestBooking {
  id: number;
  status: BookingStatus;
  checkIn: string;
  checkOut: string;
  totalPrice: number;
}

interface LatestPayment {
  id: number;
  amount: number;
  status: string;
  createdAt: string;
  bookingId: number;
}

interface DashboardData {
  totalRooms: number;
  occupancyRate: number;
  activeBookingsCount: number;
  totalRevenue: number;
  todaysCheckIns: number;
  todaysCheckOuts: number;
  latestBookings: LatestBooking[];
  latestPayments: LatestPayment[];
  serverNow?: string | null;
  tz?: string | null;
}

function toDate(value: string) {
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export default function Home() {
  const [data, setData] = useState<DashboardData>({
    totalRooms: 0,
    occupancyRate: 0,
    activeBookingsCount: 0,
    totalRevenue: 0,
    todaysCheckIns: 0,
    todaysCheckOuts: 0,
    latestBookings: [],
    latestPayments: [],
    serverNow: null,
    tz: null,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await api.get("/dashboard");
      const payload = res.data?.data ?? res.data;

      setData({
        totalRooms: payload?.totalRooms ?? 0,
        occupancyRate: payload?.occupancyRate ?? 0,
        activeBookingsCount: payload?.activeBookingsCount ?? 0,
        totalRevenue: payload?.totalRevenue ?? 0,
        todaysCheckIns: payload?.todaysCheckIns ?? 0,
        todaysCheckOuts: payload?.todaysCheckOuts ?? 0,
        latestBookings: Array.isArray(payload?.latestBookings)
          ? payload.latestBookings
          : [],
        latestPayments: Array.isArray(payload?.latestPayments)
          ? payload.latestPayments
          : [],
        serverNow: payload?.serverNow ?? null,
        tz: payload?.tz ?? null,
      });
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

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-UY", {
      style: "currency",
      currency: "UYU",
      minimumFractionDigits: 0,
    }).format(value);

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
              {(data.serverNow || data.tz) && (
                <p className="text-xs text-slate-400 mt-2">
                  Server time: {data.serverNow ?? "-"}{" "}
                  {data.tz ? `(TZ: ${data.tz})` : ""}
                </p>
              )}
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
            <p className="text-2xl font-semibold mt-1">{data.totalRooms}</p>
            <p className="text-xs text-slate-400 mt-1">
              Rooms registered in the system.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="text-xs text-slate-500">Current occupancy</p>
            <p className="text-2xl font-semibold mt-1">
              {data.occupancyRate}%
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {data.activeBookingsCount} active reservations.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="text-xs text-slate-500">Payment revenue</p>
            <p className="text-2xl font-semibold mt-1">
              {formatCurrency(data.totalRevenue)}
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
              Check-in: {data.todaysCheckIns} · Check-out: {data.todaysCheckOuts}
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

            {data.latestBookings.length === 0 && (
              <p className="text-sm text-slate-500">
                There are no reservations yet.
              </p>
            )}

            {data.latestBookings.length > 0 && (
              <div className="space-y-2">
                {data.latestBookings.map((b) => (
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

            {data.latestPayments.length === 0 && (
              <p className="text-sm text-slate-500">
                There are no completed payments yet.
              </p>
            )}

            {data.latestPayments.length > 0 && (
              <div className="space-y-2">
                {data.latestPayments.map((p) => (
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
