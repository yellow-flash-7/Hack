# ELOV REST API Documentation

The **Evidence-First LLM Output Verifier (ELOV)** provides a comprehensive RESTful API for executing fact-checking runs, ingesting documents, querying verification results, and performing human review audits.

---

## Base URL
```
http://localhost:5001/api
```
(Or via Vite dev proxy at `http://localhost:5173/api`)

---

## 1. System Health
### `GET /health`
Returns system status, PostgreSQL connectivity, AI provider config, uptime, and memory usage.

**Response:**
```json
{
  "status": "HEALTHY",
  "timestamp": "2026-10-09T22:20:00.000Z",
  "uptimeSeconds": 120,
  "database": {
    "status": "CONNECTED",
    "engine": "PostgreSQL 17 (Prisma ORM)",
    "error": null
  },
  "ai": {
    "provider": "deterministic",
    "configuredProviders": {
      "deterministic": true,
      "gemini": false,
      "openai": false
    }
  },
  "system": {
    "nodeVersion": "v24.19.0",
    "memory": {
      "heapUsedMB": 22,
      "rssMB": 84
    }
  }
}
```

---

## 2. Verification Runs
### `POST /verification-runs`
Submits an AI-generated answer for verification. Accepts either `multipart/form-data` (with files) or standard `application/json`.

**Request Body (JSON or Form-Data):**
- `rawAnswer` (string, required): The AI text containing claims and optional inline citations.
- `title` (string, optional): Title for the verification run.
- `mode` (string, optional): `STRICT`, `BALANCED` (default), or `EXPLORATORY`.
- `documentIds` (string[] or JSON string, optional): Array of pre-ingested document IDs to check against.
- `sourceUrls` (string[] or JSON string, optional): External URLs to fetch and verify against (protected by SSRF guard).
- `documents` (binary files, optional): Up to 5 uploaded PDF/TXT/DOCX reference documents.

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "run": {
      "id": "e9b6b1b3-7636-4eeb-9183-38cc1ba9fefe",
      "title": "Renewable Energy Fact-Check",
      "mode": "BALANCED",
      "status": "COMPLETED",
      "totalClaims": 2,
      "supportedCount": 2,
      "contradictedCount": 0,
      "partiallySupportedCount": 0,
      "insufficientCount": 0,
      "needsReviewCount": 0,
      "fabricatedCitationCount": 0,
      "calibratedConfidence": 0.94,
      "durationMs": 180,
      "claims": [...]
    },
    "report": {
      "overallVerdict": "VERIFIED",
      "executiveSummary": "Evaluated 2 atomic factual claims. All 2 claims are fully supported...",
      "metrics": {...},
      "claims": [...]
    }
  }
}
```

### `GET /verification-runs`
Lists verification runs with pagination.
- Query params: `page` (default: 1), `limit` (default: 20).

### `GET /verification-runs/:id`
Retrieves a single verification run with all atomic claims, citations, retrieved evidence excerpts, and decisions.

### `GET /verification-runs/:id/report`
Generates a downloadable structured verification report with provenance breadcrumbs and confidence metrics.

### `DELETE /verification-runs/:id`
Deletes a verification run and preserves an audit log entry.

---

## 3. Reference Documents
### `POST /documents`
Uploads and indexes reference documents into the verified library.
- Form fields: `files` (up to 10 files: PDF, TXT, DOCX), `sourceUrl` (optional URL), `title` (optional).

### `GET /documents`
Lists all reference documents with page count and chunk count.
- Query param: `search` (optional substring query on title or filename).

### `GET /documents/:id`
Returns document details along with all indexed chunks, page numbers, and section headings.

### `DELETE /documents/:id`
Deletes document and cascades all related chunks and evidence items.

---

## 4. Human Review & Audit Queue
### `GET /reviews`
Lists review tasks.
- Query param: `status` (`PENDING`, `APPROVED`, `MODIFIED`, `REJECTED`).

### `POST /reviews/:id/decision`
Records a human reviewer's verdict.
- Request Body:
```json
{
  "actionType": "ACCEPT",
  "newStatus": "SUPPORTED",
  "explanation": "Verified against section 2.1 of updated medical protocol.",
  "correctionText": "Optional corrected text",
  "reviewerName": "Dr. Sarah Chen"
}
```
**Constraint:** Original algorithmic results are permanently preserved in the audit log; reviewers cannot erase previous outputs silently.

---

## 5. Telemetry & Audit Logs
### `GET /stats`
Returns aggregate statistics (total runs, claim status counts, accuracy rate, fabricated citation count).

### `GET /audit-logs`
Returns the immutable system audit trail with timestamps and performed-by identities.
