import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import Card from "./common/Card";
import Button from "./common/Button";
import { label } from "./FacilitySignup";
export default function MedicineRequests() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);
  const [offer, setOffer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () =>
    api
      .get("/requests")
      .then((r) => setRows(r.data))
      .catch((e) =>
        setError(e.response?.data?.detail || "Could not load requests"),
      );
  useEffect(() => {
    load();
    if (user?.hospital_id)
      api
        .get("/requests/eligible-batches", {
          params: { hospital_id: user.hospital_id, limit: 1000 },
        })
        .then((r) =>
          setBatches(Array.isArray(r.data) ? r.data : r.data.items || []),
        )
        .catch(() => {});
  }, []);
  const act = async (url: string, data: any) => {
    setBusy(true);
    setError("");
    try {
      await api.post(url, data);
      setOffer(null);
      setShow(false);
      load();
    } catch (e: any) {
      setError(
        typeof e.response?.data?.detail === "string"
          ? e.response.data.detail
          : "Please check all required fields",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card
      title="Medicine Requests"
      subtitle="Receiver request → Donor approval → MTO final approval"
    >
      <p role="alert" className="text-red-600 text-sm">
        {error}
      </p>
      {user?.role === "network_admin" && (
        <Link className="text-blue-600" to="/registration-review">
          Review facility registrations
        </Link>
      )}
      {["pharmacist", "hospital_admin"].includes(user?.role || "") && (
        <Button onClick={() => setShow(!show)}>Create Medicine Request</Button>
      )}
      {show && (
        <form
          className="grid md:grid-cols-2 gap-3 mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            const d: any = Object.fromEntries(new FormData(e.currentTarget));
            d.quantity = Number(d.quantity);
            act("/requests", d);
          }}
        >
          <p className="md:col-span-2 text-sm">
            Receiving facility: your approved registered facility
          </p>
          {[
            "medicine_name",
            "active_ingredient",
            "strength",
            "dosage_form",
            "quantity",
            "required_delivery_date",
            "storage_capability",
            "reason",
            "additional_information",
          ].map((k) => (
            <label key={k} className="text-sm">
              {label(k)}
              <input
                name={k}
                type={
                  k === "quantity"
                    ? "number"
                    : k === "required_delivery_date"
                      ? "date"
                      : "text"
                }
                min={k === "quantity" ? 1 : undefined}
                required={k !== "additional_information"}
                className="block w-full border rounded p-2"
              />
            </label>
          ))}
          <Button loading={busy} type="submit">
            Submit Request
          </Button>
        </form>
      )}
      <div className="space-y-3 mt-4">
        {rows.map((r) => (
          <div key={r.id} className="border rounded-xl p-4">
            <p className="font-semibold">
              {r.data.medicine_name} · {r.data.strength} · {r.data.quantity}{" "}
              units
            </p>
            <p className="text-xs text-slate-500">
              Request {r.id} · {label(r.status)} · Delivery{" "}
              {r.data.required_delivery_date}
            </p>
            <p className="text-sm mt-1">
              {r.data.active_ingredient} · {r.data.dosage_form} · Storage:{" "}
              {r.data.storage_capability} · {r.data.reason}
            </p>
            {r.transfer_id ? (
              <Link
                to={"/transfers/" + r.transfer_id}
                className="text-blue-600 text-sm"
              >
                View transfer / Track order
              </Link>
            ) : (
              user?.hospital_id &&
              user.hospital_id !== r.receiver_id && (
                <div className="mt-2 flex gap-3">
                  <Button
                    size="sm"
                    onClick={() => setOffer(offer === r.id ? null : r.id)}
                  >
                    Approve / Offer Partial Quantity
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      const notes = prompt("Reason for rejecting this request");
                      if (notes) act(`/requests/${r.id}/reject`, { notes });
                    }}
                  >
                    Reject Request
                  </Button>
                </div>
              )
            )}
            {offer === r.id && (
              <form
                className="grid md:grid-cols-2 gap-3 mt-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const d: any = Object.fromEntries(
                    new FormData(e.currentTarget),
                  );
                  d.quantity = Number(d.quantity);
                  d.batch_id = Number(d.batch_id);
                  act(`/requests/${r.id}/offer`, d);
                }}
              >
                <label className="text-sm">
                  Your surplus batch
                  <select
                    name="batch_id"
                    required
                    className="block border rounded p-2 w-full"
                  >
                    <option value="">Select batch</option>
                    {batches
                      .filter((b) => b.hospital_id === user?.hospital_id)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.batch_number} · {b.medicine_name} · Available{" "}
                          {b.quantity - b.reserved_quantity} · Expiry{" "}
                          {b.expiry_date}
                        </option>
                      ))}
                  </select>
                </label>
                {[
                  "quantity",
                  "expiry_date",
                  "storage_conditions",
                  "remarks",
                ].map((k) => (
                  <label key={k} className="text-sm">
                    {label(k)}
                    <input
                      name={k}
                      type={
                        k === "quantity"
                          ? "number"
                          : k === "expiry_date"
                            ? "date"
                            : "text"
                      }
                      min={1}
                      max={k === "quantity" ? r.data.quantity : undefined}
                      required={k !== "remarks"}
                      className="block border rounded p-2 w-full"
                    />
                  </label>
                ))}
                <Button type="submit" loading={busy}>
                  Reserve Stock and Approve
                </Button>
              </form>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
