import { NavLink, Outlet, useNavigate } from "react-router-dom";

const navItems = [
  { to: "/", label: "Dashboard", exact: true },
  { to: "/rooms", label: "Habitaciones" },
  { to: "/guests", label: "Huéspedes" },
  { to: "/reservations", label: "Reservas" },
  { to: "/payments", label: "Pagos" },
];

export default function Layout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-500 flex items-center justify-center text-sm font-bold">
              HM
            </div>
            <div>
              <p className="text-sm font-semibold">HotelManager</p>
              <p className="text-xs text-slate-400">Panel de administración</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) =>
                [
                  "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition",
                  isActive
                    ? "bg-slate-800 text-white"
                    : "text-slate-200 hover:bg-slate-800/60 hover:text-white",
                ].join(" ")
              }
            >
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer sidebar: info + logout */}
        <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-between gap-2 text-xs text-slate-400">
          <div>
            <p>Sesión iniciada</p>
            <p className="font-medium text-slate-200">Usuario</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs px-3 py-1 rounded-md border border-slate-600 text-slate-200 hover:bg-slate-800 hover:text-white transition"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6">
          <div className="text-sm text-slate-500">
            HotelManager /{" "}
            <span className="font-medium text-slate-700">Panel</span>
          </div>
          {/* acá más adelante podés poner menú de usuario */}
        </header>

        <main className="flex-1 p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
