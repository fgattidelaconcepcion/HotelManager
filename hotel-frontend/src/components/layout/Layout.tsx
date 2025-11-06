import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface Props {
  children: ReactNode;
}

export default function Layout({ children }: Props) {
  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 text-white p-5 space-y-4">
        <h1 className="text-xl font-bold mb-6">🏨 Hotel Manager</h1>
        <nav className="flex flex-col gap-2">
          <Link to="/" className="hover:bg-gray-700 p-2 rounded">Inicio</Link>
          <Link to="/rooms" className="hover:bg-gray-700 p-2 rounded">Habitaciones</Link>
          <Link to="/guests" className="hover:bg-gray-700 p-2 rounded">Huéspedes</Link>
          <Link to="/reservations" className="hover:bg-gray-700 p-2 rounded">Reservas</Link>
          <Link to="/payments" className="hover:bg-gray-700 p-2 rounded">Pagos</Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-gray-100 p-8">
        {children}
      </main>
    </div>
  );
}
