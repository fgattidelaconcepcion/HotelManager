import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();

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
          "There was an error loading guests. Please try again."
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

  const formatDate = (value?: string | null) => {
    if (!value) return "-";
    try {
      return new Date(value).toLocaleDateString("en-US");
    } catch {
      return value;
    }
  };

  const handleDelete = async (guest: Guest) => {
    const ok = window.confirm(
      `Are you sure you want to delete guest "${guest.name}" (ID ${guest.id})?`
    );
    if (!ok) return;

    try {
      setLoading(true);
      setError(null);
      await api.delete(`/guests/${guest.id}`);
      await loadGuests();
    } catch (err: any) {
      console.error("Error deleting guest", err);
      setError(
        err?.response?.data?.error ||
          "Could not delete the guest. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Guests"
        description="Manage your hotel guests."
        actions={
          <Button onClick={() => navigate("/guests/new")}>New guest</Button>
        }
      />

      {/* Summary */}
      <Card>
        <CardBody>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-xs text-slate-500">Total guests</p>
              <p className="text-lg font-semibold mt-1">{totalGuests}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">With email</p>
              <p className="text-lg font-semibold mt-1">{guestsWithEmail}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">With phone</p>
              <p className="text-lg font-semibold mt-1">{guestsWithPhone}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Last updated</p>
              <p className="text-sm mt-1 text-slate-600">
                {formatDate(
                  guests
                    .slice()
                    .sort(
                      (a, b) =>
                        new Date(b.updatedAt ?? b.createdAt ?? "").getTime() -
                        new Date(a.updatedAt ?? a.createdAt ?? "").getTime()
                    )[0]?.updatedAt
                )}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Filters */}
      <Card>
        <CardBody>
          <form className="flex flex-wrap gap-4 items-end">
            <div className="flex flex-col">
              <label className="text-sm font-medium text-slate-700">
                Search
              </label>
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="mt-1 border rounded px-3 py-2 text-sm w-64"
                placeholder="Name, email, phone, document..."
              />
            </div>

            <div className="flex items-center gap-4 mt-6">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={onlyWithEmail}
                  onChange={(e) => setOnlyWithEmail(e.target.checked)}
                  className="h-4 w-4"
                />
                Only with email
              </label>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={onlyWithPhone}
                  onChange={(e) => setOnlyWithPhone(e.target.checked)}
                  className="h-4 w-4"
                />
                Only with phone
              </label>
            </div>

            <div className="flex gap-2 mt-4 md:mt-6">
              <Button type="button" variant="secondary" onClick={loadGuests}>
                Refresh
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
                Clear filters
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {/* Status messages */}
      {error && (
        <Card>
          <CardBody>
            <div className="bg-red-50 text-red-800 px-4 py-2 rounded text-sm">
              {error}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Guests table */}
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
                    Name
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">
                    Email
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">
                    Phone
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">
                    Document
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">
                    Address
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-slate-700">
                    Actions
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
                      No guests match your filters.
                    </td>
                  </tr>
                )}

                {filteredGuests.map((g) => (
                  <tr key={g.id} className="border-t last:border-b">
                    <td className="px-4 py-2 align-top">{g.id}</td>
                    <td className="px-4 py-2 align-top">{g.name}</td>
                    <td className="px-4 py-2 align-top">{g.email || "-"}</td>
                    <td className="px-4 py-2 align-top">{g.phone || "-"}</td>
                    <td className="px-4 py-2 align-top">
                      {g.documentNumber || "-"}
                    </td>
                    <td className="px-4 py-2 align-top">{g.address || "-"}</td>
                    <td className="px-4 py-2 align-top text-right space-x-2">
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-xs px-3 py-1"
                        onClick={() => navigate(`/guests/${g.id}`)}
                      >
                        View / Edit
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        className="text-xs px-3 py-1"
                        onClick={() => handleDelete(g)}
                        disabled={loading}
                      >
                        Delete
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
                      Loading...
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
