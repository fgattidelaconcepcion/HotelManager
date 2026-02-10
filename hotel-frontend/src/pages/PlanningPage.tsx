import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import RoleGate from "../auth/RoleGate";

type BookingStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "checked_in"
  | "checked_out";

type RoomStatus = "disponible" | "ocupado" | "mantenimiento";

interface RoomType {
  id: number;
  name: string;
  basePrice?: number | null;
}

interface Room {
  id: number;
  number: string;
  floor: number;
  status?: RoomStatus;
  roomType?: RoomType | null;
}

interface BookingGuest {
  id: number;
  name: string;
}

interface BookingRoom {
  id: number;
  number: string;
  floor: number;
}

interface Booking {
  id: number;
  roomId: number;
  guestId?: number | null;
  checkIn: string;
  checkOut: string;
  status: BookingStatus | string;
  guest?: BookingGuest | null;
  room?: BookingRoom | null;
}

/**
 * Here I build YYYY-MM-DD for backend query params.
 */
function toDateOnlyISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Here I calculate the day index for rendering blocks inside the planning window.
 * This assumes we are working with date-only (midnight-based) values in the UI.
 */
function dayDiff(from: Date, to: Date) {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((to.getTime() - from.getTime()) / msPerDay);
}

/**
 * Here I map booking status to Tailwind styles.
 */
function statusStyle(status: string) {
  const s = String(status || "").toLowerCase();

  if (s === "checked_in") return "bg-green-600 text-white";
  if (s === "confirmed") return "bg-blue-600 text-white";
  if (s === "pending") return "bg-amber-500 text-white";
  if (s === "checked_out") return "bg-slate-600 text-white";
  if (s === "cancelled" || s === "canceled") return "bg-rose-600 text-white";

  return "bg-slate-400 text-white";
}

/**
 * Here I normalize backend status strings into our BookingStatus union.
 * This keeps the UI safe even if the backend returns unexpected casing.
 */
