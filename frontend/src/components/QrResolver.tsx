import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { transfersApi } from "../api/transfers";
export default function QrResolver() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState("Looking up transfer…");
  useEffect(() => {
    transfersApi
      .verifyByQr(token!)
      .then((t) => navigate("/transfers/" + t.id, { replace: true }))
      .catch(() => setError("QR token invalid or access denied"));
  }, [token]);
  return <p>{error}</p>;
}
