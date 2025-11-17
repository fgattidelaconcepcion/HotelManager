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
  roomTypeId: number;
}

export default function Rooms() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [formRoom, setFormRoom] = useState({
    id: 0,
    number: "",
    floor: "",
    roomTypeId: "" as string | number,
    status: "",
    description: "",
  });

  const fetchRooms = async () => {
    try {
      const res = await api.get("/rooms");
      setRooms(res.data);
    } catch (e) {
      console.error("Error fetching rooms:", e);
    }
  };

  const fetchRoomTypes = async () => {
    try {
      const res = await api.get("/room-types");
      setRoomTypes(res.data);
    } catch (e) {
      console.error("Error fetching room types:", e);
    }
  };

  useEffect(() => {
    fetchRooms();
    fetchRoomTypes();
  }, []);

  const openCreateModal = () => {
    setIsEditing(false);
    setFormRoom({
      id: 0,
      number: "",
      floor: "",
      roomTypeId: "",
      status: "",
      description: "",
    });
    setShowModal(true);
  };

  const openEditModal = (room: Room) => {
    setIsEditing(true);
    setFormRoom({
      id: room.id,
      number: room.number,
      floor: String(room.floor),
      roomTypeId: room.roomTypeId,
      status: room.status,
      description: room.description,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsedFloor = parseInt(String(formRoom.floor));
    const parsedType = parseInt(String(formRoom.roomTypeId));

    if (!formRoom.number || isNaN(parsedFloor) || isNaN(parsedType)) {
      alert("Completa todos los campos correctamente.");
      return;
    }

    try {
      if (isEditing) {
        await api.put(`/rooms/${formRoom.id}`, {
          number: formRoom.number,
          floor: parsedFloor,
          roomTypeId: parsedType,
          status: formRoom.status,
          description: formRoom.description,
        });
      } else {
        await api.post("/rooms", {
          number: formRoom.number,
          floor: parsedFloor,
          roomTypeId: parsedType,
          status: formRoom.status || "disponible",
          description: formRoom.description,
        });
      }

      setShowModal(false);
      fetchRooms();
    } catch (e) {
      console.error("Error saving room:", e);
      alert("Error al guardar la habitación");
    }
  };

  const deleteRoom = async (id: number) => {
    if (!confirm("¿Eliminar esta habitación?")) return;

    try {
      await api.delete(`/rooms/${id}`);
      fetchRooms();
    } catch (e) {
      console.error("Error deleting room:", e);
      alert("No se pudo eliminar");
    }
  };

  return (
    <div className="text-white">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Habitaciones</h1>
        <button
          onClick={openCreateModal}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg"
        >
          ➕ Agregar habitación
        </button>
      </div>

      <table className="min-w-full bg-gray-800 rounded-lg overflow-hidden">
        <thead>
          <tr>
            <th className="p-2">Número</th>
            <th className="p-2">Piso</th>
            <th className="p-2">Tipo</th>
            <th className="p-2">Precio base</th>
            <th className="p-2">Estado</th>
            <th className="p-2">Descripción</th>
            <th className="p-2">Acciones</th>
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
              <td className="p-2 flex gap-2">
                <button
                  onClick={() => openEditModal(room)}
                  className="bg-yellow-600 px-2 py-1 rounded"
                >
                  ✏️
                </button>
                <button
                  onClick={() => deleteRoom(room.id)}
                  className="bg-red-600 px-2 py-1 rounded"
                >
                  🗑️
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center">
          <div className="bg-gray-900 p-6 rounded-lg w-96">
            <h2 className="text-xl font-semibold mb-4">
              {isEditing ? "Editar habitación" : "Nueva habitación"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text"
                placeholder="Número"
                value={formRoom.number}
                onChange={(e) =>
                  setFormRoom({ ...formRoom, number: e.target.value })
                }
                className="w-full p-2 bg-gray-800 rounded"
              />

              <input
                type="number"
                placeholder="Piso"
                value={formRoom.floor}
                onChange={(e) =>
                  setFormRoom({ ...formRoom, floor: e.target.value })
                }
                className="w-full p-2 bg-gray-800 rounded"
              />

              <select
                value={formRoom.roomTypeId}
                onChange={(e) =>
                  setFormRoom({
                    ...formRoom,
                    roomTypeId: Number(e.target.value),
                  })
                }
                className="w-full p-2 bg-gray-800 rounded"
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
                placeholder="Estado"
                value={formRoom.status}
                onChange={(e) =>
                  setFormRoom({ ...formRoom, status: e.target.value })
                }
                className="w-full p-2 bg-gray-800 rounded"
              />

              <textarea
                placeholder="Descripción"
                value={formRoom.description}
                onChange={(e) =>
                  setFormRoom({ ...formRoom, description: e.target.value })
                }
                className="w-full p-2 bg-gray-800 rounded"
              />

              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="bg-gray-700 px-4 py-2 rounded"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="bg-green-600 px-4 py-2 rounded"
                >
                  {isEditing ? "Guardar cambios" : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
