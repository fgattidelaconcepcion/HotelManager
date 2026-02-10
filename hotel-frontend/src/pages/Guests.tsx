import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import RoleGate from "../auth/RoleGate";
import { toast } from "sonner";

/**
 * Here I define the data shape I expect from the backend.
 * I keep fields optional because some can be null in the DB.
 */
export interface Guest {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  documentNumber?: string | null;
  address?: string | null;

  // Here I include the new field used by the police report snapshot.
  nationality?: string | null;

  createdAt?: string;
  updatedAt?: string;
}

/**
 * Guests page
 * - I list guests
 * - I filter by search + checkboxes
 * - I navigate to create/edit pages
 * - I allow delete only for admin
 */
export default function Guests() {
  const navigate = useNavigate();

  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchText, setSearchText] = useState("");
  const [onlyWithEmail, setOnlyWithEmail] = useState(false);
  const [onlyWithPhone, setOnlyWithPhone] = useState(false);

  /**
   * Here I load the guests from the API.
   * IMPORTANT: I expect GET /guests to return { success, data: [...] }.
   */
  const loadGuests = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await api.get("/guests");
      const data = res.data?.data ?? res.data;

      setGuests(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Error loading guests", err);

      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "There was an error loading guests. Please try again.";

      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Here I load the list on first render.
   */
  useEffect(() => {
    loadGuests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Here I compute a filtered list based on the UI filters.
   */
  const filteredGuests = useMemo(() => {
    return guests.filter((g) => {
      let ok = true;

      if (searchText.trim()) {
        const text = searchText.toLowerCase();

        const name = (g.name ?? "").toLowerCase();
        const email = (g.email ?? "").toLowerCase();
        const phone = (g.phone ?? "").toLowerCase();
        const doc = (g.documentNumber ?? "").toLowerCase();
        const nat = (g.nationality ?? "").toLowerCase();

        ok =
          ok &&
          (name.includes(text) ||
            email.includes(text) ||
            phone.includes(text) ||
            doc.includes(text) ||
            nat.includes(text) ||
            String(g.id).includes(text));
      }

      if (onlyWithEmail) ok = ok && !!g.email;
      if (onlyWithPhone) ok = ok && !!g.phone;

      return ok;
    });
  }, [guests, searchText, onlyWithEmail, onlyWithPhone]);

  const totalGuests = guests.length;
  const guestsWithEmail = useMemo(
    () => guests.filter((g) => !!g.email).length,
    [guests]
  );
  const guestsWithPhone = useMemo(
    () => guests.filter((g) => !!g.phone).length,
    [guests]
  );

  /**
   * Here I show a safe date formatting helper.
   */
  const formatDate = (value?: string | null) => {
    if (!value) return "-";
    try {
      return new Date(value).toLocaleDateString("en-US");
    } catch {
      return value;
    }
  };

  /**
   * Here I compute the "last updated" value.
   */
  const lastUpdated = useMemo(() => {
    const sorted = guests
      .slice()
      .sort(
        (a, b) =>
          new Date(b.updatedAt ?? b.createdAt ?? 0).getTime() -
          new Date(a.updatedAt ?? a.createdAt ?? 0).getTime()
      );
    return sorted[0]?.updatedAt ?? sorted[0]?.createdAt ?? null;
  }, [guests]);

  /**
   * Here I handle guest delete (admin only).
   */
  const handleDelete = async (guest: Guest) => {
    const ok = window.confirm(
      `Are you sure you want to delete guest "${guest.name}" (ID ${guest.id})?`
    );
    if (!ok) return;

    try {
      setLoading(true);
      setError(null);

      await api.delete(`/guests/${guest.id}`);

      toast.success("Guest deleted successfully.");
      await loadGuests();
    } catch (err: any) {
      console.error("Error deleting guest", err);

      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Could not delete the guest. Please try again.";

      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Here I navigate to the NEW guest page.
   * This requires a route: /guests/new => GuestFormPage
   */
  const goToNewGuest = () => navigate("/guests/new");

  /**
   * Here I navigate to the EDIT guest page.
   * This requires a route: /guests/:id => GuestFormPage
   */
  const goToEditGuest = (id: number) => navigate(`/guests/${id}`);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Guests"
        description="Manage your hotel guests."
        actions={
          <Button onClick={goToNewGuest} disabled={loading}>
            New guest
          </Button>
        }
      />

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
                {formatDate(lastUpdated)}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

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
                className="mt-1 border rounded px-3 py-2 text-sm w-72"
                placeholder="Name, email, phone, document, nationality..."
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
              <Button
                type="button"
                variant="secondary"
                onClick={loadGuests}
                disabled={loading}
              >
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
                disabled={loading}
              >
                Clear filters
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

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
                    Nationality
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
                      colSpan={8}
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
                    <td className="px-4 py-2 align-top">
                      {g.nationality || "-"}
                    </td>
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
                        onClick={() => goToEditGuest(g.id)}
                        disabled={loading}
                        title="Open guest form to view or edit."
                      >
                        View / Edit
                      </Button>

                      {/* Here I only show delete for admin. */}
                      <RoleGate allowed={["admin"]}>
                        <Button
                          type="button"
                          variant="danger"
                          className="text-xs px-3 py-1"
                          onClick={() => handleDelete(g)}
                          disabled={loading}
                        >
                          Delete
                        </Button>
                      </RoleGate>
                    </td>
                  </tr>
                ))}

                {loading && (
                  <tr>
                    <td
                      colSpan={8}
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
