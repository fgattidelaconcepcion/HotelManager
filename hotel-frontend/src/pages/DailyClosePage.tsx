import { useEffect, useMemo, useState } from "react";
import api from "../api/api";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

type DailyClosePreview = {
  dateKey: string;
  totalCompleted: number;
  countCompleted: number;
  byMethod: Record<string, number>;
};

type DailyCloseRecord = {
  id: number;
  hotelId: number;
  dateKey: string;
  totalCompleted: number;
  countCompleted: number;
  byMethod?: any;
  notes?: string | null;
  createdAt: string;
  createdBy?: { id: number; name: string; email: string; role: string } | null;
};

/**
 * Here I format currency for Uruguay (UYU) without decimals.
 */
function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-UY", {
    style: "currency",
    currency: "UYU",
    minimumFractionDigits: 0,
  }).format(value ?? 0);
}

/**
 * Here I build YYYY-MM-DD for default date inputs.
 */
function toDateOnlyISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Here I normalize backend errors into a clean UI message.
 */
function getErrorMessage(err: any) {
  const code = err?.response?.data?.code;
  const msg = err?.response?.data?.error;

  if (code === "DAILY_CLOSE_EXISTS") return "A daily close already exists for this date.";
  return msg || "Something went wrong. Please try again.";
}

/**
 * Here I render a nicer inline banner (instead of raw red div).
 */
