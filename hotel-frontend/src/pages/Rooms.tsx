import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { toast } from "sonner";
import RoleGate from "../auth/RoleGate";

interface RoomType {
  id: number;
  name: string;
  basePrice?: number | null;
}

type RoomStatus = "disponible" | "ocupado" | "mantenimiento";

export interface Room {
  id: number;
  number: string;
  floor: number;
  status?: RoomStatus;
  description?: string | null;
  roomType?: RoomType | null;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Status badge component.
 * Here I translate internal room statuses into a clean UI label and style.
 */
function StatusBadge({ status }: { status?: RoomStatus }) {
  // Here I normalize missing status to "disponible"
  const s: RoomStatus = status ?? "disponible";

  // Here I map each status to a readable label + Tailwind classes
  const map: Record<RoomStatus, { label: string; className: string }> = {
    disponible: {
      label: "Available",
      className: "bg-green-100 text-green-800 border-green-200",
    },
    ocupado: {
      label: "Occupied",
      className: "bg-amber-100 text-amber-800 border-amber-200",
    },
    mantenimiento: {
      label: "Maintenance",
      className: "bg-slate-100 text-slate-800 border-slate-200",
    },
  };

  const cfg = map[s];

  return (
    <span
      className={[
        "inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium",
        cfg.className,
      ].join(" ")}
      title={s}
    >
      {cfg.label}
    </span>
  );
}

export default function Rooms() {
  const navigate = useNavigate();

  // Here I store rooms loaded from the API
  const [rooms, setRooms] = useState<Room[]>([]);

  // Here I track loading state for table actions and refresh
  const [loading, setLoading] = useState(false);

  // Here I store UI filters
  const [searchText, setSearchText] = useState("");
  const [floorFilter, setFloorFilter] = useState<string>("");
  const [roomTypeFilter, setRoomTypeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  /**
   * Here I load rooms from the backend.
   * I keep it as a reusable function so I can refresh after deletes/updates.
   */
  const loadRooms = async () => {
    try {
      setLoading(true);
      const res = await api.get("/rooms");
      const data = res.data?.data ?? res.data;
      setRooms(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  // Here I load rooms once when the page mounts
  useEffect(() => {
    loadRooms();
  }, []);

  // Here I format base prices consistently for Uruguay currency (UYU)
  const formatCurrency = (value?: number | null) => {
    if (value == null) return "-";
    return new Intl.NumberFormat("en-UY", {
      style: "currency",
      currency: "UYU",
      minimumFractionDigits: 0,
    }).format(value);
  };

  /**
   * Here I compute filter options from current rooms:
   * - floors list
   * - room type names list
   */
  const floors = useMemo(
    () => Array.from(new Set(rooms.map((r) => r.floor))).sort((a, b) => a - b),
    [rooms]
  );

  const roomTypeNames = useMemo(
    () =>
      Array.from(
        new Set(
          rooms
            .map((r) => r.roomType?.name)
            .filter((x): x is string => Boolean(x))
        )
      ).sort(),
    [rooms]
  );

  /**
   * Here I filter rooms in-memory based on the UI filters:
   * - free text search across number, description, type, id, status
   * - exact filters for floor, type, status
   */
  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      let ok = true;

      if (searchText.trim()) {
        const text = searchText.toLowerCase();
        ok =
          ok &&
          (room.number.toLowerCase().includes(text) ||
            room.description?.toLowerCase().includes(text) ||
            room.roomType?.name?.toLowerCase().includes(text) ||
            String(room.id).includes(text) ||
            (room.status ?? "disponible").toLowerCase().includes(text));
      }

      if (floorFilter) ok = ok && String(room.floor) === floorFilter;
      if (roomTypeFilter) ok = ok && room.roomType?.name === roomTypeFilter;
      if (statusFilter) ok = ok && (room.status ?? "disponible") === statusFilter;

      return ok;
    });
  }, [rooms, searchText, floorFilter, roomTypeFilter, statusFilter]);

  /**
   * Here I delete a room:
   * - I block deleting occupied rooms (client-side UX)
   * - I confirm with the user
   * - I reload rooms after success
   *
   * Note: I still rely on backend validation as the real source of truth.
   */
  const handleDelete = async (room: Room) => {
    if ((room.status ?? "disponible") === "ocupado") {
      toast.warning("You can’t delete an occupied room.");
      return;
    }

    const ok = window.confirm(
      `Are you sure you want to delete room ${room.number} (ID ${room.id})?`
    );
    if (!ok) return;

    try {
      setLoading(true);
      await api.delete(`/rooms/${room.id}`);
      toast.success("Room deleted successfully");
      await loadRooms();
    } catch {
      toast.error("Could not delete the room.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Here I show the page title and primary action */}
      <PageHeader
        title="Rooms"
        description="Manage hotel rooms."
        actions={<Button onClick={() => navigate("/rooms/new")}>New room</Button>}
      />

      {/* Here I render filters for searching and narrowing results */}
      <Card>
        <CardBody>
          <form className="flex flex-wrap gap-4 items-end">
            <div className="flex flex-col">
              <label className="text-sm font-medium text-slate-700">Search</label>
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="mt-1 border rounded px-3 py-2 text-sm w-64"
                placeholder="Number, description, type, status..."
              />
            </div>

            <div className="flex flex-col">
              <label className="text-sm font-medium text-slate-700">Floor</label>
              <select
                value={floorFilter}
                onChange={(e) => setFloorFilter(e.target.value)}
                className="mt-1 border rounded px-3 py-2 text-sm w-32"
              >
                <option value="">All</option>
                {floors.map((f) => (
                  <option key={f} value={String(f)}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-sm font-medium text-slate-700">Room type</label>
              <select
                value={roomTypeFilter}
                onChange={(e) => setRoomTypeFilter(e.target.value)}
                className="mt-1 border rounded px-3 py-2 text-sm w-40"
              >
                <option value="">All</option>
                {roomTypeNames.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-sm font-medium text-slate-700">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="mt-1 border rounded px-3 py-2 text-sm w-44"
              >
                <option value="">All</option>
                <option value="disponible">Available</option>
                <option value="ocupado">Occupied</option>
                <option value="mantenimiento">Maintenance</option>
              </select>
            </div>

            <div className="flex gap-2">
              {/* Here I reload rooms from the server */}
              <Button type="button" variant="secondary" onClick={loadRooms}>
                Refresh
              </Button>

              {/* Here I clear all UI filters */}
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setSearchText("");
                  setFloorFilter("");
                  setRoomTypeFilter("");
                  setStatusFilter("");
                }}
              >
                Clear
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {/* Here I display the rooms table with actions */}
      <Card>
        <CardBody>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left">ID</th>
                  <th className="px-4 py-2 text-left">Number</th>
                  <th className="px-4 py-2 text-left">Floor</th>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-right">Base price</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {/* Here I show an empty state when there are no results */}
                {filteredRooms.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                      No rooms found.
                    </td>
                  </tr>
                )}

                {/* Here I render each room row */}
                {filteredRooms.map((r) => (
                  <tr key={r.id} className="border-t last:border-b">
                    <td className="px-4 py-2">{r.id}</td>
                    <td className="px-4 py-2">{r.number}</td>
                    <td className="px-4 py-2">{r.floor}</td>
                    <td className="px-4 py-2">{r.roomType?.name || "-"}</td>

                    <td className="px-4 py-2">
                      <StatusBadge status={r.status} />
                    </td>

                    <td className="px-4 py-2 text-right">
                      {formatCurrency(r.roomType?.basePrice)}
                    </td>

                    <td className="px-4 py-2 text-right space-x-2">
                      {/* Here I navigate to the edit page */}
                      <Button
                        variant="ghost"
                        className="text-xs"
                        onClick={() => navigate(`/rooms/${r.id}`)}
                      >
                        Edit
                      </Button>

                      {/* Here I hide the delete action unless the user is admin */}
                      <RoleGate allowed={["admin"]}>
                        <Button
                          variant="danger"
                          className="text-xs"
                          onClick={() => handleDelete(r)}
                          disabled={loading}
                        >
                          Delete
                        </Button>
                      </RoleGate>
                    </td>
                  </tr>
                ))}

                {/* Here I show a loading row while fetching data */}
                {loading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-4 text-center text-slate-500">
                      Loading...
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
