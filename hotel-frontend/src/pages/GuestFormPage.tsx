import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/api";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { toast } from "sonner";

interface GuestFormState {
  name: string;
  email: string;
  phone: string;
  documentNumber: string;
  address: string;
}

const emptyForm: GuestFormState = {
  name: "",
  email: "",
  phone: "",
  documentNumber: "",
  address: "",
};

export default function GuestFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const isEdit = !!id;

  const [form, setForm] = useState<GuestFormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [loadingGuest, setLoadingGuest] = useState(false);

  // Usalo SOLO para validaciones del formulario (no para errores del backend)
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: keyof GuestFormState, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

const loadGuest = async () => {
  if (!id) return;

  const guestId = Number(id);
  if (Number.isNaN(guestId)) {
    setError("Invalid guest ID.");
    return;
  }

  try {
    setLoadingGuest(true);
    setError(null);

    const res = await api.get(`/guests/${guestId}`);

    const guest = res.data?.guest ?? res.data?.data ?? res.data; // <-- clave

    setForm({
      name: guest?.name ?? "",
      email: guest?.email ?? "",
      phone: guest?.phone ?? "",
      documentNumber: guest?.documentNumber ?? "",
      address: guest?.address ?? "",
    });
  } finally {
    setLoadingGuest(false);
  }
};



  useEffect(() => {
    if (isEdit) {
      loadGuest();
    } else {
      setForm(emptyForm);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const validateForm = () => {
    if (!form.name.trim()) {
      setError("Name is required.");
      return false;
    }

    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      setError("Email format is not valid.");
      return false;
    }

    setError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const payload: any = { name: form.name.trim() };
    if (form.email.trim()) payload.email = form.email.trim();
    if (form.phone.trim()) payload.phone = form.phone.trim();
    if (form.documentNumber.trim()) payload.documentNumber = form.documentNumber.trim();
    if (form.address.trim()) payload.address = form.address.trim();

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
      // interceptor global -> toast.error(...)
      // acá no hace falta setError, salvo que quieras inline
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate("/guests");
  };

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
            <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
              <p className="text-xs text-slate-500">
                Fields marked with * are required.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  className="mt-1 w-full border rounded px-3 py-2 text-sm"
                  placeholder="e.g., John Doe"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  className="mt-1 w-full border rounded px-3 py-2 text-sm"
                  placeholder="e.g., john@example.com"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Phone
                </label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  className="mt-1 w-full border rounded px-3 py-2 text-sm"
                  placeholder="e.g., +598 99 123 456"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Document
                </label>
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
                <label className="block text-sm font-medium text-gray-700">
                  Address
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  className="mt-1 w-full border rounded px-3 py-2 text-sm"
                  placeholder="e.g., Evergreen Ave 1234"
                  disabled={loading}
                />
              </div>

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
