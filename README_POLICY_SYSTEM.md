# Policy Management System - Architecture

## Overview

Professional policy management system designed for hospitals with:
- **File-based storage**: PDFs stored on filesystem only
- **MongoDB indexing**: Metadata and text chunks in database
- **Scalable**: Supports thousands of policies
- **AI-ready**: Integrated with OpenAI for intelligent search

## Architecture

### Storage Structure

```
storage/
└── policies/
    └── 2025/
        ├── POL-2025-ABC12345-policy-name.pdf
        ├── POL-2025-DEF67890-another-policy.pdf
        └── ...
```

### MongoDB Schema

**Collection: `policy_documents` (Metadata Only)**

```typescript
{
  id: string;                    // UUID
  documentId: string;             // POL-2025-XXXXX
  fileName: string;               // Original filename
  filePath: string;               // Filesystem path
  fileHash: string;               // SHA-256 for deduplication (unique index)
  
  title: string;
  category?: string;
  section?: string;
  source?: string;
  version?: string;
  effectiveDate?: Date;
  expiryDate?: Date;
  
  totalPages: number;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  processingError?: string;
  
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}
```

**Collection: `policy_chunks` (Separate Collection)**

```typescript
{
  id: string;                     // UUID
  policyId: string;               // Reference to policy_documents.id
  documentId: string;             // Reference to policy_documents.documentId
  chunkIndex: number;
  pageNumber: number;             // Page number (or start page)
  pageStart?: number;             // Optional: if chunk spans pages
  pageEnd?: number;               // Optional: if chunk spans pages
  text: string;                   // Chunk text (indexed for full-text search)
  wordCount: number;
  createdAt: Date;
}
```

**Indexes:**
- `policy_documents.fileHash` (unique)
- `policy_documents.documentId`
- `policy_documents.isActive + processingStatus`
- `policy_chunks.text` (text index for full-text search)
- `policy_chunks.policyId`
- `policy_chunks.documentId`
- `policy_chunks.policyId + chunkIndex` (compound)

## API Endpoints

### 1. Upload Policy
**POST** `/api/er/policies/upload`

Upload and index a PDF policy document.

**Request:**
- `file`: PDF file (multipart/form-data)
- `title`: Optional title
- `category`: Optional category
- `section`: Optional section
- `source`: Optional source

**Response:**
```json
{
  "success": true,
  "documentId": "POL-2025-ABC12345",
  "title": "Policy Title",
  "totalPages": 25,
  "chunks": 15,
  "filePath": "/storage/policies/2025/..."
}
```

### 2. Search Policies
**GET** `/api/er/policies/search?q=query&category=cat&limit=10`

Text-based search across policy documents.

**Response:**
```json
{
  "query": "risk fall",
  "results": [
    {
      "document": { ... },
      "chunks": [ ... ],
      "relevanceScore": 5,
      "matchedSnippets": [ ... ]
    }
  ],
  "totalResults": 10
}
```

### 3. AI-Powered Search
**POST** `/api/er/policies/ai-search`

AI-powered semantic search using OpenAI.

**Request:**
```json
{
  "question": "What are the procedures for patient fall prevention?"
}
```

**Response:**
```json
{
  "answer": "Based on the policy documents...",
  "sources": [
    {
      "documentId": "POL-2025-ABC12345",
      "title": "Fall Prevention Policy",
      "pages": [5, 6, 7],
      "category": "Safety",
      "section": "Patient Care",
      "source": "Hospital Administration"
    }
  ],
  "relevantPolicies": [ ... ],
  "totalDocumentsSearched": 20,
  "totalChunksFound": 15
}
```

## Scripts

### Process PDFs from Command Line

```bash
# Process single file
node scripts/process-policy-pdfs.js /path/to/policy.pdf \
  --title "Policy Title" \
  --category "Safety" \
  --section "Patient Care" \
  --source "Hospital Admin"

# Process entire directory
node scripts/process-policy-pdfs.js /path/to/policies/

# With environment variables
POLICIES_DIR=/custom/path \
MONGO_URL=mongodb://... \
node scripts/process-policy-pdfs.js file.pdf
```

## Features

### 1. Deduplication
- Uses SHA-256 file hash to prevent duplicate uploads
- Returns existing document ID if file already processed

### 2. Text Chunking
- Splits large documents into searchable chunks (1000 words each)
- 200-word overlap between chunks for context
- Each chunk includes page number
- Chunks stored in separate `policy_chunks` collection to avoid 16MB limit

### 3. Search Capabilities
- **Text Search**: MongoDB text index on `policy_chunks.text` for fast full-text search
- **AI Search**: Semantic search using OpenAI GPT-4o-mini
- **Category Filter**: Filter by policy category
- **Relevance Scoring**: Results sorted by number of matching chunks

### 4. Scalability
- Files stored on filesystem (no MongoDB size limits)
- Only metadata in `policy_documents` (avoids 16MB document limit)
- Chunks in separate `policy_chunks` collection
- Efficient indexing for fast searches
- Supports thousands of documents with millions of chunks

### 5. AI Integration
- Context-aware answers using relevant policy excerpts
- Automatic source citation with page numbers
- Multi-document synthesis

## Environment Variables

```bash
MONGO_URL=mongodb://...
DB_NAME=hospital_ops
POLICIES_DIR=./storage/policies
OPENAI_API_KEY=sk-...
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
```

## Security

- **Role-based access**: Only admin/supervisor can upload
- **File validation**: Only PDF files accepted
- **Hash verification**: Prevents duplicate uploads
- **Path sanitization**: Prevents directory traversal

## Future Enhancements

1. **Vector Embeddings**: Store embeddings for semantic search
2. **Full-text Index**: MongoDB text index for faster searches
3. **Version Control**: Track policy versions and changes
4. **Access Control**: Per-policy permissions
5. **Analytics**: Track search queries and popular policies

## Usage Examples

### Upload via UI
1. Navigate to `/ai/new-policy`
2. Select PDF file
3. Enter metadata (optional)
4. Click "Upload"

### Upload via Script
```bash
node scripts/process-policy-pdfs.js \
  ./policies/fall-prevention.pdf \
  --title "Fall Prevention Policy" \
  --category "Safety" \
  --section "Patient Care"
```

### Search via API
```javascript
const response = await fetch('/api/er/policies/ai-search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    question: 'What are the procedures for handling patient falls?'
  })
});
const data = await response.json();
console.log(data.answer);
console.log(data.sources);
```

