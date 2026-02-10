import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/api";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { toast } from "sonner";
import axios from "axios";

/**
 * Here I define the local form state for the Guest form.
 * I keep everything as strings for a smooth UX and I trim before sending to the API.
 */
interface GuestFormState {
  name: string;
  email: string;
  phone: string;

  // Identity fields (used by police report snapshots)
  documentType: string;
  documentNumber: string;
  nationality: string;
  birthDate: string; // YYYY-MM-DD
  gender: string;

  // Address fields
  address: string;
  city: string;
  country: string;
}

/**
 * Here I define a clean empty form template, used for "New guest".
 */
const emptyForm: GuestFormState = {
  name: "",
  email: "",
  phone: "",

  documentType: "",
  documentNumber: "",
  nationality: "",
  birthDate: "",
  gender: "",

  address: "",
  city: "",
  country: "",
};

/**
 * Here I map API / Axios errors to a friendly message for the UI.
 */
function mapApiError(err: unknown) {
  if (axios.isAxiosError(err)) {
    return (
      (err.response?.data as any)?.error ||
      (err.response?.data as any)?.message ||
      err.message ||
      "Request failed. Please try again."
    );
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong. Please try again.";
}

/**
 * Here I parse a date string and return ISO DateTime or null.
 * I store birthDate in DB as DateTime, but the form uses YYYY-MM-DD.
 */
function toIsoDateOrNull(dateStr: string) {
  const d = dateStr.trim();
  if (!d) return null;
  // Here I force UTC noon to avoid timezone shifting issues.
  const iso = new Date(`${d}T12:00:00.000Z`);
  if (Number.isNaN(iso.getTime())) return null;
  return iso.toISOString();
}

export default function GuestFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Here I detect the mode based on the route param.
  const isEdit = !!id;

  const [form, setForm] = useState<GuestFormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [loadingGuest, setLoadingGuest] = useState(false);

  // Here I keep an inline error for validations / load errors.
  const [error, setError] = useState<string | null>(null);

  /**
   * Here I update a single form field in a type-safe way.
   */
  const handleChange = (field: keyof GuestFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  /**
   * Here I load an existing guest when I'm editing.
   */
  const loadGuest = async () => {
    if (!id) return;

    const guestId = Number(id);
    if (Number.isNaN(guestId) || guestId <= 0) {
      setError("Invalid guest ID.");
      return;
    }

    try {
      setLoadingGuest(true);
      setError(null);

      const res = await api.get(`/guests/${guestId}`);
      const guest = res.data?.guest ?? res.data?.data ?? res.data;

      // Here I hydrate the form state with safe fallbacks.
      setForm({
        name: guest?.name ?? "",
        email: guest?.email ?? "",
        phone: guest?.phone ?? "",

        documentType: guest?.documentType ?? "",
        documentNumber: guest?.documentNumber ?? "",
        nationality: guest?.nationality ?? "",

        // Here I convert ISO DateTime -> YYYY-MM-DD for <input type="date">
        birthDate: guest?.birthDate ? String(guest.birthDate).slice(0, 10) : "",
        gender: guest?.gender ?? "",

        address: guest?.address ?? "",
        city: guest?.city ?? "",
        country: guest?.country ?? "",
      });
    } catch (err) {
      setError(mapApiError(err));
    } finally {
      setLoadingGuest(false);
    }
  };

  /**
   * Here I load the guest on route param changes.
   * If I'm creating a new guest, I reset the form.
   */
  useEffect(() => {
    if (isEdit) {
      loadGuest();
    } else {
      setForm(emptyForm);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /**
   * Here I validate the form before sending to the API.
   * - Name is required
   * - Email format is validated if provided
   */
  const validateForm = () => {
    const name = form.name.trim();
    const email = form.email.trim();

    if (!name) {
      setError("Name is required.");
      return false;
    }

    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      setError("Email format is not valid.");
      return false;
    }

    setError(null);
    return true;
  };

  /**
   * Here I submit the form:
   * - create => POST /guests
   * - edit   => PUT  /guests/:id
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.warning("Please review the form.");
      return;
    }

    // Here I build a clean payload and only send non-empty optional fields.
    const payload: any = {
      name: form.name.trim(),
    };

    if (form.email.trim()) payload.email = form.email.trim();
    if (form.phone.trim()) payload.phone = form.phone.trim();

    if (form.documentType.trim()) payload.documentType = form.documentType.trim();
    if (form.documentNumber.trim()) payload.documentNumber = form.documentNumber.trim();
    if (form.nationality.trim()) payload.nationality = form.nationality.trim();
    if (form.gender.trim()) payload.gender = form.gender.trim();

    if (form.address.trim()) payload.address = form.address.trim();
    if (form.city.trim()) payload.city = form.city.trim();
    if (form.country.trim()) payload.country = form.country.trim();

    const birthDateIso = toIsoDateOrNull(form.birthDate);
    if (birthDateIso) payload.birthDate = birthDateIso;

    try {
      setLoading(true);

      if (isEdit && id) {
        const guestId = Number(id);
        await api.put(`/guests/${guestId}`, payload);
        toast.success("Guest updated successfully");
      } else {
        await api.post("/guests", payload);
        toast.success("Guest created successfully");
      }

      navigate("/guests");
    } catch (err) {
      const message = mapApiError(err);
      toast.error(message);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Here I provide a safe "cancel/back" action.
   */
  const handleCancel = () => navigate("/guests");

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEdit ? "Edit guest" : "New guest"}
        description={
          isEdit
            ? "Update the selected guest information."
            : "Register a new guest in the system."
        }
        actions={
          <Button type="button" variant="ghost" onClick={handleCancel}>
            Back to guests
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
          {loadingGuest && isEdit ? (
            <p className="text-sm text-gray-500">Loading data...</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
              <p className="text-xs text-slate-500">Fields marked with * are required.</p>

              {/* BASIC */}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    className="mt-1 w-full border rounded px-3 py-2 text-sm"
                    disabled={loading}
                    autoComplete="name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    className="mt-1 w-full border rounded px-3 py-2 text-sm"
                    disabled={loading}
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Phone</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    className="mt-1 w-full border rounded px-3 py-2 text-sm"
                    disabled={loading}
                    autoComplete="tel"
                  />
                </div>
              </div>

              {/* IDENTITY */}
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-800">Identity (for police report)</h3>
                <div className="grid gap-4 md:grid-cols-2 mt-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Document type</label>
                    <input
                      type="text"
                      value={form.documentType}
                      onChange={(e) => handleChange("documentType", e.target.value)}
                      className="mt-1 w-full border rounded px-3 py-2 text-sm"
                      disabled={loading}
                      placeholder="e.g., ID / Passport"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Document number</label>
                    <input
                      type="text"
                      value={form.documentNumber}
                      onChange={(e) => handleChange("documentNumber", e.target.value)}
                      className="mt-1 w-full border rounded px-3 py-2 text-sm"
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Nationality</label>
                    <input
                      type="text"
                      value={form.nationality}
                      onChange={(e) => handleChange("nationality", e.target.value)}
                      className="mt-1 w-full border rounded px-3 py-2 text-sm"
                      disabled={loading}
                      placeholder="e.g., Uruguayan"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Birth date</label>
                    <input
                      type="date"
                      value={form.birthDate}
                      onChange={(e) => handleChange("birthDate", e.target.value)}
                      className="mt-1 w-full border rounded px-3 py-2 text-sm"
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Gender</label>
                    <input
                      type="text"
                      value={form.gender}
                      onChange={(e) => handleChange("gender", e.target.value)}
                      className="mt-1 w-full border rounded px-3 py-2 text-sm"
                      disabled={loading}
                      placeholder="e.g., Male / Female"
                    />
                  </div>
                </div>
              </div>

              {/* ADDRESS */}
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-800">Address</h3>
                <div className="grid gap-4 md:grid-cols-2 mt-3">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Address</label>
                    <input
                      type="text"
                      value={form.address}
                      onChange={(e) => handleChange("address", e.target.value)}
                      className="mt-1 w-full border rounded px-3 py-2 text-sm"
                      disabled={loading}
                      autoComplete="street-address"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">City</label>
                    <input
                      type="text"
                      value={form.city}
                      onChange={(e) => handleChange("city", e.target.value)}
                      className="mt-1 w-full border rounded px-3 py-2 text-sm"
                      disabled={loading}
                      autoComplete="address-level2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Country</label>
                    <input
                      type="text"
                      value={form.country}
                      onChange={(e) => handleChange("country", e.target.value)}
                      className="mt-1 w-full border rounded px-3 py-2 text-sm"
                      disabled={loading}
                      autoComplete="country-name"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <Button type="button" variant="ghost" onClick={handleCancel} disabled={loading}>
                  Cancel
                </Button>

                <Button type="submit" disabled={loading}>
                  {isEdit ? "Save changes" : "Create guest"}
                </Button>
              </div>
            </form>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
