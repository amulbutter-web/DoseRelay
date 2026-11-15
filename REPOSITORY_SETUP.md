# Repository setup

This repository contains the updated DoseRelay source, migration, tests and change reports. Local `.env` files, SQLite snapshots, dependencies and generated builds are intentionally excluded from Git. The original local archive is unchanged.

1. Copy `.env.example` to your local configuration and set DATABASE_URL and a new SECRET_KEY. Backend settings read `.env` from the backend working directory; set environment variables or create `backend/.env` accordingly.
2. Install `backend/requirements.txt` and run the backend from `backend/` using `uvicorn app.main:app --reload`. Development startup creates tables. For managed databases, use the migrations as documented in SCOPED_UPDATES.md.
3. For a new development database, run `python -m app.scripts.seed_demo_data` from `backend/` after table creation. Demo seeding is disabled outside development.
4. Run `python -m app.scripts.provision_mto` to provision the central account. For the requested prototype, use `mto@doserelay.demo` and enter the supplied development password `DoseRelay@MTO2026` at the prompt. Use separate credentials in production.
5. From `frontend/`, run `npm ci` and `npm run dev`.

Existing/demo facility users still need manual NIN verification and separate licence approval before signing in. Use the Network Administrator review flow described in SCOPED_UPDATES.md. No official verification is fabricated by the seed script.

See CHANGE_REPORT.md for the implementation file list and validation results. References to the supplied SQLite snapshot in that report describe the original local deliverable, not a database committed to GitHub.
