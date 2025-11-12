import { useEffect, useState } from "react";
import api from "../api/api";

interface RoomType {
  id: number;
  name: string;
  basePrice: number;
}

interface Room {
  id: number;
  number: string;
  floor: number;
  status: string;
  description: string;
  roomType: RoomType;
}

export default function Rooms() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newRoom, setNewRoom] = useState({
    number: "",
    floor: "",
    roomTypeId: "",
    status: "",
    description: "",
  });

  const fetchRooms = async () => {
    try {
      const response = await api.get("/rooms");
      setRooms(response.data);
    } catch (error) {
      console.error("Error fetching rooms:", error);
    }
  };

  const fetchRoomTypes = async () => {
    try {
      const response = await api.get("/room-types");
      setRoomTypes(response.data);
    } catch (error) {
      console.error("Error fetching room types:", error);
    }
  };

  useEffect(() => {
    fetchRooms();
    fetchRoomTypes();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/rooms", {
        number: newRoom.number,
        floor: parseInt(newRoom.floor),
        roomTypeId: parseInt(newRoom.roomTypeId),
        status: newRoom.status,
        description: newRoom.description,
      });
      setShowModal(false);
      setNewRoom({ number: "", floor: "", roomTypeId: "", status: "", description: "" });
      fetchRooms();
    } catch (error) {
      console.error("Error adding room:", error);
      alert("Error al agregar la habitación");
    }
  };

  return (
    <div className="text-white">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Habitaciones</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-white"
        >
          ➕ Agregar habitación
        </button>
      </div>

      <table className="min-w-full bg-gray-800 rounded-lg overflow-hidden">
        <thead>
          <tr>
            <th className="p-2 text-left">Número</th>
            <th className="p-2 text-left">Piso</th>
            <th className="p-2 text-left">Tipo</th>
            <th className="p-2 text-left">Precio base</th>
            <th className="p-2 text-left">Estado</th>
            <th className="p-2 text-left">Descripción</th>
          </tr>
        </thead>
        <tbody>
          {rooms.map((room) => (
            <tr key={room.id} className="border-t border-gray-700">
              <td className="p-2">{room.number}</td>
              <td className="p-2">{room.floor}</td>
              <td className="p-2">{room.roomType?.name}</td>
              <td className="p-2">${room.roomType?.basePrice}</td>
              <td className="p-2 capitalize">{room.status}</td>
              <td className="p-2">{room.description}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-gray-900 p-6 rounded-lg w-96">
            <h2 className="text-xl font-semibold mb-4">Nueva habitación</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text"
                placeholder="Número"
                className="w-full p-2 rounded bg-gray-800 border border-gray-700"
                value={newRoom.number}
                onChange={(e) =>
                  setNewRoom({ ...newRoom, number: e.target.value })
                }
              />

              <input
                type="number"
                placeholder="Piso"
                className="w-full p-2 rounded bg-gray-800 border border-gray-700"
                value={newRoom.floor}
                onChange={(e) =>
                  setNewRoom({ ...newRoom, floor: e.target.value })
                }
              />

              <select
                className="w-full p-2 rounded bg-gray-800 border border-gray-700"
                value={newRoom.roomTypeId}
                onChange={(e) =>
                  setNewRoom({ ...newRoom, roomTypeId: e.target.value })
                }
              >
                <option value="">Selecciona tipo</option>
                {roomTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name} (${type.basePrice})
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Estado (ej: disponible)"
                className="w-full p-2 rounded bg-gray-800 border border-gray-700"
                value={newRoom.status}
                onChange={(e) =>
                  setNewRoom({ ...newRoom, status: e.target.value })
                }
              />

              <textarea
                placeholder="Descripción"
                className="w-full p-2 rounded bg-gray-800 border border-gray-700"
                value={newRoom.description}
                onChange={(e) =>
                  setNewRoom({ ...newRoom, description: e.target.value })
                }
              />

              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
