import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/api";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { toast } from "sonner";


/* === Basic types === */

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

/* === Form state === */

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
    return new Intl.NumberFormat("en-UY", {
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

  /* === Derived data: selected booking / room / guest / estimates === */

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

  /* === Data loading === */

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
      setError("Invalid booking ID.");
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
          "Could not load the booking. Please try again."
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

  /* === Validation === */

  const validateForm = () => {
    if (!form.roomId.trim()) {
      setError("Room is required.");
      return false;
    }

    if (!form.guestId.trim()) {
      setError("Guest is required.");
      return false;
    }

    if (!form.checkIn.trim() || !form.checkOut.trim()) {
      setError("Check-in and check-out dates are required.");
      return false;
    }

    const nightsValue = calculateNights(form.checkIn, form.checkOut);
    if (!nightsValue || nightsValue <= 0) {
      setError("Check-out date must be later than check-in.");
      return false;
    }

    return true;
  };

  /* === Submit === */

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError(null);

  // Solo validación local acá
  if (!validateForm()) {
    toast.warning(error ?? "Please review the form.");
    return;
  }

  const payload = {
    roomId: Number(form.roomId),
    guestId: Number(form.guestId),
    checkIn: form.checkIn,
    checkOut: form.checkOut,
  };

  try {
    setLoading(true);

    if (isEdit && id) {
      const bookingId = Number(id);
      await api.put(`/bookings/${bookingId}`, payload);
      toast.success("Booking updated successfully");
    } else {
      await api.post("/bookings", payload);
      toast.success("Booking created successfully");
    }

    navigate("/reservations");
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
        title={isEdit ? "Edit booking" : "New booking"}
        description={
          isEdit
            ? "Edit the details of the selected booking."
            : "Create a new booking by assigning a guest and room."
        }
        actions={
          <Button type="button" variant="ghost" onClick={handleCancel}>
            Back to reservations
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
            <p className="text-sm text-gray-500">Loading data...</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
              <p className="text-xs text-slate-500">
                Fields marked with * are required. The system will automatically
                calculate the final amount based on the room’s base rate and the
                number of nights.
              </p>

              {/* Guest + Room */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Guest *
                  </label>
                  <select
                    value={form.guestId}
                    onChange={(e) => handleChange("guestId", e.target.value)}
                    className="mt-1 w-full border rounded px-3 py-2 text-sm"
                    disabled={loading || loadingGuests}
                  >
                    <option value="">
                      {loadingGuests ? "Loading guests..." : "Select a guest"}
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
                    Room *
                  </label>
                  <select
                    value={form.roomId}
                    onChange={(e) => handleChange("roomId", e.target.value)}
                    className="mt-1 w-full border rounded px-3 py-2 text-sm"
                    disabled={loading || loadingRooms}
                  >
                    <option value="">
                      {loadingRooms ? "Loading rooms..." : "Select a room"}
                    </option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        Room {r.number} (floor {r.floor})
                        {r.roomType
                          ? ` - ${r.roomType.name}${
                              r.roomType.basePrice != null
                                ? ` · base ${formatCurrency(r.roomType.basePrice)}`
                                : ""
                            }`
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dates */}
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

              {/* Dynamic summary of selection */}
              {(selectedRoom || selectedGuest || nights || suggestedTotal) && (
                <div className="border rounded p-3 bg-slate-50 text-xs text-slate-700 space-y-1">
                  {selectedGuest && (
                    <p>
                      <span className="font-semibold">Guest:</span>{" "}
                      {selectedGuest.name}
                      {selectedGuest.email ? ` (${selectedGuest.email})` : ""}
                    </p>
                  )}

                  {selectedRoom && (
                    <p>
                      <span className="font-semibold">Room:</span> Room{" "}
                      {selectedRoom.number} (floor {selectedRoom.floor}){" "}
                      {selectedRoom.roomType ? `· ${selectedRoom.roomType.name}` : ""}
                    </p>
                  )}

                  {selectedRoom?.roomType?.basePrice != null && (
                    <p>
                      <span className="font-semibold">Base rate:</span>{" "}
                      {formatCurrency(selectedRoom.roomType.basePrice)} per night
                    </p>
                  )}

                  {nights && (
                    <p>
                      <span className="font-semibold">Nights:</span> {nights} (
                      {form.checkIn && formatDate(form.checkIn)} →{" "}
                      {form.checkOut && formatDate(form.checkOut)})
                    </p>
                  )}

                  {suggestedTotal != null && (
                    <p>
                      <span className="font-semibold">Estimated total amount:</span>{" "}
                      {formatCurrency(suggestedTotal)}
                      <span className="text-slate-500">
                        {" "}
                        (recalculated in backend upon save)
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
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {isEdit ? "Save changes" : "Create booking"}
                </Button>
              </div>
            </form>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