function Banner({
  variant,
  title,
  message,
  action,
}: {
  variant: "error" | "success" | "info";
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  const styles =
    variant === "error"
      ? "border-red-200 bg-red-50 text-red-900"
      : variant === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-slate-200 bg-slate-50 text-slate-900";

  return (
    <div
      className={[
        "border rounded-xl px-4 py-3 text-sm",
        "animate-in fade-in slide-in-from-top-1 duration-200",
        styles,
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{title}</p>
          {message ? <p className="mt-1 text-xs opacity-90">{message}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

/**
 * Here I render a small confirmation modal for professional UX.
 * No window.confirm (better UI + no blocking browser dialogs).
 */
function ConfirmModal({
  open,
  title,
  description,
  confirmText,
  cancelText,
  loading,
  children,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmText: string;
  cancelText?: string;
  loading?: boolean;
  children?: React.ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 animate-in fade-in duration-150"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg rounded-2xl bg-white border shadow-lg animate-in zoom-in-95 fade-in duration-150">
        <div className="p-4 border-b">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          {description ? (
            <p className="text-xs text-slate-500 mt-1">{description}</p>
          ) : null}
        </div>

        {children ? <div className="p-4">{children}</div> : null}

        <div className="p-4 border-t flex justify-end gap-2">
          <Button type="button" variant="ghost" disabled={!!loading} onClick={onCancel}>
            {cancelText ?? "Cancel"}
          </Button>
          <Button type="button" disabled={!!loading} onClick={onConfirm}>
            {loading ? "Saving..." : confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function DailyClosePage() {
  // Here I select which day I am previewing/closing
  const [dateKey, setDateKey] = useState(() => toDateOnlyISO(new Date()));

  // Here I store preview + list data
  const [preview, setPreview] = useState<DailyClosePreview | null>(null);
  const [closes, setCloses] = useState<DailyCloseRecord[]>([]);

  // UX state
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [creating, setCreating] = useState(false);

  // Here I store a banner message (we keep it simple with a string + type)
  const [banner, setBanner] = useState<null | { type: "error" | "success" | "info"; title: string; msg?: string }>(null);

  // Here I control the modal and optional notes for the closing record
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [notes, setNotes] = useState("");

  /**
   * Here I load the daily close preview from backend.
   * Endpoint: GET /daily-close/preview?date=YYYY-MM-DD
   */
  const loadPreview = async () => {
    try {
      setLoadingPreview(true);
      setBanner(null);

      const res = await api.get("/daily-close/preview", {
        params: { date: dateKey },
        silentErrorToast: true,
      } as any);

      const data = res.data?.data ?? res.data;
      setPreview({
        dateKey: data?.dateKey,
        totalCompleted: Number(data?.totalCompleted ?? 0),
        countCompleted: Number(data?.countCompleted ?? 0),
        byMethod: (data?.byMethod ?? {}) as Record<string, number>,
      });
    } catch (err: any) {
      setPreview(null);
      setBanner({ type: "error", title: "Preview error", msg: getErrorMessage(err) });
    } finally {
      setLoadingPreview(false);
    }
  };

  /**
   * Here I load recent daily close records.
   * Endpoint: GET /daily-close
   */
  const loadCloses = async () => {
    try {
      setLoadingList(true);
      setBanner(null);

      const res = await api.get("/daily-close", {
        silentErrorToast: true,
      } as any);

      const data = res.data?.data ?? res.data;
      setCloses(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setCloses([]);
      setBanner({ type: "error", title: "List error", msg: getErrorMessage(err) });
    } finally {
      setLoadingList(false);
    }
  };

  /**
   * Here I find if the selected date already has a close record.
   * This is critical for professional UX: no double-close and clear feedback.
   */
  const closeForSelectedDate = useMemo(() => {
    return closes.find((c) => c.dateKey === dateKey) ?? null;
  }, [closes, dateKey]);

  const isAlreadyClosed = !!closeForSelectedDate;

  /**
   * Here I create the daily close snapshot.
   * Endpoint: POST /daily-close
   *
   * IMPORTANT:
   * Backend already allows BOTH admin + receptionist (route-level authorizeRoles).
   */
  const createClose = async () => {
    try {
      setCreating(true);
      setBanner(null);

      await api.post(
        "/daily-close",
        { dateKey, notes: notes.trim() ? notes.trim() : null },
        { silentErrorToast: true } as any
      );

      setConfirmOpen(false);
      setNotes("");

      // Here I refresh both preview + list to keep UI consistent
      await Promise.all([loadPreview(), loadCloses()]);

      setBanner({
        type: "success",
        title: "Daily close created",
        msg: `The daily close for ${dateKey} was saved successfully.`,
      });
    } catch (err: any) {
      setBanner({ type: "error", title: "Could not create daily close", msg: getErrorMessage(err) });

      // Here I reload list to ensure UI reflects server state (e.g., exists already)
      await loadCloses();
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    loadCloses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey]);

  const methodsSorted = useMemo(() => {
    const m = preview?.byMethod ?? {};
    return Object.entries(m).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
  }, [preview]);

  const totalForMethod = (method: string) => {
    const v = preview?.byMethod?.[method];
    return typeof v === "number" ? v : 0;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily close"
        description="Professional end-of-day snapshot based on completed payments."
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button variant="secondary" type="button" onClick={loadPreview}>
              Refresh preview
            </Button>
            <Button variant="secondary" type="button" onClick={loadCloses}>
              Refresh list
            </Button>
          </div>
        }
      />

      {banner && (
        <Banner
          variant={banner.type}
          title={banner.title}
          message={banner.msg}
          action={
            banner.type === "error" ? (
              <Button variant="secondary" className="text-xs px-3 py-1" onClick={() => Promise.all([loadPreview(), loadCloses()])}>
                Retry
              </Button>
            ) : null
          }
        />
      )}

      {/* Controls */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-slate-700">Date</label>
              <input
                type="date"
                value={dateKey}
                onChange={(e) => setDateKey(e.target.value)}
                className="mt-1 border rounded px-3 py-2 text-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={creating || loadingPreview || isAlreadyClosed}
                title={isAlreadyClosed ? "This day is already closed." : "Create an immutable daily close snapshot."}
              >
                {isAlreadyClosed ? "Already closed" : "Create daily close"}
              </Button>

              {isAlreadyClosed && closeForSelectedDate ? (
                <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Closed by {closeForSelectedDate.createdBy?.name ?? "unknown"}
                </span>
              ) : null}
            </div>

            <p className="text-xs text-slate-500 max-w-xl">
              This action stores an <span className="font-medium">immutable</span> snapshot of{" "}
              <span className="font-medium">completed</span> payments for the selected date.
            </p>
          </div>
        </CardBody>
      </Card>

      {/* Preview */}
      <Card>
        <CardBody>
          {loadingPreview ? (
            <p className="text-sm text-slate-500">Loading preview...</p>
          ) : !preview ? (
            <p className="text-sm text-slate-500">No preview available.</p>
          ) : (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <p className="text-xs text-slate-500">Date</p>
                  <p className="text-lg font-semibold mt-1">{preview.dateKey}</p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Completed payments</p>
                  <p className="text-lg font-semibold mt-1">{preview.countCompleted}</p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Total completed</p>
                  <p className="text-lg font-semibold mt-1">
                    {formatCurrency(preview.totalCompleted)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Most used method</p>
                  <p className="text-lg font-semibold mt-1">
                    {methodsSorted[0]?.[0] ?? "-"}
                  </p>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-semibold text-slate-800">
                  Breakdown by method
                </p>

                {methodsSorted.length === 0 ? (
                  <p className="text-sm text-slate-500 mt-2">
                    No completed payments for this day.
                  </p>
                ) : (
                  <div className="mt-3 grid gap-2 md:grid-cols-3">
                    {methodsSorted.map(([method, amount]) => {
                      const pct =
                        preview.totalCompleted > 0
                          ? Math.round((Number(amount ?? 0) / preview.totalCompleted) * 100)
                          : 0;

                      return (
                        <div
                          key={method}
                          className="border rounded-xl p-3 bg-white hover:bg-slate-50 transition"
                        >
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-slate-500">{method}</p>
                            <p className="text-[11px] text-slate-400">{pct}%</p>
                          </div>

                          <p className="text-sm font-semibold text-slate-900 mt-1">
                            {formatCurrency(Number(amount ?? 0))}
                          </p>

                          {/* Here I render a small progress bar for visual clarity */}
                          <div className="mt-2 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-slate-900/80 transition-all"
                              style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Here I show a quick “cash / card / transfer” row when present */}
                {methodsSorted.length > 0 && (
                  <div className="mt-4 grid gap-2 md:grid-cols-3">
                    <div className="border rounded-xl p-3 bg-slate-50">
                      <p className="text-xs text-slate-500">cash</p>
                      <p className="text-sm font-semibold mt-1">
                        {formatCurrency(totalForMethod("cash"))}
                      </p>
                    </div>
                    <div className="border rounded-xl p-3 bg-slate-50">
                      <p className="text-xs text-slate-500">card</p>
                      <p className="text-sm font-semibold mt-1">
                        {formatCurrency(totalForMethod("card"))}
                      </p>
                    </div>
                    <div className="border rounded-xl p-3 bg-slate-50">
                      <p className="text-xs text-slate-500">transfer</p>
                      <p className="text-sm font-semibold mt-1">
                        {formatCurrency(totalForMethod("transfer"))}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Recent closes */}
      <Card>
        <CardBody>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-900">Recent daily closes</p>
            <p className="text-xs text-slate-500">
              {loadingList ? "Loading..." : `${closes.length} record(s)`}
            </p>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">Date</th>
                  <th className="px-4 py-2 text-right font-medium text-slate-700">Total</th>
                  <th className="px-4 py-2 text-right font-medium text-slate-700">Count</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">Created by</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">Created at</th>
                </tr>
              </thead>

              <tbody>
                {!loadingList && closes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                      No daily closes yet.
                    </td>
                  </tr>
                )}

                {closes.map((c) => (
                  <tr key={c.id} className="border-t last:border-b hover:bg-slate-50 transition">
                    <td className="px-4 py-2">{c.dateKey}</td>
                    <td className="px-4 py-2 text-right">
                      {formatCurrency(Number(c.totalCompleted ?? 0))}
                    </td>
                    <td className="px-4 py-2 text-right">{Number(c.countCompleted ?? 0)}</td>
                    <td className="px-4 py-2">
                      {c.createdBy?.name ? `${c.createdBy.name} (${c.createdBy.role})` : "-"}
                    </td>
                    <td className="px-4 py-2">
                      {c.createdAt ? new Date(c.createdAt).toLocaleString() : "-"}
                    </td>
                  </tr>
                ))}

                {loadingList && (
                  <tr>
                    <td colSpan={5} className="px-4 py-4 text-center text-slate-500">
                      Loading...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {/* Confirmation modal */}
      <ConfirmModal
        open={confirmOpen}
        title={`Create daily close for ${dateKey}`}
        description="This will store an immutable snapshot of completed payments for that date."
        confirmText="Confirm close"
        cancelText="Cancel"
        loading={creating}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={createClose}
      >
        <div className="space-y-3">
          {isAlreadyClosed ? (
            <Banner
              variant="info"
              title="Already closed"
              message="This date already has a daily close record, so you cannot create another one."
            />
          ) : null}

          <div>
            <label className="block text-sm font-medium text-slate-700">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              rows={3}
              placeholder="Example: cash counted, card settlement pending, etc."
            />
          </div>

          <div className="text-xs text-slate-500">
            Tip: Use notes to record any operational details (cash count, issues, differences).
          </div>
        </div>
      </ConfirmModal>
    </div>
  );
}
