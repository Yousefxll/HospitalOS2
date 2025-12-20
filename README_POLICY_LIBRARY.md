# Policy Library - Complete Setup Guide

## Overview

Complete Policy Library system with:
- PDF upload and indexing
- Full-text search with line/page references
- AI-powered Q&A
- Policy management (view/delete/deactivate)

## Architecture

### Storage
- **PDFs**: Stored on filesystem at `storage/policies/YYYY/`
- **MongoDB**: Only metadata and text chunks (no binary data)

### Collections

1. **policy_documents** (Metadata only)
   - `id`, `documentId`, `title`, `originalFileName`, `storedFileName`
   - `filePath`, `fileSize`, `fileHash` (SHA-256, unique)
   - `totalPages`, `createdAt`, `updatedAt`, `uploadedBy`
   - `isActive`, `deletedAt`, `tags[]`, `category`, `section`, `source`, etc.

2. **policy_chunks** (Text chunks)
   - `id`, `policyId`, `documentId`, `chunkIndex`
   - `pageNumber`, `startLine`, `endLine`
   - `text`, `wordCount`, `createdAt`

### Indexes
- `policy_documents.fileHash` (unique)
- `policy_documents.documentId`
- `policy_documents.isActive`
- `policy_chunks.text` (text index for full-text search)
- `policy_chunks.policyId`
- `policy_chunks.documentId`
- `policy_chunks(policyId, chunkIndex)` (compound)

## Setup Instructions

### 1. Create Indexes

```bash
node scripts/ensure-policy-indexes.js
```

Or set environment variables:
```bash
MONGO_URL=your_mongo_url DB_NAME=your_db_name node scripts/ensure-policy-indexes.js
```

### 2. Environment Variables

Add to `.env.local`:
```bash
MONGO_URL=your_mongodb_connection_string
DB_NAME=hospital_ops
POLICIES_DIR=./storage/policies
OPENAI_API_KEY=your_openai_api_key
```

### 3. Create Storage Directory

```bash
mkdir -p storage/policies
```

## API Endpoints

### 1. Upload Policy
**POST** `/api/policies/upload`

```bash
curl -X POST http://localhost:3000/api/policies/upload \
  -F "file=@policy.pdf" \
  -F "title=Policy Title" \
  -F "category=Safety" \
  -F "section=Patient Care" \
  -F "source=Hospital Admin" \
  -F "tags=safety,emergency" \
  -H "Cookie: auth-token=your_token"
```

**Response:**
```json
{
  "success": true,
  "documentId": "POL-2025-ABC12345",
  "policyId": "uuid",
  "totalPages": 25,
  "chunksCount": 15,
  "filePath": "storage/policies/2025/..."
}
```

### 2. List Policies
**GET** `/api/policies/list?active=1&query=&page=1&limit=20`

```bash
curl "http://localhost:3000/api/policies/list?active=1&page=1&limit=20" \
  -H "Cookie: auth-token=your_token"
```

### 3. Delete Policy
**DELETE** `/api/policies/:documentId?keepFile=true`

```bash
curl -X DELETE "http://localhost:3000/api/policies/POL-2025-ABC12345" \
  -H "Cookie: auth-token=your_token"
```

### 4. Search Policies
**POST** `/api/policies/search`

```bash
curl -X POST http://localhost:3000/api/policies/search \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=your_token" \
  -d '{
    "q": "patient fall prevention",
    "limit": 10,
    "includeInactive": false
  }'
```

**Response:**
```json
{
  "query": "patient fall prevention",
  "results": [
    {
      "documentId": "POL-2025-ABC12345",
      "title": "Fall Prevention Policy",
      "originalFileName": "fall-prevention.pdf",
      "filePath": "storage/policies/2025/...",
      "totalPages": 25,
      "matches": [
        {
          "pageNumber": 5,
          "startLine": 120,
          "endLine": 135,
          "snippet": "...prevention procedures...",
          "score": 1.5
        }
      ]
    }
  ],
  "totalResults": 1
}
```

### 5. AI Ask
**POST** `/api/policies/ai-ask`

```bash
curl -X POST http://localhost:3000/api/policies/ai-ask \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=your_token" \
  -d '{
    "question": "What are the procedures for patient fall prevention?",
    "limitDocs": 10,
    "limitChunks": 15
  }'
```

**Response:**
```json
{
  "answer": "Based on the policy documents...",
  "sources": [
    {
      "documentId": "POL-2025-ABC12345",
      "title": "Fall Prevention Policy",
      "fileName": "fall-prevention.pdf",
      "pageNumber": 5,
      "startLine": 120,
      "endLine": 135,
      "snippet": "...prevention procedures..."
    }
  ],
  "matchedDocuments": [
    {
      "documentId": "POL-2025-ABC12345",
      "title": "Fall Prevention Policy",
      "fileName": "fall-prevention.pdf"
    }
  ]
}
```

### 6. View PDF
**GET** `/api/policies/view/:documentId`

Returns PDF file for inline viewing.

## Frontend Pages

### 1. Upload Policy
**Route:** `/policies/upload`

- File upload form
- Metadata fields (title, category, section, source, tags, etc.)
- Progress indicator
- Duplicate detection message

### 2. Policy Library
**Route:** `/policies`

- Search box
- Policy list with pagination
- Search results with snippets
- View/Delete buttons
- Toggle inactive policies

### 3. Ask AI
**Route:** `/policies/ask`

- Question input
- AI-generated answer
- Source cards with citations
- Search history

## Chunking Algorithm

- **Chunk Size**: 800-1200 words
- **Overlap**: 150-200 words
- **Line Mapping**: 
  - Split text into lines
  - Calculate `linesPerPage = ceil(totalLines / totalPages)`
  - Store `startLine` and `endLine` for each chunk
  - Approximate `pageNumber = floor(startLine / linesPerPage) + 1`

## Features

✅ PDF upload with validation
✅ SHA-256 hash deduplication
✅ Text extraction and chunking
✅ Full-text search with MongoDB text index
✅ AI-powered Q&A with OpenAI
✅ Source citations with page/line numbers
✅ Policy management (view/delete/deactivate)
✅ Pagination and filtering
✅ Search history

## Security

- Role-based access (admin/supervisor only for upload/delete)
- File validation (PDF header check)
- Safe filename sanitization
- Soft delete (isActive flag)

## Troubleshooting

### Indexes not created
```bash
node scripts/ensure-policy-indexes.js
```

### PDF parsing fails
- Check if PDF is password-protected
- Verify PDF is not corrupted
- Ensure `pdf-parse` is installed

### OpenAI API errors
- Verify `OPENAI_API_KEY` in environment
- Check API quota/limits
- Verify network connectivity

### File not found
- Check `POLICIES_DIR` environment variable
- Verify file exists in filesystem
- Check file permissions

## Next Steps

1. Run index creation script
2. Upload test PDF via UI
3. Test search functionality
4. Test AI Q&A
5. Configure OpenAI API key

