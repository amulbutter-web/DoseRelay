# DoseRelay change report

## Features implemented and bugs fixed

- Facility signup with required information, private NIN/licence evidence, duplicate NIN prevention, manual official-record matching, independent licence approval and login gates.
- Existing sidebar MTO entry, separate MTO authentication, existing F2 dashboard access, revocable logout, and exactly one central MTO account with bcrypt hashing.
- Receiver-first medicine requests, partial/full donor offers, surplus validation and atomic reservation, MTO approval/rejection/document/correction actions, Transfer ID/QR generation and in-app notifications.
- Existing Logistics filters final-approved orders, supports search/status filters, and links to the existing detail page with a responsive nine-stage tracker using persisted events.
- Required dispatch/transit/delivery forms save metadata and status together. Receiver confirmation atomically reconciles both inventories and rejects duplicate completion. Discrepancies remain on hold.
- Fixed reversed approvals, missing receiver stock additions, unauthorized workflow actions, missing server-side facility checks, unauthenticated QR image loading and misleading live-telemetry claims.

## Validation

- Production TypeScript/Vite build: PASS (existing bundle-size warning remains).
- Targeted backend workflow suite: 16 PASS.
- Existing authentication, inventory and forecasting regression suite: 28 PASS.
- Headless Chromium: donor partial offer → sidebar MTO login → existing F2 → final approval → Logistics orders/tracking → dispatch → transit → delivery → receiver verification/completion: PASS, including logout protection and mobile tracking; no runtime errors.
- Headless Chromium signup/document upload → pending login denied → administrator manual review → approved login: PASS.
- Alembic 001 → 002 upgrade on a copy of the uploaded SQLite snapshot: PASS.
- Source comparison confirms inventory UI/calculations/schema, forecast, analytics, recommendation engines/pages and unrelated dashboards remain unchanged. The shared inventory status refresh has one necessary one-line change: preserve damaged stock flags so refresh cannot make them transferable. Existing database tables/rows are unchanged except the authorized central MTO user; additive tables support the scoped changes.

## Remaining limitations / setup

Manual verification needs an authorized reviewer and official records; no government API or GPS is fabricated. Original facility accounts need real verification before login. Historical reversed-workflow transfers remain historical and cannot bypass the new sequence. One donor allocation per request is supported; create another request for any unmet partial quantity. The old recommendation direct-create action is blocked by the receiver-first policy; actionable requests start in Transfers. See `SCOPED_UPDATES.md` for setup, migration, provisioning and deployment details.

## Files modified

- `backend/app/api/routes/auth.py`
- `backend/app/api/routes/transfers.py`
- `backend/app/core/security.py`
- `backend/app/main.py`
- `backend/app/schemas/transfer.py`
- `backend/app/scripts/seed_demo_data.py`
- `backend/app/services/inventory_service.py`
- `backend/app/services/transfer_service.py`
- `backend/doserelay.db`
- `backend/requirements.txt`
- `frontend/src/App.tsx`
- `frontend/src/api/auth.ts`
- `frontend/src/api/client.ts`
- `frontend/src/components/common/Badge.tsx`
- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/contexts/AuthContext.tsx`
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/pages/LogisticsPage.tsx`
- `frontend/src/pages/MTODashboardPage.tsx`
- `frontend/src/pages/PharmacistApprovalsPage.tsx`
- `frontend/src/pages/TransferDetailPage.tsx`
- `frontend/src/pages/TransfersPage.tsx`
- `frontend/src/types/index.ts`

## Files added

- `SCOPED_UPDATES.md`
- `backend/alembic/versions/002_scoped_verification_workflow.py`
- `backend/app/api/routes/registration.py`
- `backend/app/api/routes/requests.py`
- `backend/app/models/verification.py`
- `backend/app/scripts/provision_mto.py`
- `backend/app/services/verification_service.py`
- `backend/scoped_tests/test_workflow.py`
- `frontend/src/components/FacilitySignup.tsx`
- `frontend/src/components/MedicineRequests.tsx`
- `frontend/src/components/QrResolver.tsx`
- `frontend/src/components/RegistrationReview.tsx`
- `frontend/src/components/TransferWorkflow.tsx`
- `CHANGE_REPORT.md`
