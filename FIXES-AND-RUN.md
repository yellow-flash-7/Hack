# ELOV fixes and run guide (Windows / VS Code)

## Fixes included

- Backend default port now matches the Vite `/api` proxy (`5001`). Without a local `.env`, the old backend default was `5000`, so the UI could load while API-backed buttons failed.
- Upload requests let Axios/browser generate the multipart boundary automatically.
- Document ingestion now generates and validates text chunks/embeddings before writing records, then saves the document and all chunks in a database transaction. Failed ingestion no longer leaves a newly created empty document record.
- Re-uploading content matching an older incomplete document repairs its missing chunks instead of returning the empty record.
- Uploads reject unsupported extensions early, enforce the 25 MB per-file / 10-file limits with readable errors, and return clearer responses for common Prisma/database failures.
- Failed verification, document upload/deletion, and human-review actions show actionable error messages instead of silently doing nothing.
- Verification loading UI no longer pretends individual stages have completed on a timer; it reflects the real request state.
- A reference document or source URL that fails ingestion now stops verification with a visible error instead of silently continuing without that evidence.
- “Request Evidence” leaves the review task pending rather than incorrectly marking it approved/resolved.
- JSON report download waits briefly before revoking its temporary object URL.

## Run step by step

### 1. Install prerequisites

Install Node.js 20 LTS or newer, VS Code, and PostgreSQL. The configured database URL defaults to PostgreSQL on port `5435`; use your actual database credentials/port if different.

### 2. Open the project

Extract the ZIP, open the extracted root folder in VS Code, then open **Terminal → New Terminal**. Make sure the terminal is in the folder containing the root `package.json`.

### 3. Create `.env`

PowerShell:

```powershell
Copy-Item .env.example .env
```

If `.env` already exists, do not overwrite it. Confirm these settings match your local services:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5435/elov_db?schema=public"
PORT=5001
CLIENT_URL="http://localhost:5173"
AI_PROVIDER="deterministic"
```

The deterministic provider is local rule-based mode; it does not mean a hosted AI model is connected.

### 4. Start PostgreSQL

Start PostgreSQL and create/use the `elov_db` database. If Docker is installed and configured, the project helper may be used:

```powershell
powershell -ExecutionPolicy Bypass -File ./scripts/start-db.ps1
```

### 5. Install packages

Run from the project root (not from `client` or `server`):

```bash
npm install
```

### 6. Prepare Prisma

Run each command and wait for it to finish before starting the next:

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

### 7. Start frontend and backend

```bash
npm run dev
```

Keep the terminal open. Open **http://localhost:5173** in your browser. The backend health endpoint is **http://localhost:5001/api/health**. It should report `database.status` as `CONNECTED`.

### 8. Test the main buttons

1. Open **Document Library → Upload Document**. Upload a small `.txt` file with text such as `The library closes at 6 PM.`
2. Confirm the document appears in the library and its chunk count is greater than zero.
3. Open **Verify AI Output**, paste `The library closes at 6 PM.`, select the uploaded document, then click **Execute Fact-Check**.
4. Confirm the app navigates to the results page. Expand a claim to inspect evidence.
5. Click **Download JSON Report** and confirm a JSON file downloads.
6. If a claim is flagged for review, open **Human Review**, select it, enter an explanation, and click **Confirm & Commit Decision**.
7. Test delete actions only on records you are happy to remove.

## If a button still fails

- Visit `http://localhost:5001/api/health`. If it does not open, check the SERVER terminal.
- If health reports the database as `DISCONNECTED`, start PostgreSQL and correct `DATABASE_URL`.
- In the browser press `F12` → **Console** and **Network**. Click the failing button and inspect the `/api/...` request.
- The page now displays the API error message for common mutations. Also read the SERVER terminal for the full diagnostic.
- After code changes, stop and restart `npm run dev` if Vite/tsx has not reloaded the server.

## Validation note

I inspected and patched the source, but this environment could not complete `npm install` because the package registry request timed out and the required package tarballs were not all cached. Therefore I cannot honestly claim that the full build or database-backed end-to-end tests passed here. Run `npm run build` and `npm test` locally after dependencies and PostgreSQL are installed.


## Document Library upload returns HTTP 500

1. Open `http://localhost:5001/api/health`. If the database is disconnected, start PostgreSQL and check `DATABASE_URL` in `.env`.
2. Watch the VS Code terminal labelled `SERVER` while uploading. The backend logs the route, error message, and (in development mode) stack trace.
3. Check the file: supported types are PDF, TXT, DOCX, and MD; each file must be 25 MB or smaller. A scanned/image-only PDF may require OCR because this app extracts selectable text.
4. If the same file was uploaded before a failed attempt, try uploading it again after updating this fixed version. Incomplete matching records are repaired when text extraction succeeds.
5. If the error remains, copy the server terminal error and the browser DevTools → Network response for `POST /api/documents`. Do not share API keys or database passwords.
