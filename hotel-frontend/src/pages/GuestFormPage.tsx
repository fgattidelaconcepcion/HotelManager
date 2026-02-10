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
  documentNumber: string;
  address: string;

  // Here I add nationality as requested (used by police report / guest profile).
  nationality: string;
}

/**
 * Here I define a clean empty form template, used for "New guest".
 */
const emptyForm: GuestFormState = {
  name: "",
  email: "",
  phone: "",
  documentNumber: "",
  address: "",
  nationality: "",
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
 * GuestFormPage
 * - If I have an :id param => edit mode (PUT /guests/:id)
 * - If I don't have :id => create mode (POST /guests)
 *
 * Professional UX decisions I apply:
 * - I make Name required (already required in backend).
 * - I keep Nationality optional by default, but I strongly encourage it:
 *   it is important for police report / record completeness.
 *   (If you want it required, I can enforce it with a 2-line change.)
 * - I keep validation errors inline + I show a toast.
 * - I disable inputs while saving.
 */
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

      // Here I fetch the guest data from the API.
      const res = await api.get(`/guests/${guestId}`);

      // Here I support both response shapes:
      // - { success: true, data: guest }
      // - { guest: ... }
      // - or directly guest
      const guest = res.data?.guest ?? res.data?.data ?? res.data;

      // Here I hydrate my form state with the guest fields.
      // I default to "" for inputs to avoid uncontrolled warnings.
      setForm({
        name: guest?.name ?? "",
        email: guest?.email ?? "",
        phone: guest?.phone ?? "",
        documentNumber: guest?.documentNumber ?? "",
        address: guest?.address ?? "",

        // ✅ Here I load nationality into the form.
        nationality: guest?.nationality ?? "",
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
   * - Nationality is optional (professional default), but recommended
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

    // If you want Nationality required, uncomment the following:
    // const nationality = form.nationality.trim();
    // if (!nationality) {
    //   setError("Nationality is required.");
    //   return false;
    // }

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
      toast.warning(error ?? "Please review the form.");
      return;
    }

    // Here I build a clean payload and only send non-empty optional fields.
    const payload: any = {
      name: form.name.trim(),
    };

    if (form.email.trim()) payload.email = form.email.trim();
    if (form.phone.trim()) payload.phone = form.phone.trim();
    if (form.documentNumber.trim()) payload.documentNumber = form.documentNumber.trim();
    if (form.address.trim()) payload.address = form.address.trim();

    // ✅ Here I include nationality if provided.
    if (form.nationality.trim()) payload.nationality = form.nationality.trim();

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

      // Here I return to the guests list after a successful save.
      navigate("/guests");
    } catch (err) {
      const message = mapApiError(err);
      toast.error(message);

      // Here I also show the error inline for better UX.
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

      {/* Here I show inline errors when they exist (validation or load issues). */}
      {error && (
        <Card>
          <CardBody>
            <div className="bg-red-50 text-red-800 px-4 py-2 rounded text-sm">{error}</div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody>
          {/* Here I show a small loading message while I fetch the guest on edit mode. */}
          {loadingGuest && isEdit ? (
            <p className="text-sm text-gray-500">Loading data...</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
              <p className="text-xs text-slate-500">Fields marked with * are required.</p>

              <div>
                <label className="block text-sm font-medium text-gray-700">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  className="mt-1 w-full border rounded px-3 py-2 text-sm"
                  placeholder="e.g., John Doe"
                  disabled={loading}
                  autoComplete="name"
                />
              </div>

              {/* ✅ Here I add Nationality for a more complete guest profile and police report needs. */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Nationality</label>
                <input
                  type="text"
                  value={form.nationality}
                  onChange={(e) => handleChange("nationality", e.target.value)}
                  className="mt-1 w-full border rounded px-3 py-2 text-sm"
                  placeholder="e.g., Uruguayan"
                  disabled={loading}
                  autoComplete="country-name"
                />
                <p className="mt-1 text-xs text-slate-500">
                  I recommend filling this in for better reporting and record completeness.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  className="mt-1 w-full border rounded px-3 py-2 text-sm"
                  placeholder="e.g., john@example.com"
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
                  placeholder="e.g., +598 99 123 456"
                  disabled={loading}
                  autoComplete="tel"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Document</label>
                <input
                  type="text"
                  value={form.documentNumber}
                  onChange={(e) => handleChange("documentNumber", e.target.value)}
                  className="mt-1 w-full border rounded px-3 py-2 text-sm"
                  placeholder="e.g., ID 4.123.456-7"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Address</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  className="mt-1 w-full border rounded px-3 py-2 text-sm"
                  placeholder="e.g., Evergreen Ave 1234"
                  disabled={loading}
                  autoComplete="street-address"
                />
              </div>

              <div className="flex justify-end gap-2 mt-4">
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
