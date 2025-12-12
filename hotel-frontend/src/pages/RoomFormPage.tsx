import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/api";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { toast } from "sonner";

interface RoomType {
  id: number;
  name: string;
  basePrice?: number | null;
}

interface RoomFormState {
  number: string;
  floor: string;
  description: string;
  roomTypeId: string;
}

const emptyForm: RoomFormState = {
  number: "",
  floor: "",
  description: "",
  roomTypeId: "",
};

export default function RoomFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [form, setForm] = useState<RoomFormState>(emptyForm);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRoom, setLoadingRoom] = useState(false);
  const [loadingRoomTypes, setLoadingRoomTypes] = useState(false);

  const handleChange = (field: keyof RoomFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const loadRoomTypes = async () => {
    try {
      setLoadingRoomTypes(true);
      const res = await api.get("/room-types");
      const data = res.data?.data ?? res.data;
      setRoomTypes(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Could not load room types");
    } finally {
      setLoadingRoomTypes(false);
    }
  };

  const loadRoom = async () => {
    if (!id) return;
    const roomId = Number(id);

    if (Number.isNaN(roomId)) {
      toast.error("Invalid room ID");
      return;
    }

    try {
      setLoadingRoom(true);
      const res = await api.get(`/rooms/${roomId}`);
      const data = res.data?.data ?? res.data;

      setForm({
        number: data.number ?? "",
        floor: data.floor != null ? String(data.floor) : "",
        description: data.description ?? "",
        roomTypeId: data.roomType?.id != null ? String(data.roomType.id) : "",
      });
    } catch {
      toast.error("Could not load the room");
    } finally {
      setLoadingRoom(false);
    }
  };

  useEffect(() => {
    loadRoomTypes();
  }, []);

  useEffect(() => {
    if (isEdit) {
      loadRoom();
    } else {
      setForm(emptyForm);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const validateForm = () => {
    if (!form.number.trim()) {
      toast.error("Room number is required");
      return false;
    }

    if (!form.floor.trim()) {
      toast.error("Floor is required");
      return false;
    }

    const floorNumber = Number(form.floor);
    if (Number.isNaN(floorNumber) || !Number.isInteger(floorNumber)) {
      toast.error("Floor must be a valid integer");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const payload: any = {
      number: form.number.trim(),
      floor: Number(form.floor),
    };

    if (form.description.trim()) payload.description = form.description.trim();
    if (form.roomTypeId) payload.roomTypeId = Number(form.roomTypeId);

    try {
      setLoading(true);

      if (isEdit && id) {
        await api.put(`/rooms/${Number(id)}`, payload);
        toast.success("Room updated successfully");
      } else {
        await api.post("/rooms", payload);
        toast.success("Room created successfully");
      }

      navigate("/rooms");
    } catch {
      toast.error("Could not save the room. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate("/rooms");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEdit ? "Edit room" : "New room"}
        description={
          isEdit
            ? "Update the details of the selected room."
            : "Create a new room in the system."
        }
        actions={
          <Button type="button" variant="ghost" onClick={handleCancel}>
            Back to rooms
          </Button>
        }
      />

      <Card>
        <CardBody>
          {loadingRoom && isEdit ? (
            <p className="text-sm text-gray-500">Loading data...</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
              <p className="text-xs text-slate-500">
                Fields marked with * are required.
              </p>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Room number *
                  </label>
                  <input
                    type="text"
                    value={form.number}
                    onChange={(e) => handleChange("number", e.target.value)}
                    className="mt-1 w-full border rounded px-3 py-2 text-sm"
                    placeholder="e.g. 101"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Floor *
                  </label>
                  <input
                    type="number"
                    value={form.floor}
                    onChange={(e) => handleChange("floor", e.target.value)}
                    className="mt-1 w-full border rounded px-3 py-2 text-sm"
                    placeholder="e.g. 1"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Room type
                </label>
                <select
                  value={form.roomTypeId}
                  onChange={(e) =>
                    handleChange("roomTypeId", e.target.value)
                  }
                  className="mt-1 w-full border rounded px-3 py-2 text-sm"
                  disabled={loading || loadingRoomTypes}
                >
                  <option value="">
                    {loadingRoomTypes
                      ? "Loading room types..."
                      : "Select a type (optional)"}
                  </option>
                  {roomTypes.map((rt) => (
                    <option key={rt.id} value={rt.id}>
                      {rt.name}
                      {rt.basePrice != null
                        ? ` · ${new Intl.NumberFormat("en-UY", {
                            style: "currency",
                            currency: "UYU",
                            minimumFractionDigits: 0,
                          }).format(rt.basePrice)}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    handleChange("description", e.target.value)
                  }
                  className="mt-1 w-full border rounded px-3 py-2 text-sm"
                  rows={3}
                  placeholder="e.g. Double room with ocean view..."
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
                  {isEdit ? "Save changes" : "Create room"}
                </Button>
              </div>
            </form>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
