# Policy Engine Service

A production-grade service for automatic policy document ingestion, OCR, chunking, indexing, and semantic search.

## Features

- **Automatic Ingestion**: Upload PDFs and images, processing starts immediately
- **OCR Support**: Automatic OCR for scanned documents using EasyOCR
- **Resumable Jobs**: Jobs can resume after service restart, never lose progress
- **Vector Search**: Semantic search using sentence-transformers and ChromaDB
- **Tenant Isolation**: All data is isolated by tenantId
- **Batch Processing**: Efficient batch processing for large files

## Setup

### Prerequisites

- Python 3.9+
- Tesseract (optional, for OCR fallback)
- Poppler (optional, for PDF to image conversion)

### Installation

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Set environment variables (optional):
```bash
export POLICY_ENGINE_DATA_DIR=./data
export EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
export OPENAI_API_KEY=your_key_here  # Required for generate, harmonize, and conflicts features
```

3. Run the service:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

Or using Python:
```bash
python -m app.main
```

Note: Default port is 8001 (can be changed via uvicorn --port flag)

## API Endpoints

### Health Check

```bash
GET /health
```

Response:
```json
{"ok": true}
```

Response:
```json
{"ok": true}
```

### Ingest Files

```bash
POST /v1/ingest
Content-Type: multipart/form-data

Fields:
- tenantId: string (required)
- uploaderUserId: string (required)
- files: file(s) (required)
```

Example with curl:
```bash
curl -X POST "http://localhost:8001/v1/ingest" \
  -F "tenantId=tenant-123" \
  -F "uploaderUserId=user-456" \
  -F "files=@policy.pdf"
```

Response:
```json
{
  "tenantId": "tenant-123",
  "jobs": [
    {
      "jobId": "uuid-here",
      "policyId": "policy-uuid",
      "filename": "policy.pdf",
      "status": "QUEUED"
    }
  ]
}
```

### Get Job Status

### List Policies

```bash
GET /v1/policies?tenantId=tenant-123
```

Response:
```json
{
  "tenantId": "tenant-123",
  "policies": [
    {
      "policyId": "policy-uuid",
      "filename": "policy.pdf",
      "status": "READY",
      "indexedAt": "2024-01-01T12:00:00",
      "progress": {
        "pagesTotal": 10,
        "pagesDone": 10,
        "chunksTotal": 45,
        "chunksDone": 45
      },
      "jobId": "job-uuid"
    }
  ]
}
```

### Get Job Status

```bash
GET /v1/jobs/{job_id}?tenantId=tenant-123
```

Response:
```json
{
  "jobId": "uuid-here",
  "tenantId": "tenant-123",
  "policyId": "policy-uuid",
  "filename": "policy.pdf",
  "status": "READY",
  "progress": {
    "pagesTotal": 10,
    "pagesDone": 10,
    "chunksTotal": 45,
    "chunksDone": 45
  },
  "error": null
}
```

### Delete Policy

```bash
DELETE /v1/policies/{policy_id}?tenantId=tenant-123
```

Response:
```json
{
  "tenantId": "tenant-123",
  "policyId": "policy-uuid",
  "deleted": true
}
```

### Get Policy File

```bash
GET /v1/policies/{policy_id}/file?tenantId=tenant-123
```

Response: PDF file stream (Content-Type: application/pdf)

### Search Policies

```bash
POST /v1/search
Content-Type: application/json

{
  "tenantId": "tenant-123",
  "query": "falls prevention",
  "topK": 10
}
```

Response:
```json
{
  "tenantId": "tenant-123",
  "query": "falls prevention",
  "results": [
    {
      "policyId": "policy-uuid",
      "filename": "policy.pdf",
      "score": 0.85,
      "pageNumber": 5,
      "lineStart": 12,
      "lineEnd": 18,
      "snippet": "Falls prevention measures include...",
      "reference": {
        "source": "uploaded",
        "storedPath": "data/files/tenant-123/policy-uuid/policy.pdf"
      }
    }
  ]
}
```

### Detect Conflicts (Stub)

```bash
POST /v1/conflicts
Content-Type: application/json

{
  "tenantId": "tenant-123",
  "mode": "pair",
  "policyIdA": "policy-1",
  "policyIdB": "policy-2"
}
```

### Harmonize Policies (Stub)

```bash
POST /v1/harmonize
Content-Type: application/json

{
  "tenantId": "tenant-123",
  "topic": "crash cart",
  "policyIds": ["policy-1", "policy-2"]
}
```

### Generate Policy (Stub)

```bash
POST /v1/generate
Content-Type: application/json

{
  "tenantId": "tenant-123",
  "title": "New Policy Title",
  "context": "Context information",
  "standard": "CBAHI"
}
```

Response:
```json
{
  "tenantId": "tenant-123",
  "title": "New Policy Title",
  "policy": ""
}
```

## Data Structure

The service stores data in the following structure:

```
data/
├── files/
│   └── {tenantId}/
│       └── {policyId}/
│           └── original.ext
├── text/
│   └── {tenantId}/
│       └── {policyId}/
│           └── page_0001.txt
│           └── page_0002.txt
│           └── ...
├── manifests/
│   └── {tenantId}/
│       └── {policyId}.json
├── jobs/
│   └── {jobId}.json
└── chroma/
    └── (ChromaDB data)
```

## Job Status

- `QUEUED`: Job is waiting to be processed
- `PROCESSING`: Job is currently being processed
- `READY`: Job completed successfully
- `FAILED`: Job failed with an error

## Resumable Processing

Jobs are automatically resumed on service startup if they were interrupted. The service uses manifest files to track progress per page, so it never re-processes completed pages unless the file hash changes.

## Tenant Isolation

Every request must include `tenantId`. All data (files, vectors, manifests) are stored in tenant-specific directories and collections. This ensures complete data isolation between tenants.

## Error Handling

- If a single page fails OCR, it's marked as failed but processing continues
- If a file fails completely, the job is marked as FAILED but other files continue
- All errors are stored in the job status for debugging
