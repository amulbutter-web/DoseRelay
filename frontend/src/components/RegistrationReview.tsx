import React, { useEffect, useState } from "react";
import api from "../api/client";
import Card from "./common/Card";
import Button from "./common/Button";
import FacilitySignup, { label } from "./FacilitySignup";
export async function downloadDocument(id: string) {
  const r = await api.get("/registration/documents/" + id, {
    responseType: "blob",
  });
  const url = URL.createObjectURL(r.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = "verification-document";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function RegistrationReview() {
  const [rows, setRows] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const load = () =>
    api
      .get("/registration")
      .then((r) => setRows(r.data))
      .catch((e) => setMessage(e.response?.data?.detail || "Load failed"));
  useEffect(() => {
    load();
  }, []);
  return (
    <>
      <details className="mb-4">
        <summary className="cursor-pointer text-blue-600">
          Submit verification for an existing facility
        </summary>
        <FacilitySignup existing />
      </details>
      <Card
        title="Facility Registration Review"
        subtitle="Manually check official district/state records. Drug Licence verification is separate."
      >
        <p role="status">{message}</p>
        {rows.map((r) => (
          <form
            key={r.id}
            className="border rounded-xl p-4 my-4 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const d = Object.fromEntries(new FormData(e.currentTarget));
              try {
                await api.put(`/registration/${r.id}/review`, d);
                setMessage("Review saved");
                load();
              } catch (e: any) {
                setMessage(e.response?.data?.detail || "Review failed");
              }
            }}
          >
            <h3 className="font-semibold">
              {r.data.name} — {r.nin}
            </h3>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(r.data)
                .filter(
                  ([k]) =>
                    ![
                      "review",
                      "nin_document_id",
                      "licence_document_id",
                    ].includes(k),
                )
                .map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-slate-500">{label(k)}</dt>
                    <dd>{String(v)}</dd>
                  </div>
                ))}
            </dl>
            <div className="flex gap-4">
              {["nin", "licence"].map((k) => (
                <button
                  type="button"
                  key={k}
                  className="text-blue-600"
                  onClick={() => downloadDocument(r.data[k + "_document_id"])}
                >
                  Download {k} evidence
                </button>
              ))}
            </div>
            {[
              [
                "nin_status",
                [
                  "VERIFICATION PENDING",
                  "FACILITY DETAILS MISMATCH",
                  "VERIFICATION FAILED",
                  "NIN VERIFIED",
                ],
              ],
              ["licence_status", ["PENDING", "PASSED", "FAILED"]],
              [
                "registration_status",
                [
                  "VERIFICATION PENDING",
                  "REGISTRATION APPROVED",
                  "REGISTRATION REJECTED",
                ],
              ],
            ].map(([key, opts]) => (
              <label key={String(key)} className="block text-sm">
                {label(String(key))}
                <select
                  name={String(key)}
                  defaultValue={r[String(key)]}
                  className="border rounded p-2 ml-3"
                >
                  {(opts as string[]).map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
            ))}
            {[
              "official_nin",
              "official_name",
              "official_address",
              "official_reference",
              "notes",
            ].map((k) => (
              <label key={k} className="block text-sm">
                {label(k)}
                <input
                  name={k}
                  required
                  className="block w-full border rounded p-2"
                />
              </label>
            ))}
            <Button type="submit">Save Verification Decision</Button>
          </form>
        ))}
      </Card>
    </>
  );
}
