import { useEffect, useState } from "react";
import api from "../api/api";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import RoleGate from "../auth/RoleGate";
import { toast } from "sonner";

type HotelSettings = {
  id: number;
  name: string;
  code: string;
  address: string | null;
  responsibleName: string | null;
  registrationNumber: string | null;
};

export default function HotelSettingsPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [hotel, setHotel] = useState<HotelSettings | null>(null);

  // Local editable fields (strings for smooth UX)
  const [address, setAddress] = useState("");
  const [responsibleName, setResponsibleName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");

  /**
   * Here I load the current tenant (hotel) settings.
   */
  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await api.get("/hotel/me");
      const payload = res.data?.data ?? res.data;

      setHotel(payload);

      setAddress(payload?.address ?? "");
      setResponsibleName(payload?.responsibleName ?? "");
      setRegistrationNumber(payload?.registrationNumber ?? "");
    } catch (err: any) {
      console.error("Error loading hotel settings", err);
      setError(err?.response?.data?.error || "Could not load hotel settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /**
   * Here I save the editable settings (admin only).
   * Empty string will clear the field (backend converts "" -> null).
   */
  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      await api.put("/hotel/me", {
        address,
        responsibleName,
        registrationNumber,
      });

      toast.success("Hotel settings saved");
      await load();
    } catch (err: any) {
      console.error("Error saving hotel settings", err);
      setError(err?.response?.data?.error || "Could not save hotel settings.");
      toast.error(err?.response?.data?.error || "Could not save hotel settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hotel settings"
        description="Configure the tenant (hotel) information used for reports and exports."
      />

      {error && (
        <Card>
          <CardBody>
            <div className="bg-red-50 text-red-800 px-4 py-2 rounded text-sm">{error}</div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody>
          {loading ? (
            <p className="text-sm text-slate-500">Loading hotel settings...</p>
          ) : !hotel ? (
            <p className="text-sm text-slate-500">No hotel data found.</p>
          ) : (
            <div className="space-y-6 max-w-2xl">
              {/* Read-only identity */}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Hotel name</label>
                  <input
                    value={hotel.name}
                    disabled
                    className="mt-1 w-full border rounded px-3 py-2 text-sm bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Accommodation code
                  </label>
                  <input
                    value={hotel.code}
                    disabled
                    className="mt-1 w-full border rounded px-3 py-2 text-sm bg-slate-50"
                  />
                </div>
              </div>

              {/* Editable fields */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">Address</label>
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="mt-1 w-full border rounded px-3 py-2 text-sm"
                    placeholder="Hotel address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Responsible name
                  </label>
                  <input
                    value={responsibleName}
                    onChange={(e) => setResponsibleName(e.target.value)}
                    className="mt-1 w-full border rounded px-3 py-2 text-sm"
                    placeholder="Owner / responsible person"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Registration number
                  </label>
                  <input
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                    className="mt-1 w-full border rounded px-3 py-2 text-sm"
                    placeholder="Official registration number"
                  />
                </div>
              </div>

              {/* Save (admin only) */}
              <RoleGate allowed={["admin"]}>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="secondary" onClick={() => load()} disabled={saving}>
                    Refresh
                  </Button>

                  <Button type="button" onClick={handleSave} disabled={saving}>
                    {saving ? "Saving..." : "Save settings"}
                  </Button>
                </div>

                <p className="text-xs text-slate-500 mt-2">
                  These fields will be used in RIHP / police exports and stay registration snapshots.
                </p>
              </RoleGate>

              {/* Non-admin message */}
              <RoleGate allowed={["receptionist"]}>
                <p className="text-xs text-slate-500">
                  Only admins can edit hotel settings. You can view them for reference.
                </p>
              </RoleGate>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
