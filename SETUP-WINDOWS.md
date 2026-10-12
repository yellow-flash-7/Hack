# ELOV — Run in VS Code (Windows)

This is the source project for **Evidence-First LLM Output Verifier**. The interface has been polished with a clearer dark theme, better focus states, and a mobile-friendly navigation row.

## Before you start

Install:
1. **Node.js 20 LTS or newer** from https://nodejs.org/ (npm is included).
2. **PostgreSQL** (the project configuration expects a database on port `5435` by default).
3. **Visual Studio Code** from https://code.visualstudio.com/.

## Step 1 — Open the project

1. Extract `ELOV-VSCode.zip` to a normal folder such as `C:\Projects\ELOV-VSCode`.
2. Open VS Code.
3. Select **File → Open Folder** and choose the extracted folder.
4. In VS Code choose **Terminal → New Terminal**.
5. Confirm the terminal is in the project root (the folder containing the root `package.json`).

## Step 2 — Create your local environment file

Copy `.env.example` and name the copy `.env` in the project root.

PowerShell command:
```powershell
Copy-Item .env.example .env
```

The default database URL is:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5435/elov_db?schema=public"
```

Change the username, password, port, and database name to match your PostgreSQL setup. Never share your `.env` file or API keys.

## Step 3 — Start PostgreSQL

Make sure PostgreSQL is running and the database connection matches `.env`.

The project includes an optional helper:
```powershell
powershell -ExecutionPolicy Bypass -File ./scripts/start-db.ps1
```
Use that helper only if its local Docker/PostgreSQL prerequisites are installed. Otherwise start PostgreSQL using the method you normally use.

## Step 4 — Install dependencies

Run this once from the project root:
```bash
npm install
```
Wait until npm finishes. Do not run this inside `client` or `server`; run it in the root folder.

## Step 5 — Prepare the database

Run these commands one at a time, from the root:
```bash
npm run db:generate
npm run db:push
npm run db:seed
```
If a command fails, check that PostgreSQL is running and `DATABASE_URL` is correct before continuing.

## Step 6 — Start the app

From the project root:
```bash
npm run dev
```
Keep this terminal open. It starts the backend and frontend development servers.

Open the frontend in your browser:
- **App:** http://localhost:5173
- **API health check:** http://localhost:5001/api/health

If the API health check does not open, read the **SERVER** terminal output first. The actual API port is controlled by `PORT` in `.env`.

## Step 7 — Try a first verification

1. Open **Document Library**.
2. Upload a small TXT file containing:
   ```text
   The library opens at 9 AM. The library closes at 6 PM. The library is closed on Sundays.
   ```
3. Open **New Verification**.
4. Paste one claim at a time:
   - `The library closes at 6 PM.` — expected to be supported if the document was indexed successfully.
   - `The library closes at 8 PM.` — expected to be contradicted if the document was indexed successfully.
   - `The library has 40 computers.` — expected to need more evidence.
5. Open the results and check the cited evidence passage. Treat the result as a decision aid, not a guarantee of truth.

## Step 8 — Run checks

Open a second terminal at the project root, or stop the dev servers with `Ctrl+C` first:
```bash
npm test
npm run evaluate
npm run build
```
These commands may expose pre-existing test or TypeScript issues; read the error output rather than assuming the project is fully passing.

## Common problems

- **`npm` is not recognized:** install Node.js, then close and reopen VS Code.
- **Database connection error:** start PostgreSQL and verify the `DATABASE_URL` credentials and port.
- **Port already in use:** close the process using that port or change the port in `.env`.
- **Blank page:** check the browser Developer Tools → Console and the Vite terminal.
- **Upload/verification fails:** check both the client and server terminals, then confirm the document upload API returns success.
- **No semantic LLM response:** `AI_PROVIDER="deterministic"` is the default offline/rule-based mode. It does not mean a live hosted LLM is running. To use a supported provider, configure its API key and provider setting in your private `.env`.

## Important security note

The original archive contained a `.env` file, which is deliberately excluded from this cleaned source ZIP so secrets are not redistributed. If that file contained a real API key or password that has been shared, rotate it. `.env` should remain local and must not be committed to source control.
