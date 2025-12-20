/**
 * Policy Library - MongoDB Schemas
 */
import type { ObjectId } from 'mongodb';

export interface PolicyDocument {
  _id?: ObjectId;
  id: string; // UUID
  documentId: string; // POL-2025-XXXXXX

  title: string;
  originalFileName: string;
  storedFileName: string;
  filePath: string; // storage/policies/YYYY/...
  fileSize: number;
  fileHash: string; // SHA-256, unique
  mimeType: 'application/pdf';

  totalPages: number;
  chunksCount?: number;

  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  processedAt?: Date;
  processingError?: string;

  storageYear: number;

  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;

  isActive: boolean;
  deletedAt?: Date | null;

  tags?: string[];
  category?: string;
  section?: string;
  source?: string;
  version?: string;
  effectiveDate?: Date;
  expiryDate?: Date;
  hospital?: string; // Inferred from fileName prefix (TAK, WHH, etc.)
}

export interface PolicyChunk {
  _id?: ObjectId;
  id: string; // UUID
  policyId: string; // UUID -> policy_documents.id
  documentId: string; // POL-2025-XXXXXX

  chunkIndex: number;
  pageNumber: number; // approximate OK
  startLine: number;
  endLine: number;

  text: string;
  wordCount: number;

  isActive: boolean;
  createdAt: Date;
  updatedAt?: Date;
  hospital?: string; // Inferred from fileName prefix (TAK, WHH, etc.)
}

export interface PolicySearchMatch {
  pageNumber: number;
  startLine: number;
  endLine: number;
  snippet: string;
  score?: number;
}

export interface PolicySearchResult {
  documentId: string;
  title: string;
  originalFileName: string;
  filePath: string;
  totalPages: number;
  matches: PolicySearchMatch[];
}

export interface PolicyAISource {
  documentId: string;
  title: string;
  fileName: string;
  pageNumber: number;
  startLine: number;
  endLine: number;
  snippet: string;
}

export interface PolicyAIResponse {
  answer: string;
  sources: PolicyAISource[];
  matchedDocuments: Array<{
    documentId: string;
    title: string;
    fileName: string;
  }>;
}
