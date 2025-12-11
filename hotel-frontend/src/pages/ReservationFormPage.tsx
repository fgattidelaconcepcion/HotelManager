import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/api";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

/* === Tipos básicos === */

interface Guest {
  id: number;
  name: string;
  email?: string | null;
}

interface RoomType {
  id: number;
  name: string;
  basePrice?: number | null;
}

interface Room {
  id: number;
  number: string;
  floor: number;
  description?: string | null;
  roomType?: RoomType | null;
}

interface Booking {
  id: number;
  roomId: number;
  guestId?: number | null;
  checkIn: string;
  checkOut: string;
  totalPrice?: number | null;
  status: string;
  room?: Room | null;
  guest?: Guest | null;
}

/* === Estado del formulario === */

interface BookingFormState {
  guestId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
}

const emptyForm: BookingFormState = {
  guestId: "",
  roomId: "",
  checkIn: "",
  checkOut: "",
};

export default function ReservationFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [form, setForm] = useState<BookingFormState>(emptyForm);

  const [guests, setGuests] = useState<Guest[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadingBooking, setLoadingBooking] = useState(false);
  const [loadingGuests, setLoadingGuests] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);

  const [error, setError] = useState<string | null>(null);

  /* === Helpers === */

  const handleChange = (field: keyof BookingFormState, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const formatDate = (value: string) => {
    try {
      return new Date(value).toLocaleDateString();
    } catch {
      return value;
    }
  };

  const formatCurrency = (value?: number | null) => {
    if (value == null) return "-";
    return new Intl.NumberFormat("es-UY", {
      style: "currency",
      currency: "UYU",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const calculateNights = (checkIn: string, checkOut: string): number | null => {
    if (!checkIn || !checkOut) return null;
    const ci = new Date(checkIn);
    const co = new Date(checkOut);
    if (Number.isNaN(ci.getTime()) || Number.isNaN(co.getTime())) return null;
    const diffDays = (co.getTime() - ci.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays <= 0) return null;
    return Math.round(diffDays) || 1;
  };

  /* === Datos derivados: reserva seleccionada / habitación / huésped / estimados === */

  const selectedGuest = useMemo(() => {
    if (!form.guestId) return null;
    const idNum = Number(form.guestId);
    if (Number.isNaN(idNum)) return null;
    return guests.find((g) => g.id === idNum) ?? null;
  }, [form.guestId, guests]);

  const selectedRoom = useMemo(() => {
    if (!form.roomId) return null;
    const idNum = Number(form.roomId);
    if (Number.isNaN(idNum)) return null;
    return rooms.find((r) => r.id === idNum) ?? null;
  }, [form.roomId, rooms]);

  const nights = useMemo(
    () => calculateNights(form.checkIn, form.checkOut),
    [form.checkIn, form.checkOut]
  );

  const suggestedTotal = useMemo(() => {
    if (!selectedRoom || !selectedRoom.roomType?.basePrice || !nights) return null;
    return selectedRoom.roomType.basePrice * nights;
  }, [selectedRoom, nights]);

  /* === Carga de datos === */

  const loadGuests = async () => {
    try {
      setLoadingGuests(true);
      const res = await api.get("/guests");
      const data = res.data?.data ?? res.data;
      setGuests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error loading guests for booking form", err);
    } finally {
      setLoadingGuests(false);
    }
  };

  const loadRooms = async () => {
    try {
      setLoadingRooms(true);
      const res = await api.get("/rooms");
      const data = res.data?.data ?? res.data;
      setRooms(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error loading rooms for booking form", err);
    } finally {
      setLoadingRooms(false);
    }
  };

  const loadBooking = async () => {
    if (!id) return;
    const bookingId = Number(id);
    if (Number.isNaN(bookingId)) {
      setError("ID de reserva inválido.");
      return;
    }

    try {
      setLoadingBooking(true);
      setError(null);
      const res = await api.get(`/bookings/${bookingId}`);
      const data: Booking = res.data?.data ?? res.data;

      setForm({
        guestId: data.guestId != null ? String(data.guestId) : "",
        roomId: data.roomId != null ? String(data.roomId) : "",
        checkIn: data.checkIn.slice(0, 10), // YYYY-MM-DD
        checkOut: data.checkOut.slice(0, 10),
      });
    } catch (err: any) {
      console.error("Error loading booking", err);
      setError(
        err?.response?.data?.error ||
          "No se pudo cargar la reserva. Intenta nuevamente."
      );
    } finally {
      setLoadingBooking(false);
    }
  };

  useEffect(() => {
    loadGuests();
    loadRooms();
  }, []);

  useEffect(() => {
    if (isEdit) {
      loadBooking();
    } else {
      setForm(emptyForm);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /* === Validación === */

  const validateForm = () => {
    if (!form.roomId.trim()) {
      setError("La habitación es obligatoria.");
      return false;
    }

    if (!form.guestId.trim()) {
      setError("El huésped es obligatorio.");
      return false;
    }

    if (!form.checkIn.trim() || !form.checkOut.trim()) {
      setError("Las fechas de check-in y check-out son obligatorias.");
      return false;
    }

    const nightsValue = calculateNights(form.checkIn, form.checkOut);
    if (!nightsValue || nightsValue <= 0) {
      setError("La fecha de check-out debe ser posterior al check-in.");
      return false;
    }

    return true;
  };

  /* === Submit === */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) return;

    const payload: any = {
      roomId: Number(form.roomId),
      guestId: Number(form.guestId),
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      // OJO: el backend calcula totalPrice y status,
      // así que NO los mandamos aquí para mantenerlo limpio.
    };

    try {
      setLoading(true);

      if (isEdit && id) {
        const bookingId = Number(id);
        await api.put(`/bookings/${bookingId}`, payload);
      } else {
        await api.post("/bookings", payload);
      }

      navigate("/reservations");
    } catch (err: any) {
      console.error("Error saving booking", err);
      setError(
        err?.response?.data?.error ||
          "No se pudo guardar la reserva. Revisa los datos e intenta nuevamente."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate("/reservations");
  };

  /* === UI === */

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEdit ? "Editar reserva" : "Nueva reserva"}
        description={
          isEdit
            ? "Modifica los datos de la reserva seleccionada."
            : "Crea una nueva reserva asignando huésped y habitación."
        }
        actions={
          <Button type="button" variant="ghost" onClick={handleCancel}>
            Volver a reservas
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
          {(loadingBooking && isEdit) ? (
            <p className="text-sm text-gray-500">Cargando datos...</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
              <p className="text-xs text-slate-500">
                Los campos marcados con * son obligatorios. El sistema
                calculará automáticamente el importe final según la tarifa base
                de la habitación y la cantidad de noches.
              </p>

              {/* Huésped + Habitación */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Huésped *
                  </label>
                  <select
                    value={form.guestId}
                    onChange={(e) => handleChange("guestId", e.target.value)}
                    className="mt-1 w-full border rounded px-3 py-2 text-sm"
                    disabled={loading || loadingGuests}
                  >
                    <option value="">
                      {loadingGuests
                        ? "Cargando huéspedes..."
                        : "Selecciona un huésped"}
                    </option>
                    {guests.map((g) => (
                      <option key={g.id} value={g.id}>
                        #{g.id} - {g.name}
                        {g.email ? ` (${g.email})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Habitación *
                  </label>
                  <select
                    value={form.roomId}
                    onChange={(e) => handleChange("roomId", e.target.value)}
                    className="mt-1 w-full border rounded px-3 py-2 text-sm"
                    disabled={loading || loadingRooms}
                  >
                    <option value="">
                      {loadingRooms
                        ? "Cargando habitaciones..."
                        : "Selecciona una habitación"}
                    </option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        Hab {r.number} (piso {r.floor})
                        {r.roomType
                          ? ` - ${r.roomType.name}${
                              r.roomType.basePrice != null
                                ? ` · base ${formatCurrency(
                                    r.roomType.basePrice
                                  )}`
                                : ""
                            }`
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Fechas */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Check-in *
                  </label>
                  <input
                    type="date"
                    value={form.checkIn}
                    onChange={(e) => handleChange("checkIn", e.target.value)}
                    className="mt-1 w-full border rounded px-3 py-2 text-sm"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Check-out *
                  </label>
                  <input
                    type="date"
                    value={form.checkOut}
                    onChange={(e) => handleChange("checkOut", e.target.value)}
                    className="mt-1 w-full border rounded px-3 py-2 text-sm"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Resumen dinámico de la selección */}
              {(selectedRoom || selectedGuest || nights || suggestedTotal) && (
                <div className="border rounded p-3 bg-slate-50 text-xs text-slate-700 space-y-1">
                  {selectedGuest && (
                    <p>
                      <span className="font-semibold">Huésped:</span>{" "}
                      {selectedGuest.name}
                      {selectedGuest.email ? ` (${selectedGuest.email})` : ""}
                    </p>
                  )}

                  {selectedRoom && (
                    <p>
                      <span className="font-semibold">Habitación:</span>{" "}
                      Hab {selectedRoom.number} (piso {selectedRoom.floor}){" "}
                      {selectedRoom.roomType
                        ? `· ${selectedRoom.roomType.name}`
                        : ""}
                    </p>
                  )}

                  {selectedRoom?.roomType?.basePrice != null && (
                    <p>
                      <span className="font-semibold">Tarifa base:</span>{" "}
                      {formatCurrency(selectedRoom.roomType.basePrice)} por noche
                    </p>
                  )}

                  {nights && (
                    <p>
                      <span className="font-semibold">Noches:</span> {nights}{" "}
                      ({form.checkIn && formatDate(form.checkIn)} →{" "}
                      {form.checkOut && formatDate(form.checkOut)})
                    </p>
                  )}

                  {suggestedTotal != null && (
                    <p>
                      <span className="font-semibold">
                        Importe estimado de reserva:
                      </span>{" "}
                      {formatCurrency(suggestedTotal)}
                      <span className="text-slate-500">
                        {" "}
                        (se recalcula en el backend al guardar)
                      </span>
                    </p>
                  )}
                </div>
              )}

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
                  {isEdit ? "Guardar cambios" : "Crear reserva"}
                </Button>
              </div>
            </form>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
