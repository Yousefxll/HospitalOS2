/**
 * Policy Document Schema
 * 
 * MongoDB schema for indexing policy documents.
 * PDF files are stored on filesystem, only metadata in MongoDB.
 * Text chunks are stored in separate policy_chunks collection.
 */

export interface PolicyDocument {
  // Unique identifiers
  id: string;
  documentId: string; // Unique document ID (e.g., "POL-2025-001")
  
  // File information
  fileName: string;
  filePath: string; // Path on filesystem (e.g., "/policies/2025/policy-001.pdf")
  fileHash: string; // SHA-256 hash for deduplication
  
  // Document metadata
  title: string;
  category?: string;
  section?: string;
  source?: string;
  version?: string;
  effectiveDate?: Date;
  expiryDate?: Date;
  
  // Processing metadata
  totalPages: number;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  processingError?: string;
  
  // Audit fields
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface PolicyChunk {
  id: string;
  policyId: string; // Reference to policy_documents.id
  documentId: string; // Reference to policy_documents.documentId
  chunkIndex: number;
  pageNumber: number; // Single page number (or start page if spanning multiple)
  pageStart?: number; // Optional: if chunk spans multiple pages
  pageEnd?: number; // Optional: if chunk spans multiple pages
  text: string;
  wordCount: number;
  createdAt: Date;
}

export interface PolicySearchResult {
  document: PolicyDocument;
  chunks: PolicyChunk[];
  relevanceScore: number;
  matchedSnippets: string[];
}
