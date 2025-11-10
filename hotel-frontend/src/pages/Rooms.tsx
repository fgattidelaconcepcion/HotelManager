import { useEffect, useState } from "react";
import axios from "axios";

interface Room {
  id: number;
  number: string;
  roomType: {
    name: string;
    basePrice: number;
  };
  status: string;
  description: string;
}

export default function Rooms() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newRoom, setNewRoom] = useState({
    number: "",
    type: "",
    basePrice: "",
    status: "",
    description: "",
  });

  const fetchRooms = async () => {
    const response = await axios.get("http://localhost:8000/api/rooms");
    setRooms(response.data);
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post("http://localhost:8000/api/rooms", {
        number: newRoom.number,
        type: newRoom.type,
        basePrice: parseFloat(newRoom.basePrice),
        status: newRoom.status,
        description: newRoom.description,
      });
      setShowModal(false);
      setNewRoom({
        number: "",
        type: "",
        basePrice: "",
        status: "",
        description: "",
      });
      fetchRooms();
    } catch (error) {
      console.error("Error adding room:", error);
      alert("Error adding room");
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
          ➕ Add Room
        </button>
      </div>

      <table className="min-w-full bg-gray-800 rounded-lg overflow-hidden">
        <thead>
          <tr>
            <th className="p-2 text-left">Número</th>
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
            <h2 className="text-xl font-semibold mb-4">Add New Room</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text"
                placeholder="Room number"
                className="w-full p-2 rounded bg-gray-800 border border-gray-700"
                value={newRoom.number}
                onChange={(e) =>
                  setNewRoom({ ...newRoom, number: e.target.value })
                }
              />
              <input
                type="text"
                placeholder="Type"
                className="w-full p-2 rounded bg-gray-800 border border-gray-700"
                value={newRoom.type}
                onChange={(e) =>
                  setNewRoom({ ...newRoom, type: e.target.value })
                }
              />
              <input
                type="number"
                placeholder="Base price"
                className="w-full p-2 rounded bg-gray-800 border border-gray-700"
                value={newRoom.basePrice}
                onChange={(e) =>
                  setNewRoom({ ...newRoom, basePrice: e.target.value })
                }
              />
              <input
                type="text"
                placeholder="Status"
                className="w-full p-2 rounded bg-gray-800 border border-gray-700"
                value={newRoom.status}
                onChange={(e) =>
                  setNewRoom({ ...newRoom, status: e.target.value })
                }
              />
              <textarea
                placeholder="Description"
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
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
