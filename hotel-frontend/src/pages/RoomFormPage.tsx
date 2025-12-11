import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/api";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

interface RoomType {
  id: number;
  name: string;
  basePrice?: number | null;
}

interface RoomFormState {
  number: string;
  floor: string;
  description: string;
  roomTypeId: string; // string para el select
}

const emptyForm: RoomFormState = {
  number: "",
  floor: "",
  description: "",
  roomTypeId: "",
};

export default function RoomFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const isEdit = !!id;

  const [form, setForm] = useState<RoomFormState>(emptyForm);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRoom, setLoadingRoom] = useState(false);
  const [loadingRoomTypes, setLoadingRoomTypes] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: keyof RoomFormState, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const loadRoomTypes = async () => {
    try {
      setLoadingRoomTypes(true);
      const res = await api.get("/room-types");
      const data = res.data?.data ?? res.data;
      setRoomTypes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error loading room types", err);
      // no lo consideramos crítico, solo deja el select vacío
    } finally {
      setLoadingRoomTypes(false);
    }
  };

  const loadRoom = async () => {
    if (!id) return;
    const roomId = Number(id);
    if (Number.isNaN(roomId)) {
      setError("ID de habitación inválido.");
      return;
    }

    try {
      setLoadingRoom(true);
      setError(null);
      const res = await api.get(`/rooms/${roomId}`);
      const data = res.data?.data ?? res.data;

      setForm({
        number: data.number ?? "",
        floor: data.floor != null ? String(data.floor) : "",
        description: data.description ?? "",
        roomTypeId: data.roomType?.id != null ? String(data.roomType.id) : "",
      });
    } catch (err: any) {
      console.error("Error loading room", err);
      setError(
        err?.response?.data?.error ||
          "No se pudo cargar la habitación. Intenta nuevamente."
      );
    } finally {
      setLoadingRoom(false);
    }
  };

  useEffect(() => {
    loadRoomTypes();
  }, []);

  useEffect(() => {
    if (isEdit) {
      loadRoom();
    } else {
      setForm(emptyForm);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const validateForm = () => {
    if (!form.number.trim()) {
      setError("El número de habitación es obligatorio.");
      return false;
    }

    if (!form.floor.trim()) {
      setError("El piso es obligatorio.");
      return false;
    }

    const floorNumber = Number(form.floor);
    if (Number.isNaN(floorNumber) || !Number.isInteger(floorNumber)) {
      setError("El piso debe ser un número entero.");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) return;

    const payload: any = {
      number: form.number.trim(),
      floor: Number(form.floor),
    };

    if (form.description.trim()) payload.description = form.description.trim();
    if (form.roomTypeId) payload.roomTypeId = Number(form.roomTypeId);

    try {
      setLoading(true);

      if (isEdit && id) {
        const roomId = Number(id);
        await api.put(`/rooms/${roomId}`, payload);
      } else {
        await api.post("/rooms", payload);
      }

      navigate("/rooms");
    } catch (err: any) {
      console.error("Error saving room", err);
      setError(
        err?.response?.data?.error ||
          "No se pudo guardar la habitación. Revisa los datos e intenta nuevamente."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate("/rooms");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEdit ? "Editar habitación" : "Nueva habitación"}
        description={
          isEdit
            ? "Modifica los datos de la habitación seleccionada."
            : "Registra una nueva habitación en el sistema."
        }
        actions={
          <Button type="button" variant="ghost" onClick={handleCancel}>
            Volver a habitaciones
          </Button>
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

      <Card>
        <CardBody>
          {(loadingRoom && isEdit) ? (
            <p className="text-sm text-gray-500">Cargando datos...</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
              <p className="text-xs text-slate-500">
                Los campos marcados con * son obligatorios.
              </p>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Número de habitación *
                  </label>
                  <input
                    type="text"
                    value={form.number}
                    onChange={(e) => handleChange("number", e.target.value)}
                    className="mt-1 w-full border rounded px-3 py-2 text-sm"
                    placeholder="Ej: 101"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Piso *
                  </label>
                  <input
                    type="number"
                    value={form.floor}
                    onChange={(e) => handleChange("floor", e.target.value)}
                    className="mt-1 w-full border rounded px-3 py-2 text-sm"
                    placeholder="Ej: 1"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Tipo de habitación
                </label>
                <select
                  value={form.roomTypeId}
                  onChange={(e) => handleChange("roomTypeId", e.target.value)}
                  className="mt-1 w-full border rounded px-3 py-2 text-sm"
                  disabled={loading || loadingRoomTypes}
                >
                  <option value="">
                    {loadingRoomTypes
                      ? "Cargando tipos..."
                      : "Selecciona un tipo (opcional)"}
                  </option>
                  {roomTypes.map((rt) => (
                    <option key={rt.id} value={rt.id}>
                      {rt.name}{" "}
                      {rt.basePrice != null
                        ? `- base ${new Intl.NumberFormat("es-UY", {
                            style: "currency",
                            currency: "UYU",
                            minimumFractionDigits: 0,
                          }).format(rt.basePrice)}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Descripción
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    handleChange("description", e.target.value)
                  }
                  className="mt-1 w-full border rounded px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Ej: Habitación doble con vista al mar..."
                  disabled={loading}
                />
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleCancel}
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {isEdit ? "Guardar cambios" : "Crear habitación"}
                </Button>
              </div>
            </form>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
