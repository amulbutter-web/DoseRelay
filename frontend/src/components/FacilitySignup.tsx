import React, { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import Card from "./common/Card";
import Button from "./common/Button";
export const signupFields = [
  "name",
  "facility_type",
  "address",
  "state",
  "district",
  "city",
  "pin_code",
  "phone",
  "email",
  "nin",
  "representative",
  "pharmacist_name",
  "pharmacist_registration",
  "contact_information",
  "licence_number",
  "licence_type",
  "issuing_authority",
  "licence_validity",
  "password",
  "confirm_password",
];
export const label = (s: string) =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
export default function FacilitySignup({
  existing = false,
}: {
  existing?: boolean;
}) {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("NIN NOT ENTERED");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const data: any = {};
    signupFields.forEach((k) => (data[k] = form.get(k)));
    const body = new FormData();
    body.append("payload", JSON.stringify(data));
    body.append("nin_document", form.get("nin_document")!);
    body.append("licence_document", form.get("licence_document")!);
    if (existing) body.append("hospital_id", String(form.get("hospital_id")));
    try {
      const r = await api.post(
        existing ? "/registration/existing" : "/registration/signup",
        body,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      setMessage(r.data.message);
    } catch (e: any) {
      setMessage(e.response?.data?.detail || "Registration failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        <Card
          title={
            existing
              ? "Verify an Existing Facility"
              : "Pharmacy / Hospital Signup"
          }
          subtitle="NIN identifies a healthcare facility, not an individual."
        >
          <p className="text-sm mb-4">
            Manual verification against official NIN records is required. NIN
            and Drug Licence checks are separate.{" "}
            <a
              className="text-blue-600"
              href="https://nin.mohfw.gov.in/about_nin2hfi.php"
              target="_blank"
              rel="noreferrer"
            >
              Official NIN information
            </a>
          </p>
          <form
            onSubmit={submit}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {existing && (
              <label>
                Existing Facility ID
                <input
                  name="hospital_id"
                  type="number"
                  required
                  className="block border rounded p-2"
                />
              </label>
            )}
            {signupFields
              .filter((k) => !existing || !k.includes("password"))
              .map((k) => (
                <label key={k} className="text-sm text-slate-700">
                  {label(k)}
                  {k.startsWith("pharmacist_")
                    ? " (required for pharmacies)"
                    : ""}
                  {k === "facility_type" ? (
                    <select
                      name={k}
                      className="block border rounded-lg p-2 w-full"
                    >
                      <option value="pharmacy">Pharmacy</option>
                      <option value="hospital">Hospital</option>
                    </select>
                  ) : (
                    <input
                      name={k}
                      required={!k.startsWith("pharmacist_")}
                      type={
                        k.includes("password")
                          ? "password"
                          : k === "licence_validity"
                            ? "date"
                            : k === "email"
                              ? "email"
                              : "text"
                      }
                      minLength={k.includes("password") ? 12 : undefined}
                      maxLength={k.includes("password") ? 72 : undefined}
                      pattern={
                        k === "nin"
                          ? "[0-9]{10}"
                          : k === "pin_code"
                            ? "[0-9]{6}"
                            : undefined
                      }
                      className="block border rounded-lg p-2 w-full"
                      onBlur={
                        k === "nin"
                          ? async (e) => {
                              try {
                                setStatus(
                                  (
                                    await api.get("/registration/nin-status", {
                                      params: { nin: e.target.value },
                                    })
                                  ).data.status,
                                );
                              } catch (err: any) {
                                setStatus(err.response?.data?.detail);
                              }
                            }
                          : undefined
                      }
                    />
                  )}
                </label>
              ))}
            <p className="md:col-span-2 text-sm text-blue-700">
              {status} — format checking does not verify a facility.
            </p>
            {["nin", "licence"].map((k) => (
              <label key={k} className="text-sm">
                {k === "nin"
                  ? "Official NIN supporting document"
                  : "Drug Licence document"}{" "}
                (PDF/PNG/JPEG, up to 5 MB)
                <input
                  type="file"
                  name={k + "_document"}
                  accept=".pdf,.png,.jpg,.jpeg"
                  required
                  className="block mt-2"
                />
              </label>
            ))}
            <div className="md:col-span-2">
              <Button loading={busy} type="submit">
                Submit for Verification
              </Button>
              <Link className="ml-4 text-blue-600" to="/login">
                Back to login
              </Link>
              <p role="status" className="mt-4 text-sm">
                {message}
              </p>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
