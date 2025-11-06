import { useEffect, useState } from "react";
import axios from "axios";

interface RoomType {
  id: number;
  name: string;
  basePrice: number;
  capacity: number;
}

interface Room {
  id: number;
  number: string;
  description: string;
  floor: number;
  status: string;
  roomType: RoomType;
}

export default function Rooms() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get("http://localhost:8000/api/rooms")
      .then((response) => {
        console.log("Rooms data:", response.data);
        setRooms(response.data);
      })
      .catch((error) => {
        console.error("Error fetching rooms:", error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="text-white">Cargando habitaciones...</p>;

  return (
    <div className="text-white">
      <h1 className="text-2xl mb-4 font-bold">Habitaciones</h1>

      {rooms.length === 0 ? (
        <p className="text-gray-400">No hay habitaciones registradas.</p>
      ) : (
        <table className="min-w-full bg-gray-800 rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-gray-700">
              <th className="p-2 text-left">Número</th>
              <th className="p-2 text-left">Tipo</th>
              <th className="p-2 text-left">Precio base</th>
              <th className="p-2 text-left">Estado</th>
              <th className="p-2 text-left">Descripción</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <tr key={room.id} className="border-t border-gray-700 hover:bg-gray-750">
                <td className="p-2">{room.number}</td>
                <td className="p-2">{room.roomType?.name || "—"}</td>
                <td className="p-2">${room.roomType?.basePrice ?? "—"}</td>
                <td className="p-2 capitalize">{room.status}</td>
                <td className="p-2">{room.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
