import { useEffect, useMemo, useState } from "react";
import api from "../api/api";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

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
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchText, setSearchText] = useState("");
  const [floorFilter, setFloorFilter] = useState<string>("");
  const [roomTypeFilter, setRoomTypeFilter] = useState<string>("");

  const loadRooms = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get("/rooms");
      const data = res.data?.data ?? res.data;
      setRooms(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Error loading rooms", err);
      setError(
        err?.response?.data?.error ||
          "Hubo un error al cargar las habitaciones. Intenta nuevamente."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  const formatCurrency = (value?: number | null) => {
    if (value == null) return "-";
    return new Intl.NumberFormat("es-UY", {
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

  const totalRooms = rooms.length;
  const roomsWithType = rooms.filter((r) => !!r.roomType).length;
  const roomsWithoutType = totalRooms - roomsWithType;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Habitaciones"
        description="Gestiona las habitaciones del hotel."
        actions={
          <Button disabled className="opacity-70 cursor-not-allowed">
            Nueva habitación (pronto)
          </Button>
        }
      />

      {/* Resumen */}
      <Card>
        <CardBody>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs text-slate-500">Total de habitaciones</p>
              <p className="text-lg font-semibold mt-1">{totalRooms}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Con tipo asignado</p>
              <p className="text-lg font-semibold mt-1">{roomsWithType}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Sin tipo asignado</p>
              <p className="text-lg font-semibold mt-1">{roomsWithoutType}</p>
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
                placeholder="Nro habitación, descripción, tipo..."
              />
            </div>

            <div className="flex flex-col">
              <label className="text-sm font-medium text-slate-700">
                Piso
              </label>
              <select
                value={floorFilter}
                onChange={(e) => setFloorFilter(e.target.value)}
                className="mt-1 border rounded px-3 py-2 text-sm w-32"
              >
                <option value="">Todos</option>
                {floors.map((floor) => (
                  <option key={floor} value={floor}>
                    {floor}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-sm font-medium text-slate-700">
                Tipo
              </label>
              <select
                value={roomTypeFilter}
                onChange={(e) => setRoomTypeFilter(e.target.value)}
                className="mt-1 border rounded px-3 py-2 text-sm w-44"
              >
                <option value="">Todos</option>
                {roomTypeNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={loadRooms}>
                Refrescar
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

      {/* Tabla de habitaciones */}
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
                    Habitación
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">
                    Tipo
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-slate-700">
                    Tarifa base
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">
                    Descripción
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-slate-700">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRooms.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-slate-500"
                    >
                      No hay habitaciones que coincidan con los filtros.
                    </td>
                  </tr>
                )}

                {filteredRooms.map((room) => (
                  <tr key={room.id} className="border-t last:border-b">
                    <td className="px-4 py-2 align-top">{room.id}</td>
                    <td className="px-4 py-2 align-top">
                      <div className="flex flex-col">
                        <span className="font-medium">
                          Hab {room.number}
                        </span>
                        <span className="text-xs text-slate-500">
                          Piso {room.floor}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 align-top">
                      {room.roomType?.name ?? "-"}
                    </td>
                    <td className="px-4 py-2 align-top text-right">
                      {formatCurrency(room.roomType?.basePrice ?? null)}
                    </td>
                    <td className="px-4 py-2 align-top">
                      {room.description || "-"}
                    </td>
                    <td className="px-4 py-2 align-top text-right space-x-2">
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
                      colSpan={6}
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
