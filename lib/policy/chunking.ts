import { v4 as uuidv4 } from 'uuid';
import { PolicyChunk } from '@/lib/models/Policy';

interface ChunkingOptions {
  minWords?: number;
  maxWords?: number;
  overlapWords?: number;
}

/**
 * Chunk text with line mapping
 * Returns chunks with startLine/endLine and approximate pageNumber
 */
export function chunkTextWithLines(
  text: string,
  totalPages: number,
  options: ChunkingOptions = {}
): PolicyChunk[] {
  const minWords = options.minWords || 800;
  const maxWords = options.maxWords || 1200;
  const overlapWords = options.overlapWords || 175;

  // Split text into lines
  const lines = text.split('\n').filter(Boolean);
  const totalLines = lines.length;
  const linesPerPage = Math.ceil(totalLines / totalPages) || 1;

  const chunks: PolicyChunk[] = [];
  let currentChunk: string[] = [];
  let wordCount = 0;
  let chunkIndex = 0;
  let startLineIndex = 0;

  // Build chunks word by word
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const words = line.split(/\s+/).filter(Boolean);
    
    for (const word of words) {
      currentChunk.push(word);
      wordCount++;

      // If we've reached max words, finalize this chunk
      if (wordCount >= maxWords) {
        const chunkText = currentChunk.join(' ');
        const endLineIndex = lineIndex;
        
        // Calculate approximate page number
        const pageNumber = Math.min(
          Math.floor(startLineIndex / linesPerPage) + 1,
          totalPages
        );

        chunks.push({
          id: uuidv4(),
          policyId: '', // Will be set later
          documentId: '', // Will be set later
          chunkIndex: chunkIndex++,
          pageNumber,
          startLine: startLineIndex,
          endLine: endLineIndex,
          text: chunkText,
          wordCount: wordCount,
          isActive: true,
          createdAt: new Date(),
        });

        // Start next chunk with overlap
        const overlapWordsArray = currentChunk.slice(-overlapWords);
        currentChunk = overlapWordsArray;
        wordCount = overlapWordsArray.length;
        
        // Adjust start line for overlap (approximate)
        startLineIndex = Math.max(0, lineIndex - Math.floor(overlapWordsArray.length / 10));
      }
    }
  }

  // Add remaining words as final chunk
  if (currentChunk.length > 0) {
    // For short documents, create a chunk even if it's less than minWords
    // This ensures all documents have at least one chunk for search
    if (wordCount >= minWords || chunks.length === 0) {
      const chunkText = currentChunk.join(' ');
      const endLineIndex = lines.length - 1;
      const pageNumber = Math.min(
        Math.floor(startLineIndex / linesPerPage) + 1,
        totalPages
      );

      chunks.push({
        id: uuidv4(),
        policyId: '',
        documentId: '',
        chunkIndex: chunkIndex++,
        pageNumber,
        startLine: startLineIndex,
        endLine: endLineIndex,
        text: chunkText,
        wordCount: wordCount,
        isActive: true,
        createdAt: new Date(),
      });
    }
  }

  // If no chunks were created (very short text), create at least one chunk
  if (chunks.length === 0 && text.trim().length > 0) {
    const allWords = text.split(/\s+/).filter(Boolean);
    const chunkText = allWords.join(' ');
    const wordCount = allWords.length;
    
    chunks.push({
      id: uuidv4(),
      policyId: '',
      documentId: '',
      chunkIndex: 0,
      pageNumber: 1,
      startLine: 0,
      endLine: lines.length - 1,
      text: chunkText,
      wordCount: wordCount,
      isActive: true,
      createdAt: new Date(),
    });
  }

  return chunks;
}