function normalizeBookingStatus(status: string): BookingStatus | null {
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

/**
 * Here I enforce the SAME rule as your backend moveBookingRoom:
 * only pending/confirmed can be moved.
 */
function canMoveBooking(status: string) {
  const s = normalizeBookingStatus(status);
  return s === "pending" || s === "confirmed";
}

function moveBlockedReason(status: string) {
  const s = normalizeBookingStatus(status);

  if (s === "checked_in") return "This booking is checked in. Room moves are locked.";
  if (s === "checked_out") return "This booking is checked out. It can't be changed.";
  if (s === "cancelled") return "This booking is cancelled. It can't be changed.";

  return "This booking can’t be moved in its current status.";
}

/**
 * Here I map API errors into a clean message for the page banner.
 */
function mapMoveError(err: any) {
  const data = err?.response?.data;
  const code = data?.code as string | undefined;

  if (code === "ROOM_NOT_AVAILABLE") return "Room is not available for the selected dates.";
  if (code === "ROOM_IN_MAINTENANCE") return "This room is under maintenance and can’t be booked.";
  if (code === "ROOM_NOT_FOUND") return "Room not found.";
  if (code === "BOOKING_LOCKED") return "This booking can’t be moved in its current status.";
  if (code === "SAME_ROOM") return "Select a different room to move this booking.";

  return data?.error || "Could not move the booking.";
}

export default function PlanningPage() {
  const navigate = useNavigate();

  // Here I control the planning window (default: next 14 days)
  const [from, setFrom] = useState(() => toDateOnlyISO(startOfToday()));
  const [days, setDays] = useState(14);

  // Here I store planning data
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Here I handle the "move booking" modal UX
  const [moving, setMoving] = useState<null | { booking: Booking }>(null);
  const [moveRoomId, setMoveRoomId] = useState<number | "">("");
  const [savingMove, setSavingMove] = useState(false);

  /**
   * Here I compute the window end-date "to" for the backend query.
   */
  const to = useMemo(() => {
    const d = new Date(from + "T00:00:00");
    return toDateOnlyISO(addDays(d, days));
  }, [from, days]);

  /**
   * Here I load planning data from the backend.
   * Expected response:
   *  { data: { rooms: Room[], bookings: Booking[] } }
   */
  const loadPlanning = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await api.get("/planning", {
        params: { from, to },
        silentErrorToast: true,
      } as any);

      const data = res.data?.data ?? res.data;

      setRooms(Array.isArray(data?.rooms) ? data.rooms : []);
      setBookings(Array.isArray(data?.bookings) ? data.bookings : []);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Could not load planning.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlanning();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, days]);

  /**
   * Here I build an array of Date objects representing each day in the window.
   */
  const daysList = useMemo(() => {
    const base = new Date(from + "T00:00:00");
    return Array.from({ length: days }).map((_, i) => addDays(base, i));
  }, [from, days]);

  /**
   * Here I group bookings by roomId so rendering stays fast.
   */
  const bookingsByRoom = useMemo(() => {
    const map = new Map<number, Booking[]>();
    for (const b of bookings) {
      const arr = map.get(b.roomId) ?? [];
      arr.push(b);
      map.set(b.roomId, arr);
    }
    return map;
  }, [bookings]);

  /**
   * Here I navigate to the booking detail page.
   */
  const handleOpenBooking = (id: number) => navigate(`/reservations/${id}`);

  /**
   * Here I open the Move modal.
   * I block locked statuses at the UI level for a better UX.
   */
  const handleOpenMove = (booking: Booking) => {
    if (!canMoveBooking(booking.status)) {
      setError(moveBlockedReason(booking.status));
      return;
    }

    setMoving({ booking });
    setMoveRoomId("");
  };

  /**
   * Here I confirm the move and call the dedicated backend endpoint:
   * PATCH /bookings/:id/move-room
   *
   * This endpoint:
   * - validates tenant isolation
   * - checks overlaps in the new room
   * - recalculates price using target roomType
   */
  const handleConfirmMove = async () => {
    if (!moving?.booking) return;
    if (!moveRoomId) return;

    const b = moving.booking;

    // Here I avoid moving to the same room (clean UX)
    if (Number(moveRoomId) === b.roomId) {
      setError("Select a different room to move this booking.");
      return;
    }

    try {
      setSavingMove(true);
      setError(null);

      await api.patch(
        `/bookings/${b.id}/move-room`,
        { roomId: Number(moveRoomId) },
        { silentErrorToast: true } as any
      );

      setMoving(null);
      setMoveRoomId("");
      await loadPlanning();
    } catch (err: any) {
      setError(mapMoveError(err));
    } finally {
      setSavingMove(false);
    }
  };

  const fromDateObj = useMemo(() => new Date(from + "T00:00:00"), [from]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Planning"
        description="Timeline view of room occupancy and reservations."
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button variant="secondary" type="button" onClick={loadPlanning}>
              Refresh
            </Button>

            <Button type="button" onClick={() => navigate("/reservations/new")}>
              New reservation
            </Button>
          </div>
        }
      />

      {error && (
        <Card>
          <CardBody>
            <div className="bg-red-50 text-red-800 px-4 py-2 rounded text-sm">
              {error}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Controls */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                From
              </label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 border rounded px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Days
              </label>
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="mt-1 border rounded px-3 py-2 text-sm"
              >
                <option value={7}>7</option>
                <option value={14}>14</option>
                <option value={21}>21</option>
                <option value={30}>30</option>
              </select>
            </div>

            <div className="text-xs text-slate-500">
              Window: <span className="font-medium">{from}</span> →{" "}
              <span className="font-medium">{to}</span>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Planning grid */}
      <Card>
        <CardBody>
          {loading ? (
            <p className="text-sm text-slate-500">Loading planning...</p>
          ) : rooms.length === 0 ? (
            <p className="text-sm text-slate-500">No rooms found.</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[900px]">
                {/* Header row: dates */}
                <div
                  className="grid"
                  style={{
                    gridTemplateColumns: `240px repeat(${days}, minmax(60px, 1fr))`,
                  }}
                >
                  <div className="px-3 py-2 text-xs font-semibold text-slate-600 border-b bg-slate-50">
                    Room
                  </div>

                  {daysList.map((d, idx) => (
                    <div
                      key={idx}
                      className="px-2 py-2 text-[11px] text-slate-600 border-b bg-slate-50 text-center"
                      title={d.toDateString()}
                    >
                      {d.getDate()}/{d.getMonth() + 1}
                    </div>
                  ))}
                </div>

                {/* Rows: each room */}
                {rooms.map((room) => {
                  const roomBookings = bookingsByRoom.get(room.id) ?? [];

                  return (
                    <div
                      key={room.id}
                      className="grid border-b"
                      style={{
                        gridTemplateColumns: `240px repeat(${days}, minmax(60px, 1fr))`,
                      }}
                    >
                      {/* Room label cell */}
                      <div className="px-3 py-3 text-sm">
                        <div className="font-semibold text-slate-900">
                          Room {room.number}{" "}
                          <span className="text-slate-500 font-normal">
                            (Floor {room.floor})
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">
                          {room.roomType?.name ?? "No type"}
                        </div>
                      </div>

                      {/* Timeline cells background */}
                      {daysList.map((_, i) => (
                        <div key={i} className="border-l h-14" />
                      ))}

                      {/* Bookings blocks overlay */}
                      <div
                        className="col-span-full"
                        style={{ gridColumn: "1 / -1", position: "relative" }}
                      >
                        {roomBookings.map((b) => {
                          const bStart = new Date(b.checkIn);
                          const bEnd = new Date(b.checkOut);

                          // Here I clamp booking range to the window
                          const startIndex = Math.max(
                            0,
                            dayDiff(fromDateObj, bStart)
                          );
                          const endIndex = Math.min(
                            days,
                            dayDiff(fromDateObj, bEnd)
                          );

                          const span = Math.max(1, endIndex - startIndex);

                          // V1 layout: fixed day width approximation
                          const labelWidth = 240;
                          const dayWidth = 60;
                          const left = labelWidth + startIndex * dayWidth;
                          const width = span * dayWidth;

                          const allowedMove = canMoveBooking(b.status);

                          return (
                            <div
                              key={b.id}
                              className={[
                                "absolute top-2 h-10 rounded-lg shadow-sm cursor-pointer",
                                "flex items-center justify-between gap-2 px-2 text-xs",
                                statusStyle(b.status),
                              ].join(" ")}
                              style={{ left, width }}
                              title={`#${b.id} • ${
                                b.guest?.name ?? "No guest"
                              } • ${b.checkIn} → ${b.checkOut}`}
                              onClick={() => handleOpenBooking(b.id)}
                            >
                              <div className="truncate">
                                #{b.id} • {b.guest?.name ?? "No guest"}
                              </div>

                              <RoleGate allowed={["admin", "receptionist"]}>
                                <button
                                  className={[
                                    "text-[10px] px-2 py-1 rounded",
                                    allowedMove
                                      ? "bg-white/20 hover:bg-white/30"
                                      : "bg-white/10 opacity-60 cursor-not-allowed",
                                  ].join(" ")}
                                  disabled={!allowedMove}
                                  title={
                                    allowedMove
                                      ? "Move booking to another room"
                                      : moveBlockedReason(b.status)
                                  }
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenMove(b);
                                  }}
                                >
                                  Move
                                </button>
                              </RoleGate>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Move modal */}
      {moving?.booking && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-lg border">
            <div className="p-4 border-b">
              <div className="font-semibold text-slate-900">
                Move booking #{moving.booking.id}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {moving.booking.checkIn} → {moving.booking.checkOut}
              </div>
            </div>

            <div className="p-4 space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                New room
              </label>

              <select
                value={moveRoomId}
                onChange={(e) =>
                  setMoveRoomId(e.target.value ? Number(e.target.value) : "")
                }
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="">Select a room</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    Room {r.number} (Floor {r.floor}) •{" "}
                    {r.roomType?.name ?? "No type"}
                  </option>
                ))}
              </select>

              <p className="text-xs text-slate-500">
                This keeps dates and guest, and only changes the room.
              </p>
            </div>

            <div className="p-4 border-t flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={savingMove}
                onClick={() => setMoving(null)}
              >
                Cancel
              </Button>

              <Button
                type="button"
                disabled={savingMove || !moveRoomId}
                onClick={handleConfirmMove}
              >
                {savingMove ? "Saving..." : "Confirm move"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
