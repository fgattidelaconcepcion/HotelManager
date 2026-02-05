import React, { useMemo } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

type NavItem = {
  to: string;
  label: string;
  exact?: boolean;
  roles?: Array<"admin" | "receptionist">; 
};

function roleLabel(role: string | undefined) {
  if (role === "admin") return "Admin";
  if (role === "receptionist") return "Receptionist";
  return "User";
}

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const navItems: NavItem[] = useMemo(
    () => [
      { to: "/", label: "Dashboard", exact: true, roles: ["admin", "receptionist"] },
      { to: "/rooms", label: "Rooms", roles: ["admin", "receptionist"] },
      { to: "/guests", label: "Guests", roles: ["admin", "receptionist"] },
      { to: "/reservations", label: "Reservations", roles: ["admin", "receptionist"] },

  
      { to: "/payments", label: "Payments", roles: ["admin", "receptionist"] },
    ],
    []
  );

  const visibleItems = useMemo(() => {
    const role = user?.role;
    return navItems.filter((item) => {
      if (!item.roles || item.roles.length === 0) return true;
      if (!role) return false;
      return item.roles.includes(role);
    });
  }, [navItems, user?.role]);

  const currentSection = useMemo(() => {
    const path = location.pathname;
    if (path === "/" || path === "") return "Dashboard";
    const match = navItems.find((i) => i.to !== "/" && path.startsWith(i.to));
    return match?.label ?? "Dashboard";
  }, [location.pathname, navItems]);

  const handleLogout = () => {
    logout();
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
              <p className="text-sm font-semibold">Hotel Manager</p>
              <p className="text-xs text-slate-400">Admin panel</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {visibleItems.map((item) => (
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

        {/* Footer sidebar: user + logout */}
        <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-between gap-3 text-xs text-slate-400">
          <div className="min-w-0">
            <p>Signed in</p>
            <p className="font-medium text-slate-200 truncate">
              {user?.name ?? "User"}
            </p>
            <p className="text-[11px] text-slate-400 truncate">
              {user?.email ?? "-"} · {roleLabel(user?.role)}
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="text-xs px-3 py-1 rounded-md border border-slate-600 text-slate-200 hover:bg-slate-800 hover:text-white transition shrink-0"
          >
            Log out
          </button>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6">
          <div className="text-sm text-slate-500">
            HotelManager /{" "}
            <span className="font-medium text-slate-700">{currentSection}</span>
          </div>

          <div className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700 border">
            {roleLabel(user?.role)}
          </div>
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
