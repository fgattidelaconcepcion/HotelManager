import { useMemo, useState } from "react";
import api from "../api/api";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import RoleGate from "../auth/RoleGate";

/**
 * Police report page (RIHP - Uruguay)
 *
 * Here I export StayRegistration rows for police reporting:
 * - CSV
 * - PDF (printable)
 *
 * Backend endpoints:
 * - GET /api/reports/police?from=YYYY-MM-DD&to=YYYY-MM-DD
 * - GET /api/reports/police/pdf?from=YYYY-MM-DD&to=YYYY-MM-DD
 */

function buildParams(from: string, to: string) {
  const params: Record<string, string> = {};
  if (from.trim()) params.from = from.trim();
  if (to.trim()) params.to = to.trim();
  return params;
}

/**
 * Here I force a "real file download" from a Blob response.
 */
function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

function mapApiError(err: any) {
  return err?.response?.data?.error || err?.message || "Something went wrong. Please try again.";
}

export default function PoliceReportPage() {
  const [from, setFrom] = useState(""); // YYYY-MM-DD
  const [to, setTo] = useState(""); // YYYY-MM-DD

  const [loadingCsv, setLoadingCsv] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const params = useMemo(() => buildParams(from, to), [from, to]);

  const handleClear = () => {
    setFrom("");
    setTo("");
    setError(null);
  };

  const handleDownloadCsv = async () => {
    try {
      setLoadingCsv(true);
      setError(null);

      const res = await api.get(
        "/reports/police",
        {
          params,
          responseType: "blob",
        } as any
      );

      downloadBlob(res.data, "police-report-rihp.csv");
    } catch (err: any) {
      console.error("Error downloading CSV police report", err);
      setError(mapApiError(err));
    } finally {
      setLoadingCsv(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setLoadingPdf(true);
      setError(null);

      const res = await api.get(
        "/reports/police/pdf",
        {
          params,
          responseType: "blob",
        } as any
      );

      downloadBlob(res.data, "police-report-rihp.pdf");
    } catch (err: any) {
      console.error("Error downloading PDF police report", err);
      setError(mapApiError(err));
    } finally {
      setLoadingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Police report (RIHP)"
        description="Export guest stay registrations required for Uruguay RIHP reporting."
      />

      <Card>
        <CardBody>
          <p className="text-xs text-slate-600">
            This export includes the RIHP fields: full name, document (type/number), nationality,
            birth date, civil status, occupation, provenance, entry/exit dates, room number, and
            establishment details (address, responsible name, registration number).
          </p>
        </CardBody>
      </Card>

      {error && (
        <Card>
          <CardBody>
            <div className="bg-red-50 text-red-800 px-4 py-2 rounded text-sm">{error}</div>
          </CardBody>
        </Card>
      )}

      {/* Exports are sensitive: admin + receptionist can access if you want. */}
      <RoleGate allowed={["admin", "receptionist"]}>
        <Card>
          <CardBody>
            <div className="max-w-4xl">
              <div className="grid gap-4 md:grid-cols-4 items-end">
                <div className="md:col-span-1">
                  <label className="block text-sm font-medium text-slate-700">From</label>
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="mt-1 w-full border rounded px-3 py-2 text-sm"
                  />
                </div>

                <div className="md:col-span-1">
                  <label className="block text-sm font-medium text-slate-700">To</label>
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="mt-1 w-full border rounded px-3 py-2 text-sm"
                  />
                </div>

                <div className="md:col-span-2 flex gap-2 md:justify-end">
                  <Button
                    type="button"
                    onClick={handleDownloadCsv}
                    disabled={loadingCsv || loadingPdf}
                  >
                    {loadingCsv ? "Downloading CSV..." : "Download CSV"}
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleDownloadPdf}
                    disabled={loadingCsv || loadingPdf}
                  >
                    {loadingPdf ? "Downloading PDF..." : "Download PDF"}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleClear}
                    disabled={loadingCsv || loadingPdf}
                  >
                    Clear
                  </Button>
                </div>
              </div>

              <p className="text-xs text-slate-500 mt-3">
                Rows are generated from stay registration snapshots created on{" "}
                <span className="font-semibold">Check-in</span>. If you don’t see rows, make sure
                check-ins were completed.
              </p>
            </div>
          </CardBody>
        </Card>
      </RoleGate>
    </div>
  );
}
