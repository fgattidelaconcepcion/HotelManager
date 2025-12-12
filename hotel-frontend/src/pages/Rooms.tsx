import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { toast } from "sonner";

interface RoomType {
  id: number;
  name: string;
  basePrice?: number | null;
}

export interface Room {
  id: number;
  number: string;
  floor: number;
  description?: string | null;
  roomType?: RoomType | null;
  createdAt?: string;
  updatedAt?: string;
}

export default function Rooms() {
  const navigate = useNavigate();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);

  const [searchText, setSearchText] = useState("");
  const [floorFilter, setFloorFilter] = useState<string>("");
  const [roomTypeFilter, setRoomTypeFilter] = useState<string>("");

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

  useEffect(() => {
    loadRooms();
  }, []);

  const formatCurrency = (value?: number | null) => {
    if (value == null) return "-";
    return new Intl.NumberFormat("en-UY", {
      style: "currency",
      currency: "UYU",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const floors = useMemo(
    () =>
      Array.from(new Set(rooms.map((r) => r.floor))).sort((a, b) => a - b),
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
            String(room.id).includes(text));
      }

      if (floorFilter) {
        ok = ok && String(room.floor) === floorFilter;
      }

      if (roomTypeFilter) {
        ok = ok && room.roomType?.name === roomTypeFilter;
      }

      return ok;
    });
  }, [rooms, searchText, floorFilter, roomTypeFilter]);

  const handleDelete = async (room: Room) => {
    const ok = window.confirm(
      `Are you sure you want to delete room ${room.number} (ID ${room.id})?`
    );
    if (!ok) return;

    try {
      setLoading(true);
      await api.delete(`/rooms/${room.id}`);

      toast.success("Room deleted successfully");

      await loadRooms();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rooms"
        description="Manage hotel rooms."
        actions={
          <Button onClick={() => navigate("/rooms/new")}>
            New room
          </Button>
        }
      />

      {/* Filters */}
      <Card>
        <CardBody>
          <form className="flex flex-wrap gap-4 items-end">
            <div className="flex flex-col">
              <label className="text-sm font-medium text-slate-700">
                Search
              </label>
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="mt-1 border rounded px-3 py-2 text-sm w-64"
                placeholder="Number, description, type..."
              />
            </div>

            <div className="flex flex-col">
              <label className="text-sm font-medium text-slate-700">
                Floor
              </label>
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
              <label className="text-sm font-medium text-slate-700">
                Room type
              </label>
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

            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={loadRooms}>
                Refresh
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setSearchText("");
                  setFloorFilter("");
                  setRoomTypeFilter("");
                }}
              >
                Clear
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {/* Table */}
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
                  <th className="px-4 py-2 text-right">Base price</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRooms.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                      No rooms found.
                    </td>
                  </tr>
                )}

                {filteredRooms.map((r) => (
                  <tr key={r.id} className="border-t last:border-b">
                    <td className="px-4 py-2">{r.id}</td>
                    <td className="px-4 py-2">{r.number}</td>
                    <td className="px-4 py-2">{r.floor}</td>
                    <td className="px-4 py-2">
                      {r.roomType?.name || "-"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {formatCurrency(r.roomType?.basePrice)}
                    </td>
                    <td className="px-4 py-2 text-right space-x-2">
                      <Button
                        variant="ghost"
                        className="text-xs"
                        onClick={() => navigate(`/rooms/${r.id}`)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        className="text-xs"
                        onClick={() => handleDelete(r)}
                        disabled={loading}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}

                {loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-4 text-center text-slate-500">
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
