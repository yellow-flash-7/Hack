# ELOV System Architecture & Verification Pipeline

The **Evidence-First LLM Output Verifier (ELOV)** is built to solve a critical limitation of modern generative AI: **hallucinations, fabricated citations, and self-reported overconfidence**.

Instead of asking an LLM "are you confident in this answer?" (which frequently produces uncalibrated affirmative answers), ELOV enforces an empirical, evidence-first audit process.

---

## 1. Architectural Overview

```
                      +---------------------------------------+
                      |         User Input AI Answer          |
                      |    + Uploaded Documents / Source URLs |
                      +-------------------+-------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                        8-AGENT PIPELINE ORCHESTRATION                             |
|                                                                                   |
|  1. DocumentProcessingAgent   -->  PDF/DOCX Text Extraction, Chunking & Embeddings|
|  2. ClaimExtractionAgent      -->  Atomic propositions & Categorization (Factual) |
|  3. EvidenceRetrievalAgent    -->  PostgreSQL Hybrid RAG (FTS + Vector Cosine)    |
|  4. CitationValidationAgent   -->  Page bounds check, Real vs Fabricated citation |
|  5. EvidenceAnalysisAgent     -->  Natural Language Inference (Entailment / Neutral)
|  6. ContradictionDetection    -->  Numeric, Directional & Cross-Source Conflicts  |
|  7. VerificationDecisionAgent -->  Calibrated Confidence & Abstention Engine      |
|  8. ReportGenerationAgent     -->  Audit-Ready Provenance & JSON Report Export    |
+-----------------------------------------+-----------------------------------------+
                                          |
                        +-----------------+-----------------+
                        |                                   |
                        v                                   v
        +-------------------------------+   +-------------------------------+
        |    PostgreSQL 17 Database     |   |    Human Review & Audit Queue  |
        |  - 12 Relational Tables       |   |  - Clinical / Legal Escalation|
        |  - Full Text Search Indexes   |   |  - Non-Destructive Corrections|
        |  - Vector Embeddings          |   |  - Permanent Audit Trail      |
        +-------------------------------+   +-------------------------------+
```

---

## 2. The 8 Dedicated Verification Agents

### 1. Document Processing Agent
- Ingests PDF (`pdf-parse`), DOCX (`mammoth`), TXT, and external URLs (protected with SSRF DNS & IP filters).
- Calculates SHA-256 content hashes to avoid duplicate document ingestion.
- Splits text into overlapping sliding-window chunks (target: 250 words, overlap: 40 words) while preserving page numbers and section headings.
- Computes 384-dimensional semantic embeddings for each chunk and stores them in PostgreSQL.

### 2. Claim Extraction Agent
- Decomposes input paragraphs into atomic, independently checkable factual statements.
- Separates verifiable assertions from subjective opinions, future predictions, or speculative recommendations.
- Identifies inline citation markers (e.g., `[Clean Energy Report, p. 1]`, `[1]`).

### 3. Evidence Retrieval Agent
- Implements hybrid retrieval over PostgreSQL:
  $$\text{HybridScore} = 0.55 \cdot \text{VectorScore} + 0.45 \cdot \text{FTSScore}$$
- Full-Text Search incorporates stemming, medical/acronym aliases (`ACE`, `ARB`), and keyword overlap.
- Never equates semantic similarity with truth: candidate passages are merely candidates for logical inference.

### 4. Citation Validation Agent
- Validates citation references against the verified document catalog:
  - If document does not exist: **FABRICATED CITATION**
  - If cited page exceeds document's total page count: **FABRICATED CITATION**
  - If document exists but passage has no relation: **REAL CITATION WITH IRRELEVANT EVIDENCE**
  - If document and page exist and contain supporting facts: **VALID CITATION**

### 5. Evidence Analysis Agent
- Applies Natural Language Inference (NLI) to candidate passages:
  - **ENTAILMENT**: Passage logically proves the assertion.
  - **CONTRADICTION**: Passage empirical evidence refutes the assertion.
  - **NEUTRAL**: Passage relates to the topic but neither proves nor refutes.
- Extracts exact verbatim quotation spans and character offsets.

### 6. Contradiction Detection Agent
- Inspects numeric clashes (e.g., claimed 15% vs verified 32%, or 95 GW vs 45 GW).
- Inspects directional polarity clashes (growth/increase vs decline/drop).
- Detects intra-answer contradictions where two claims inside the same response refute each other.

### 7. Verification Decision & Abstention Engine
- Calculates statistically grounded calibrated confidence (0.0 to 1.0) based on evidence relevance, NLI certainty, citation integrity, and source agreement.
- Enforces strict abstention policies:
  - Routes sensitive medical recommendations with contradictions to `NEEDS_REVIEW`.
  - Flags conflicting evidence across multiple sources as `NEEDS_REVIEW`.
  - Marks unevidenced statements as `INSUFFICIENT_EVIDENCE`.

### 8. Report Generation Agent
- Compiles the executive verification summary, metric aggregates, claim-by-claim breakdown, and provenance trail into an audit-ready format.
