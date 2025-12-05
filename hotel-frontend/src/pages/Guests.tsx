import { useEffect, useState } from "react";
import api from "../api/api";

interface Guest {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  createdAt: string;
}

interface FormGuest {
  id: number | null;
  name: string;
  email: string;
  phone: string;
}

export default function Guests() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [formGuest, setFormGuest] = useState<FormGuest>({
    id: null,
    name: "",
    email: "",
    phone: "",
  });

  const fetchGuests = async (searchValue?: string) => {
    try {
      setLoading(true);
      const params = searchValue ? { search: searchValue } : undefined;
      const res = await api.get("/guests", { params });
      const data = res.data?.data || res.data?.guests || [];
      if (Array.isArray(data)) {
        setGuests(data);
      } else {
        setGuests([]);
      }
    } catch (e) {
      console.error("Error fetching guests:", e);
      setGuests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuests();
  }, []);

  const openCreateModal = () => {
    setIsEditing(false);
    setFormGuest({
      id: null,
      name: "",
      email: "",
      phone: "",
    });
    setShowModal(true);
  };

  const openEditModal = (guest: Guest) => {
    setIsEditing(true);
    setFormGuest({
      id: guest.id,
      name: guest.name,
      email: guest.email ?? "",
      phone: guest.phone ?? "",
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formGuest.name.trim()) {
      alert("El nombre es obligatorio.");
      return;
    }

    const payload = {
      name: formGuest.name.trim(),
      email: formGuest.email.trim() || "",
      phone: formGuest.phone.trim() || "",
    };

    try {
      if (isEditing && formGuest.id != null) {
        await api.put(`/guests/${formGuest.id}`, payload);
      } else {
        await api.post("/guests", payload);
      }

      setShowModal(false);
      await fetchGuests(search);
    } catch (err) {
      console.error("Error saving guest:", err);

      const anyErr = err as {
        response?: {
          data?: {
            error?: string;
            message?: string;
          };
        };
      };

      const msg =
        anyErr.response?.data?.error ||
        anyErr.response?.data?.message ||
        "Error al guardar el huésped";

      alert(msg);
    }
  };

  const deleteGuest = async (id: number) => {
    if (!confirm("¿Eliminar este huésped?")) return;

    try {
      await api.delete(`/guests/${id}`);
      await fetchGuests(search);
    } catch (e) {
      console.error("Error deleting guest:", e);
      alert("No se pudo eliminar el huésped");
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("es-UY", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

  const handleSearchChange = (value: string) => {
    setSearch(value);
    // Búsqueda simple sin debounce por ahora
    fetchGuests(value);
  };

  return (
    <div className="text-white">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Huéspedes</h1>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Buscar (nombre, email, teléfono)"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="p-2 rounded bg-gray-800 text-sm w-64"
          />
          <button
            onClick={openCreateModal}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm"
          >
            ➕ Nuevo huésped
          </button>
        </div>
      </div>

      {loading && (
        <p className="mb-2 text-gray-300 text-sm">Cargando huéspedes...</p>
      )}

      <table className="min-w-full bg-gray-800 rounded-lg overflow-hidden">
        <thead>
          <tr>
            <th className="p-2 text-left text-sm">#</th>
            <th className="p-2 text-left text-sm">Nombre</th>
            <th className="p-2 text-left text-sm">Email</th>
            <th className="p-2 text-left text-sm">Teléfono</th>
            <th className="p-2 text-left text-sm">Creado</th>
            <th className="p-2 text-left text-sm">Acciones</th>
          </tr>
        </thead>

        <tbody>
          {guests.map((g) => (
            <tr key={g.id} className="border-t border-gray-700">
              <td className="p-2 text-sm">{g.id}</td>
              <td className="p-2 text-sm">{g.name}</td>
              <td className="p-2 text-sm">{g.email || "-"}</td>
              <td className="p-2 text-sm">{g.phone || "-"}</td>
              <td className="p-2 text-sm">{formatDate(g.createdAt)}</td>
              <td className="p-2 text-sm">
                <div className="flex gap-2">
                  <button
                    onClick={() => openEditModal(g)}
                    className="bg-yellow-600 px-2 py-1 rounded text-xs"
                  >
                    ✏️ Editar
                  </button>
                  <button
                    onClick={() => deleteGuest(g.id)}
                    className="bg-red-600 px-2 py-1 rounded text-xs"
                  >
                    🗑️ Eliminar
                  </button>
                </div>
              </td>
            </tr>
          ))}

          {guests.length === 0 && !loading && (
            <tr>
              <td className="p-4 text-center text-gray-400 text-sm" colSpan={6}>
                No hay huéspedes cargados todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center">
          <div className="bg-gray-900 p-6 rounded-lg w-96">
            <h2 className="text-xl font-semibold mb-4">
              {isEditing ? "Editar huésped" : "Nuevo huésped"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text"
                placeholder="Nombre"
                value={formGuest.name}
                onChange={(e) =>
                  setFormGuest({ ...formGuest, name: e.target.value })
                }
                className="w-full p-2 bg-gray-800 rounded"
              />

              <input
                type="email"
                placeholder="Email (opcional)"
                value={formGuest.email}
                onChange={(e) =>
                  setFormGuest({ ...formGuest, email: e.target.value })
                }
                className="w-full p-2 bg-gray-800 rounded"
              />

              <input
                type="text"
                placeholder="Teléfono (opcional)"
                value={formGuest.phone}
                onChange={(e) =>
                  setFormGuest({ ...formGuest, phone: e.target.value })
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
