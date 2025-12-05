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
  roomType: RoomType;
}

interface Guest {
  id: number;
  name: string;
  email?: string;
  phone?: string;
}

interface User {
  id: number;
  name: string;
  email: string;
}

interface Booking {
  id: number;
  roomId: number;
  guestId: number | null;
  userId: number | null;
  checkIn: string;
  checkOut: string;
  totalPrice: number;
  status: string;
  room?: Room;
  guest?: Guest | null;
  user?: User | null;
}

export default function Reservations() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const res = await api.get("/bookings");
      const data = res.data?.data;
      if (Array.isArray(data)) {
        setBookings(data);
      } else {
        setBookings([]);
      }
    } catch (e) {
      console.error("Error fetching bookings:", e);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("es-UY", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("es-UY", {
      style: "currency",
      currency: "UYU",
      minimumFractionDigits: 0,
    }).format(value);

  return (
    <div className="text-white">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Reservas</h1>
        {/* Más adelante acá va el botón de "Nueva reserva" */}
      </div>

      {loading && <p className="mb-2 text-gray-300">Cargando reservas...</p>}

      <table className="min-w-full bg-gray-800 rounded-lg overflow-hidden">
        <thead>
          <tr>
            <th className="p-2">#</th>
            <th className="p-2">Habitación</th>
            <th className="p-2">Huésped</th>
            <th className="p-2">Check-in</th>
            <th className="p-2">Check-out</th>
            <th className="p-2">Noches</th>
            <th className="p-2">Total</th>
            <th className="p-2">Estado</th>
          </tr>
        </thead>

        <tbody>
          {bookings.map((b) => {
            const checkInDate = new Date(b.checkIn);
            const checkOutDate = new Date(b.checkOut);
            const nights = Math.max(
              1,
              Math.round(
                (checkOutDate.getTime() - checkInDate.getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            );

            return (
              <tr key={b.id} className="border-t border-gray-700">
                <td className="p-2">{b.id}</td>
                <td className="p-2">
                  {b.room
                    ? `#${b.room.number} (${b.room.roomType?.name})`
                    : `Hab. ${b.roomId}`}
                </td>
                <td className="p-2">
                  {b.guest?.name ?? "Sin huésped asignado"}
                </td>
                <td className="p-2">{formatDate(b.checkIn)}</td>
                <td className="p-2">{formatDate(b.checkOut)}</td>
                <td className="p-2 text-center">{nights}</td>
                <td className="p-2">{formatCurrency(b.totalPrice)}</td>
                <td className="p-2 capitalize">{b.status}</td>
              </tr>
            );
          })}

          {bookings.length === 0 && !loading && (
            <tr>
              <td className="p-4 text-center text-gray-400" colSpan={8}>
                No hay reservas cargadas todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
