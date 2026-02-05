import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  createdAt?: string;
  room?: { id: number; number: string; floor: number } | null;
  guest?: { id: number; name: string; email?: string | null } | null;
}

interface LatestPayment {
  id: number;
  amount: number;
  status: string;
  createdAt: string;
  bookingId: number;
}

type SeriesPoint = { date: string; value: number };

interface DashboardData {
  // old fields (keep)
  totalRooms: number;
  occupancyRate: number;
  activeBookingsCount: number;
  totalRevenue: number;
  todaysCheckIns: number;
  todaysCheckOuts: number;
  latestBookings: LatestBooking[];
  latestPayments: LatestPayment[];

  // old debug
  serverNow?: string | null;
  tz?: string | null;

  // new fields (optional)
  maintenanceRooms?: number;
  availableRooms?: number;
  occupiedRoomsToday?: number;
  pendingBookingsCount?: number;
  pendingPaymentsCount?: number;
  rangeDays?: number;
  revenueSeries?: SeriesPoint[];
  occupiedRoomsSeries?: SeriesPoint[];
  occupancyRateSeries?: SeriesPoint[];
  tzOffsetMinutes?: number;
}

function toDate(value: string) {
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export default function Home() {
  const navigate = useNavigate();

  const [rangeDays, setRangeDays] = useState<7 | 30>(7);

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

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-UY", {
      style: "currency",
      currency: "UYU",
      minimumFractionDigits: 0,
    }).format(value);

  const getBookingStatusVariant = (status: string) => {
    const lower = status.toLowerCase();
    if (lower === "pending") return "warning";
    if (lower === "confirmed") return "default";
    if (lower === "checked_in") return "success";
    if (lower === "checked_out") return "default";
    return "danger";
  };

  const loadData = async (opts?: { silent?: boolean }) => {
    const silent = !!opts?.silent;

    try {
      if (!silent) setLoading(true);
      setError(null);

      const res = await api.get("/dashboard", {
        params: { range: rangeDays },
      });

      const payload = res.data?.data ?? res.data;

      // Merge safely: support old + new API shapes
      setData((prev) => ({
        ...prev,
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

        // debug
        serverNow: payload?.serverNow ?? null,
        tz: payload?.tz ?? null,
        tzOffsetMinutes:
          typeof payload?.tzOffsetMinutes === "number"
            ? payload.tzOffsetMinutes
            : prev.tzOffsetMinutes,

        // new fields
        maintenanceRooms:
          typeof payload?.maintenanceRooms === "number"
            ? payload.maintenanceRooms
            : prev.maintenanceRooms,
        availableRooms:
          typeof payload?.availableRooms === "number"
            ? payload.availableRooms
            : prev.availableRooms,
        occupiedRoomsToday:
          typeof payload?.occupiedRoomsToday === "number"
            ? payload.occupiedRoomsToday
            : prev.occupiedRoomsToday,
        pendingBookingsCount:
          typeof payload?.pendingBookingsCount === "number"
            ? payload.pendingBookingsCount
            : prev.pendingBookingsCount,
        pendingPaymentsCount:
          typeof payload?.pendingPaymentsCount === "number"
            ? payload.pendingPaymentsCount
            : prev.pendingPaymentsCount,

        rangeDays:
          typeof payload?.rangeDays === "number"
            ? payload.rangeDays
            : prev.rangeDays,

        revenueSeries: Array.isArray(payload?.revenueSeries)
          ? payload.revenueSeries
          : prev.revenueSeries,
        occupiedRoomsSeries: Array.isArray(payload?.occupiedRoomsSeries)
          ? payload.occupiedRoomsSeries
          : prev.occupiedRoomsSeries,
        occupancyRateSeries: Array.isArray(payload?.occupancyRateSeries)
          ? payload.occupancyRateSeries
          : prev.occupancyRateSeries,
      }));
    } catch (err: any) {
      console.error("Error loading dashboard data", err);
      setError(
        err?.response?.data?.error ||
          "There was an error loading the dashboard. Please try again."
      );
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // refresh when range changes
    loadData({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeDays]);

  // ===== Mini chart values (no libs) =====
  const revenueSeries = data.revenueSeries ?? [];
  const maxRevenue = useMemo(() => {
    if (!revenueSeries.length) return 0;
    return revenueSeries.reduce((m, p) => Math.max(m, p.value), 0);
  }, [revenueSeries]);

  const totalRoomsLabel = data.totalRooms ?? 0;
  const availableRoomsLabel =
    typeof data.availableRooms === "number" ? data.availableRooms : null;
  const maintenanceRoomsLabel =
    typeof data.maintenanceRooms === "number" ? data.maintenanceRooms : null;

  const occupiedRoomsTodayLabel =
    typeof data.occupiedRoomsToday === "number"
      ? data.occupiedRoomsToday
      : data.activeBookingsCount; // fallback

  const pendingBookings = data.pendingBookingsCount ?? null;
  const pendingPayments = data.pendingPaymentsCount ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overall hotel summary."
        actions={
          <div className="flex gap-2 items-center">
            {/* Range selector */}
            <select
              value={rangeDays}
              onChange={(e) => setRangeDays(Number(e.target.value) as 7 | 30)}
              className="border rounded px-3 py-2 text-sm bg-white"
              disabled={loading}
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
            </select>

            <Button variant="secondary" onClick={() => loadData()} disabled={loading}>
              {loading ? "Updating..." : "Refresh"}
            </Button>
          </div>
        }
      />

      {/* Welcome / info */}
      <Card>
        <CardBody>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Welcome to the Hotel Dashboard
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Occupancy, activity and revenue at a glance.
              </p>

              {(data.serverNow || data.tz || data.tzOffsetMinutes != null) && (
                <p className="text-xs text-slate-400 mt-2">
                  Server time: {data.serverNow ?? "-"}{" "}
                  {data.tz ? `(TZ: ${data.tz})` : ""}
                  {data.tzOffsetMinutes != null ? ` (offset: ${data.tzOffsetMinutes}m)` : ""}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Badge variant="success">Demo production</Badge>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardBody>
            <p className="text-xs text-slate-500">Rooms</p>
            <p className="text-2xl font-semibold mt-1">{totalRoomsLabel}</p>
            <p className="text-xs text-slate-400 mt-1">
              {availableRoomsLabel != null && maintenanceRoomsLabel != null
                ? `${availableRoomsLabel} available · ${maintenanceRoomsLabel} in maintenance`
                : "Rooms registered in the system."}
            </p>
            <div className="mt-3">
              <Button
                type="button"
                variant="ghost"
                className="text-xs px-2 py-1"
                onClick={() => navigate("/rooms")}
              >
                Manage rooms →
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="text-xs text-slate-500">Occupancy today</p>
            <p className="text-2xl font-semibold mt-1">{data.occupancyRate}%</p>
            <p className="text-xs text-slate-400 mt-1">
              {occupiedRoomsTodayLabel} occupied.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="text-xs text-slate-500">Revenue (completed)</p>
            <p className="text-2xl font-semibold mt-1">
              {formatCurrency(data.totalRevenue)}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Total completed payments (all time).
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="text-xs text-slate-500">Today activity</p>
            <p className="text-base font-semibold mt-1">
              Check-in: {data.todaysCheckIns} · Check-out: {data.todaysCheckOuts}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Scheduled arrivals and departures.
            </p>
          </CardBody>
        </Card>
      </div>

      {/* Alerts */}
      {(pendingBookings != null ||
        pendingPayments != null ||
        maintenanceRoomsLabel != null) && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardBody>
              <p className="text-xs text-slate-500">Pending reservations</p>
              <p className="text-2xl font-semibold mt-1">{pendingBookings ?? "-"}</p>
              <p className="text-xs text-slate-400 mt-1">
                Reservations that may need confirmation.
              </p>
              <div className="mt-3">
                <Button
                  type="button"
                  variant="secondary"
                  className="text-xs px-3 py-1"
                  onClick={() => navigate("/reservations")}
                >
                  Go to reservations →
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <p className="text-xs text-slate-500">Pending payments</p>
              <p className="text-2xl font-semibold mt-1">{pendingPayments ?? "-"}</p>
              <p className="text-xs text-slate-400 mt-1">
                Payments marked as pending.
              </p>
              <div className="mt-3">
                <Button
                  type="button"
                  variant="secondary"
                  className="text-xs px-3 py-1"
                  onClick={() => navigate("/payments")}
                >
                  Go to payments →
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <p className="text-xs text-slate-500">Maintenance rooms</p>
              <p className="text-2xl font-semibold mt-1">
                {maintenanceRoomsLabel ?? "-"}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                These rooms are excluded from availability.
              </p>
              <div className="mt-3">
                <Button
                  type="button"
                  variant="secondary"
                  className="text-xs px-3 py-1"
                  onClick={() => navigate("/rooms")}
                >
                  Review rooms →
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Revenue mini chart */}
      <Card>
        <CardBody>
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="text-sm font-semibold text-slate-800">
              Revenue trend (completed payments)
            </h3>
            <p className="text-xs text-slate-400">Last {rangeDays} days</p>
          </div>

          {revenueSeries.length === 0 ? (
            <p className="text-sm text-slate-500">
              No revenue data for the selected range.
            </p>
          ) : (
            <div className="flex items-end gap-1 h-24">
              {revenueSeries.map((p) => {
                const h =
                  maxRevenue > 0 ? Math.round((p.value / maxRevenue) * 100) : 0;
                return (
                  <div key={p.date} className="flex-1 min-w-[6px]">
                    <div
                      title={`${p.date}: ${formatCurrency(p.value)}`}
                      className="w-full rounded bg-slate-900/80"
                      style={{ height: `${Math.max(2, h)}%` }}
                    />
                    <div className="text-[10px] text-slate-400 mt-1 text-center truncate">
                      {p.date.slice(5)} {/* MM-DD */}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Latest widgets */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardBody>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800">
                Latest reservations
              </h3>
              <Button
                type="button"
                variant="ghost"
                className="text-xs px-2 py-1"
                onClick={() => navigate("/reservations")}
              >
                View all →
              </Button>
            </div>

            {data.latestBookings.length === 0 ? (
              <p className="text-sm text-slate-500">There are no reservations yet.</p>
            ) : (
              <div className="space-y-2">
                {data.latestBookings.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 bg-white"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        Reservation #{b.id}
                      </p>
                      <p className="text-xs text-slate-500">
                        {toDate(b.checkIn)?.toLocaleDateString() ?? "-"} →{" "}
                        {toDate(b.checkOut)?.toLocaleDateString() ?? "-"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant={getBookingStatusVariant(b.status)}>
                        {b.status}
                      </Badge>
                      <Button
                        type="button"
                        variant="secondary"
                        className="text-xs px-2 py-1"
                        onClick={() => navigate(`/reservations/${b.id}`)}
                      >
                        View
                      </Button>
                    </div>
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
              <Button
                type="button"
                variant="ghost"
                className="text-xs px-2 py-1"
                onClick={() => navigate("/payments")}
              >
                View all →
              </Button>
            </div>

            {data.latestPayments.length === 0 ? (
              <p className="text-sm text-slate-500">
                There are no completed payments yet.
              </p>
            ) : (
              <div className="space-y-2">
                {data.latestPayments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 bg-white"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        Payment #{p.id} · Booking #{p.bookingId}
                      </p>
                      <p className="text-xs text-slate-500">
                        {toDate(p.createdAt)?.toLocaleString() ?? "-"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">
                        {formatCurrency(p.amount)}
                      </p>
                      <Button
                        type="button"
                        variant="secondary"
                        className="text-xs px-2 py-1"
                        onClick={() => navigate(`/payments?bookingId=${p.bookingId}`)}
                      >
                        Open
                      </Button>
                    </div>
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
