# DoseRelay — limited feature updates

The existing React/Vite frontend, FastAPI backend, sidebar, F2 dashboard layout and inventory schema are retained. Changes are limited to authentication/registration, MTO access, medicine approvals, and Logistics/tracking, plus their necessary shared integrations.

## Run locally

Use the existing environment and database configuration. Install backend dependencies from `backend/requirements.txt`, and run `uvicorn app.main:app --reload` from `backend/`. From `frontend/`, run `npm ci` and `npm run dev`. The Vite proxy continues to use backend port 8000.

For an existing Alembic-managed database, run `alembic upgrade head` from `backend/`. Revision 002 only adds verification/request/session tables and a unique central-MTO index. If the uploaded SQLite snapshot has no Alembic version table, back it up and stamp its existing schema with `alembic stamp 001` before upgrading. Development startup also creates the additive tables/index. Do not stamp a database whose schema is not the supplied 001 schema.

The supplied SQLite snapshot retains all original hospital, medicine, inventory, forecasting, analytics and historical transfer rows. Its single MTO account has been provisioned with the requested development credentials:

- Username: `mto@doserelay.demo`
- Password: `DoseRelay@MTO2026`

The password is stored as a bcrypt hash. For another database, the Network Administrator can run `python -m app.scripts.provision_mto`; it prompts for the password, or reads `MTO_PASSWORD` and `MTO_EMAIL`. It refuses to silently reconcile multiple existing MTO accounts. Database uniqueness also blocks concurrent creation of another MTO. Public MTO signup is unavailable. Demo seeding is disabled outside development.

For production, configure a strong `SECRET_KEY`, `APP_ENV`, approved CORS origins, HTTPS, and `FRONTEND_URL` (used in tracking QR links). Supply production MTO credentials through configuration; do not use the development password.

## Use the updated flows

1. **Facility signup:** Select “Register a pharmacy or hospital” on the existing login screen. Enter facility, representative, pharmacist (when applicable), licence and password information. Upload separate NIN evidence and Drug Licence documents (PDF/PNG/JPEG; 5 MB each).
2. **Verification:** NIN format validation is not verification. Login remains blocked until the administrator checks official records, records matching official NIN/name/address and reference, separately passes licence checks, and approves registration. Expired licences and inactive accounts are blocked on every authenticated request. No government API or simulated government verification is claimed.
3. **Administrator review:** Existing sidebar → Transfers → Review facility registrations. “Submit verification for an existing facility” lets the administrator attach evidence/NIN to an existing facility/account without replacing its record. Original demo facility accounts have no official verification and therefore remain blocked until this review is completed. Administrative and logistics accounts retain their staff login.
4. **MTO:** Existing sidebar → MTO → MTO Login → existing MTO Dashboard. Pharmacy sessions cannot use MTO review APIs. Logout revokes the token server-side. There is no extra landing-page MTO button or second dashboard.
5. **Request and donation:** An approved receiver opens Transfers → Create Medicine Request. Verified donors can review requests, reject their participation, or offer a partial/full quantity from eligible surplus. A successful offer reserves stock, records donor identity, and enters MTO review. Stock eligibility includes ownership, matching medicine specification, actual expiry, safety/demand allowance, and unreserved quantity.
6. **MTO review:** Open full details from the existing F2 queue to inspect facility/licence evidence, medicine/batch, storage and supporting documents. Approve, reject, request documents, or return for correction. Corrections release stock until donor reapproval. Final approval generates a unique Transfer ID and authenticated QR tracking link, then makes the order ready for dispatch. This is internal platform authorization, not statutory permission.
7. **Logistics:** Existing Logistics shows final-approved orders with IDs, batch, quantity, donor/receiver, MTO date, delivery date, search and status filters. “Track Order” opens existing transfer details. Logistics records dispatch personnel/carrier/reference, transit remarks, and delivery/receiving person through the action panel. Each action saves details and transition together. Tracking polls every 10 seconds and refreshes immediately after an action. There is no GPS integration.
8. **Receipt:** The receiving facility verifies medicine, batch, quantity, expiry, packaging and storage/transport condition. A discrepancy records a hold; it does not complete or add inventory. Successful confirmation completes the transfer, deducts donor quantity/releases its reservation, and adds receiver inventory in one guarded transaction. Repeated confirmation cannot duplicate either change.

## Compatibility and limits

- Historical transfers are retained. Old records created under the reversed approval sequence are not automatically treated as newly authorized transfers or shown as ready logistics orders. Recreate an outstanding request under the new workflow; no historical approvals are fabricated.
- The existing recommendation calculation/page is unchanged. Its old direct transfer-creation API cannot bypass the newly required receiver-first request and donor approval. Start the actionable request through Transfers.
- One donor allocation is supported per request in this prototype; a partial offer is explicitly recorded. A receiver can submit another request for the remaining quantity.
- Manual official-record verification requires a real authorized reviewer and records. No official NIN API access was available in the supplied project.
- Discrepancies remain awaiting verification until the receiver resolves and confirms them. A separate returns/claims workflow is outside the requested scope.
- Notifications use the existing in-app notification system. No external email/SMS service was added.
- PDF/image evidence is access controlled, bounded and checked by file signature. Production malware scanning, retention policy and at-rest database encryption require deployment infrastructure.
- Tracking reads persisted manual events; it does not invent GPS, telemetry, carrier integration or completed milestones.
- Inventory UI/calculations/schema, forecast, analytics and recommendation features and unrelated dashboards are unchanged. A one-line shared stock-refresh safeguard preserves the damaged flag so refreshed batches cannot become transferable by mistake. The shared status badge only adds the requested transfer statuses, and shared routing/auth changes enforce the requested access policy.

## Validation

See `CHANGE_REPORT.md` for the exact changed-file manifest and final test results. New backend tests are in `backend/scoped_tests/test_workflow.py`; run `PYTHONPATH=. pytest -q scoped_tests` from `backend/`. Existing authentication/inventory/forecast regression checks were run against an isolated test database. Browser checks used headless Chromium against the running FastAPI/Vite application.
