import React, { useState, useEffect } from "react";
import api from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import Button from "./common/Button";
import Card from "./common/Card";
import { label } from "./FacilitySignup";
import { downloadDocument } from "./RegistrationReview";
export function describeUpdate(value?: string | null): string {
  if (!value) return "";
  try {
    const d = JSON.parse(value);
    return (
      [
        d.remarks,
        d.transporter && `Transporter: ${d.transporter}`,
        d.tracking_reference && `Tracking: ${d.tracking_reference}`,
        d.receiving_person && `Received by: ${d.receiving_person}`,
        d.personnel && `Personnel: ${d.personnel}`,
      ]
        .filter(Boolean)
        .join(" · ") || value
    );
  } catch {
    return value;
  }
}
export const stages = [
  ["REQUEST_CREATED", "REQUEST CREATED"],
  ["DONOR_APPROVED", "DONOR APPROVED"],
  ["FINAL_APPROVED", "MTO APPROVED"],
  ["READY_FOR_DISPATCH", "READY FOR DISPATCH"],
  ["DISPATCHED", "DISPATCHED"],
  ["IN_TRANSIT", "IN TRANSIT"],
  ["DELIVERED", "DELIVERED"],
  ["RECEIVED_AWAITING_VERIFICATION", "RECEIVER VERIFICATION"],
  ["COMPLETED", "COMPLETED"],
];
export function TrackingTimeline({
  transfer: t,
  logs,
}: {
  transfer: any;
  logs: any[];
}) {
  const events = stages.map(([key], i) => {
    if (i === 0 && t.request_details)
      return {
        created_at: t.request_details.created_at,
        details: "Receiver submitted request",
      };
    const event = [...logs]
      .reverse()
      .find(
        (l) =>
          l.action === key ||
          (key === "RECEIVED_AWAITING_VERIFICATION" &&
            l.action === "RECEIVER_VERIFIED"),
      );
    if (!event) return null;
    try {
      const details = JSON.parse(event.details);
      return {
        ...event,
        created_at: details.timestamp || event.created_at,
        details: describeUpdate(event.details),
      };
    } catch {
      return event;
    }
  });
  const last = events.reduce((n, e, i) => (e ? i : n), -1);
  const stopped = ["cancelled", "mto_rejected", "donor_rejected"].includes(
    t.status,
  );
  return (
    <Card
      title="Transfer Progress & Milestone Timeline"
      subtitle="Manual shipment updates from recorded backend events"
    >
      <div className="overflow-x-auto py-4">
        <ol className="flex min-w-[1100px]">
          {stages.map(([key, name], i) => {
            const done = !!events[i] && (i < last || t.status === "completed");
            const current = i === last;
            return (
              <li
                key={key}
                className="relative flex-1 px-2 text-center"
                aria-current={current ? "step" : undefined}
              >
                {i < 8 && (
                  <div
                    className={
                      "absolute top-5 left-1/2 w-full h-0.5 " +
                      (events[i + 1] ? "bg-emerald-500" : "bg-slate-200")
                    }
                  />
                )}
                <div
                  className={
                    "relative z-10 mx-auto rounded-full w-10 h-10 flex items-center justify-center border-2 " +
                    (done
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : current
                        ? "bg-blue-50 border-blue-500 text-blue-700"
                        : "bg-white border-slate-200 text-slate-400")
                  }
                >
                  {done ? "✓" : i + 1}
                </div>
                <p className="text-xs font-semibold mt-3">{name}</p>
                <p className="text-[10px] text-slate-500 mt-1">
                  {events[i]
                    ? new Date(events[i].created_at).toLocaleString()
                    : "Pending"}
                </p>
                {events[i]?.details && (
                  <p className="text-[10px] mt-1 text-slate-500 break-words">
                    {events[i].details}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      </div>
      {stopped && (
        <p className="text-red-600 font-semibold">
          {label(t.status)} — {t.rejection_reason || t.cancellation_reason}
        </p>
      )}
    </Card>
  );
}
export function AuthenticatedQR({ id }: { id: number }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let objectUrl = "";
    api.get(`/transfers/${id}/qr-code`, { responseType: "blob" }).then((r) => {
      objectUrl = URL.createObjectURL(r.data);
      setUrl(objectUrl);
    });
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);
  return url ? (
    <img
      src={url}
      alt="Transfer tracking QR code"
      className="w-48 h-48 mx-auto"
    />
  ) : (
    <p>Loading QR…</p>
  );
}
export function WorkflowActions({
  transfer: t,
  reload,
}: {
  transfer: any;
  reload: () => void;
}) {
  const { user } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [discrepancy, setDiscrepancy] = useState(false);
  const [mode, setMode] = useState("");
  const [correctionBatches, setCorrectionBatches] = useState<any[]>([]);
  useEffect(() => {
    if (
      t.status === "donor_review" &&
      user?.hospital_id === t.donor_hospital_id
    )
      api
        .get("/requests/eligible-batches")
        .then((r) => setCorrectionBatches(r.data))
        .catch(() => setError("Could not load eligible batches"));
  }, [t.id, t.status, user?.hospital_id]);
  const run = async (fn: () => Promise<any>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      reload();
    } catch (e: any) {
      setError(
        typeof e.response?.data?.detail === "string"
          ? e.response.data.detail
          : "Check required fields",
      );
    } finally {
      setBusy(false);
    }
  };
  const donor = user?.hospital_id === t.donor_hospital_id;
  const receiver = user?.hospital_id === t.receiver_hospital_id;
  return (
    <Card
      title="Role-Based Action Center"
      subtitle="Actions available to your authenticated role"
    >
      <p role="alert" className="text-sm text-red-600">
        {error}
      </p>
      {t.status === "awaiting_mto_review" && user?.role === "mto" && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const notes = String(new FormData(e.currentTarget).get("notes"));
            run(() =>
              mode === "approve" || mode === "reject"
                ? api.put(`/transfers/${t.id}/mto-review`, {
                    approved: mode === "approve",
                    notes,
                  })
                : api.put(`/transfers/${t.id}/mto-followup`, {
                    action: mode,
                    notes,
                  }),
            );
          }}
        >
          <p className="text-xs">
            Review facility verification, licences, medicine, batch, expiry,
            quantity, supporting evidence, storage/transport and
            institutional/statutory requirements. Internal approval does not
            replace statutory permission.
          </p>
          <textarea
            name="notes"
            required
            placeholder="Review findings / reasons"
            className="w-full border rounded p-2"
          />
          <label className="block text-xs">
            <input type="checkbox" required /> I reviewed the required evidence
            and requirements.
          </label>
          <div className="flex flex-wrap gap-2">
            {["approve", "reject", "documents", "correction"].map((x) => (
              <Button
                key={x}
                type="submit"
                size="sm"
                loading={busy}
                onClick={() => setMode(x)}
              >
                {x === "documents"
                  ? "Request Additional Documents"
                  : x === "correction"
                    ? "Return for Correction"
                    : label(x) + " Transfer"}
              </Button>
            ))}
          </div>
        </form>
      )}
      {donor && t.status === "mto_requested_documents" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const d = new FormData(e.currentTarget);
            run(() =>
              api.post(`/transfers/${t.id}/documents`, d, {
                headers: { "Content-Type": "multipart/form-data" },
              }),
            );
          }}
        >
          <input
            type="file"
            name="file"
            accept=".pdf,.png,.jpg,.jpeg"
            required
          />
          <input
            name="notes"
            required
            placeholder="Document notes"
            className="border rounded p-2 my-2"
          />
          <Button type="submit" loading={busy}>
            Submit Documents for MTO Review
          </Button>
        </form>
      )}
      {donor && t.status === "donor_review" && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const data: any = Object.fromEntries(new FormData(e.currentTarget));
            data.quantity = Number(data.quantity);
            data.batch_id = Number(data.batch_id);
            run(() => api.put(`/transfers/${t.id}/correction`, data));
          }}
        >
          <p className="text-sm">MTO correction requested: {t.mto_notes}</p>
          <label className="block text-sm">
            Corrected batch
            <select
              name="batch_id"
              required
              defaultValue={t.batch_id}
              className="block w-full border rounded p-2"
            >
              {correctionBatches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.batch_number} · {b.medicine_name} · Available{" "}
                  {b.quantity - b.reserved_quantity} · Expiry {b.expiry_date}
                </option>
              ))}
            </select>
          </label>
          {["quantity", "expiry_date", "storage_conditions", "remarks"].map(
            (key) => (
              <label key={key} className="block text-sm">
                {label(key)}
                <input
                  name={key}
                  required
                  defaultValue={
                    key === "quantity"
                      ? t.quantity
                      : key === "expiry_date"
                        ? t.expiry_date
                        : t.request_details?.offer?.[key]
                  }
                  type={
                    key === "quantity"
                      ? "number"
                      : key === "expiry_date"
                        ? "date"
                        : "text"
                  }
                  min={1}
                  className="block w-full border rounded p-2"
                />
              </label>
            ),
          )}
          <Button type="submit" loading={busy}>
            Confirm Correction and Re-reserve Stock
          </Button>
        </form>
      )}
      {user?.role === "logistics" &&
        ["ready_for_dispatch", "dispatched", "in_transit"].includes(
          t.status,
        ) && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const d: any = Object.fromEntries(new FormData(e.currentTarget));
              const status =
                t.status === "ready_for_dispatch"
                  ? "dispatched"
                  : t.status === "dispatched"
                    ? "in_transit"
                    : "delivered";
              run(() =>
                api.put(`/transfers/${t.id}/shipment`, {
                  ...d,
                  status,
                  timestamp: new Date(d.timestamp).toISOString(),
                }),
              );
            }}
          >
            <p className="text-sm">
              Manual update · Personnel: {user.full_name}
            </p>
            <input
              aria-label="Event date and time"
              name="timestamp"
              type="datetime-local"
              required
              className="w-full border rounded p-2"
            />
            {(t.status === "ready_for_dispatch"
              ? ["transporter", "tracking_reference"]
              : t.status === "in_transit"
                ? ["receiving_person"]
                : []
            ).map((k) => (
              <input
                key={k}
                name={k}
                required
                placeholder={label(k)}
                className="w-full border rounded p-2"
              />
            ))}
            <textarea
              name="remarks"
              required
              placeholder="Status update / location / handover remarks"
              className="w-full border rounded p-2"
            />
            <Button type="submit" loading={busy}>
              {t.status === "ready_for_dispatch"
                ? "Mark as Dispatched"
                : t.status === "dispatched"
                  ? "Mark as In Transit"
                  : "Mark as Delivered"}
            </Button>
          </form>
        )}
      {receiver && t.status === "received_awaiting_verification" && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const d: any = Object.fromEntries(new FormData(e.currentTarget));
            d.received_quantity = Number(d.received_quantity);
            d.packaging_ok = !!d.packaging_ok;
            d.storage_transport_ok = !!d.storage_transport_ok;
            d.discrepancy = discrepancy;
            run(() => api.put(`/transfers/${t.id}/receipt`, d));
          }}
        >
          {[
            "medicine_name",
            "batch_number",
            "received_quantity",
            "expiry_date",
          ].map((k) => (
            <label key={k} className="block text-sm">
              {label(k)}
              <input
                name={k}
                required
                defaultValue={k === "received_quantity" ? t.quantity : t[k]}
                type={
                  k === "expiry_date"
                    ? "date"
                    : k === "received_quantity"
                      ? "number"
                      : "text"
                }
                className="w-full border rounded p-2"
              />
            </label>
          ))}
          {["packaging_ok", "storage_transport_ok"].map((k) => (
            <label key={k} className="block text-sm">
              <input name={k} type="checkbox" /> {label(k)}
            </label>
          ))}
          <textarea
            name="notes"
            required
            placeholder="Receiver checks / discrepancy details"
            className="w-full border rounded p-2"
          />
          <div className="flex gap-2">
            <Button
              loading={busy}
              type="submit"
              onClick={() => setDiscrepancy(false)}
            >
              Confirm Receipt
            </Button>
            <Button
              loading={busy}
              type="submit"
              variant="danger"
              onClick={() => setDiscrepancy(true)}
            >
              Report Discrepancy
            </Button>
          </div>
        </form>
      )}
      {(receiver || user?.role === "mto") &&
        [
          "awaiting_mto_review",
          "mto_requested_documents",
          "donor_review",
          "ready_for_dispatch",
        ].includes(t.status) && (
          <Button
            variant="danger"
            size="sm"
            className="mt-3"
            onClick={() => {
              const notes = prompt("Cancellation reason");
              if (notes)
                run(() =>
                  api.put(`/transfers/${t.id}/status`, {
                    status: "cancelled",
                    notes,
                  }),
                );
            }}
          >
            Cancel Transfer
          </Button>
        )}
      {t.status === "completed" && (
        <p className="text-emerald-700">
          Receipt verified. Transfer completed and inventory reconciled.
        </p>
      )}
    </Card>
  );
}
export function VerificationEvidence({ transfer: t }: { transfer: any }) {
  return (
    <Card title="Facility Verification & Supporting Evidence">
      <div className="space-y-3 text-xs">
        {Object.entries(t.facility_verification || {}).map(
          ([side, v]: [string, any]) => (
            <div key={side}>
              <strong>{label(side)}</strong>
              <p>
                NIN {v.nin}: {v.nin_status}
              </p>
              <p>
                {v.registration_status} · Licence {v.licence_status} · Valid
                until {v.licence_validity}
              </p>
              {["nin", "licence"].map((k) => (
                <button
                  key={k}
                  className="text-blue-600 mr-3"
                  onClick={() => downloadDocument(v[k + "_document_id"])}
                >
                  Download {k} evidence
                </button>
              ))}
            </div>
          ),
        )}
        {t.request_details?.supporting_documents?.map((id: string) => (
          <button
            key={id}
            className="text-blue-600 block"
            onClick={() => downloadDocument(id)}
          >
            Download supporting document
          </button>
        ))}
        <p>
          Ingredient: {t.active_ingredient} · Strength: {t.strength} · Form:{" "}
          {t.dosage_form}
        </p>
        <p>Storage capability: {t.request_details?.storage_capability}</p>
        <p>
          Donor storage/transport:{" "}
          {t.request_details?.offer?.storage_conditions}
        </p>
      </div>
    </Card>
  );
}
