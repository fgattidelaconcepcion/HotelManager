import { useEffect, useMemo, useState } from "react";
import api from "../api/api";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

export interface Guest {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  documentNumber?: string | null;
  address?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export default function Guests() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchText, setSearchText] = useState("");
  const [onlyWithEmail, setOnlyWithEmail] = useState(false);
  const [onlyWithPhone, setOnlyWithPhone] = useState(false);

  const loadGuests = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get("/guests");
      const data = res.data?.data ?? res.data;
      setGuests(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Error loading guests", err);
      setError(
        err?.response?.data?.error ||
          "Hubo un error al cargar los huéspedes. Intenta nuevamente."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGuests();
  }, []);

  const filteredGuests = useMemo(() => {
    return guests.filter((g) => {
      let ok = true;

      if (searchText.trim()) {
        const text = searchText.toLowerCase();
        const name = g.name?.toLowerCase() || "";
        const email = g.email?.toLowerCase() || "";
        const phone = g.phone?.toLowerCase() || "";
        const doc = g.documentNumber?.toLowerCase() || "";

        ok =
          ok &&
          (name.includes(text) ||
            email.includes(text) ||
            phone.includes(text) ||
            doc.includes(text) ||
            String(g.id).includes(text));
      }

      if (onlyWithEmail) {
        ok = ok && !!g.email;
      }

      if (onlyWithPhone) {
        ok = ok && !!g.phone;
      }

      return ok;
    });
  }, [guests, searchText, onlyWithEmail, onlyWithPhone]);

  const totalGuests = guests.length;
  const guestsWithEmail = guests.filter((g) => !!g.email).length;
  const guestsWithPhone = guests.filter((g) => !!g.phone).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Huéspedes"
        description="Gestiona los huéspedes del hotel."
        actions={
          <Button disabled className="opacity-70 cursor-not-allowed">
            Nuevo huésped (pronto)
          </Button>
        }
      />

      {/* Resumen */}
      <Card>
        <CardBody>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs text-slate-500">Total de huéspedes</p>
              <p className="text-lg font-semibold mt-1">{totalGuests}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Con email registrado</p>
              <p className="text-lg font-semibold mt-1">
                {guestsWithEmail}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Con teléfono registrado</p>
              <p className="text-lg font-semibold mt-1">
                {guestsWithPhone}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Filtros */}
      <Card>
        <CardBody>
          <form className="flex flex-wrap gap-4 items-end">
            <div className="flex flex-col">
              <label className="text-sm font-medium text-slate-700">
                Buscar
              </label>
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="mt-1 border rounded px-3 py-2 text-sm w-64"
                placeholder="Nombre, email, teléfono, documento..."
              />
            </div>

            <div className="flex items-center gap-2 mt-6">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={onlyWithEmail}
                  onChange={(e) => setOnlyWithEmail(e.target.checked)}
                  className="h-4 w-4"
                />
                Solo con email
              </label>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={onlyWithPhone}
                  onChange={(e) => setOnlyWithPhone(e.target.checked)}
                  className="h-4 w-4"
                />
                Solo con teléfono
              </label>
            </div>

            <div className="flex gap-2 mt-4 md:mt-6">
              <Button type="button" variant="secondary" onClick={loadGuests}>
                Refrescar
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setSearchText("");
                  setOnlyWithEmail(false);
                  setOnlyWithPhone(false);
                }}
              >
                Limpiar filtros
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {/* Mensajes de estado */}
      {error && (
        <Card>
          <CardBody>
            <div className="bg-red-50 text-red-800 px-4 py-2 rounded text-sm">
              {error}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Tabla de huéspedes */}
      <Card>
        <CardBody>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">
                    ID
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">
                    Nombre
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">
                    Email
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">
                    Teléfono
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">
                    Documento
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">
                    Dirección
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-slate-700">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredGuests.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-6 text-center text-slate-500"
                    >
                      No hay huéspedes que coincidan con los filtros.
                    </td>
                  </tr>
                )}

                {filteredGuests.map((g) => (
                  <tr key={g.id} className="border-t last:border-b">
                    <td className="px-4 py-2 align-top">{g.id}</td>
                    <td className="px-4 py-2 align-top">{g.name}</td>
                    <td className="px-4 py-2 align-top">
                      {g.email || "-"}
                    </td>
                    <td className="px-4 py-2 align-top">
                      {g.phone || "-"}
                    </td>
                    <td className="px-4 py-2 align-top">
                      {g.documentNumber || "-"}
                    </td>
                    <td className="px-4 py-2 align-top">
                      {g.address || "-"}
                    </td>
                    <td className="px-4 py-2 align-top text-right space-x-2">
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-xs px-3 py-1"
                        disabled
                      >
                        Ver
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-xs px-3 py-1"
                        disabled
                      >
                        Editar
                      </Button>
                    </td>
                  </tr>
                ))}

                {loading && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-4 text-center text-slate-500"
                    >
                      Cargando...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
