/**
 * Taxonomy Matching Utility
 * 
 * Provides robust matching between AI-suggested taxonomy items and existing database items
 * using normalization, synonyms/aliases, and fuzzy string similarity.
 */

// Common department synonyms/aliases (tenant-specific, should be configurable)
export const DEPARTMENT_ALIASES: Record<string, string[]> = {
  // ICU variations
  'icu': ['intensive care', 'intensive care unit', 'intensive care department'],
  'intensive care unit': ['icu', 'intensive care', 'intensive care department'],
  'intensive care': ['icu', 'intensive care unit'],
  
  // Emergency variations
  'er': ['emergency', 'emergency room', 'emergency department', 'ed', 'accident and emergency'],
  'emergency': ['er', 'emergency room', 'emergency department', 'ed', 'accident and emergency'],
  'emergency department': ['er', 'emergency', 'emergency room', 'ed'],
  
  // CCU variations
  'ccu': ['coronary care', 'coronary care unit', 'cardiac care unit'],
  'coronary care unit': ['ccu', 'coronary care', 'cardiac care unit'],
  
  // Operating Room variations
  'or': ['operating room', 'operating theatre', 'surgery', 'surgical suite'],
  'operating room': ['or', 'operating theatre', 'surgery'],
  'operating theatre': ['or', 'operating room', 'surgery'],
  
  // NICU variations
  'nicu': ['neonatal intensive care', 'neonatal intensive care unit', 'neonatal icu'],
  'neonatal intensive care unit': ['nicu', 'neonatal intensive care'],
  
  // PICU variations
  'picu': ['pediatric intensive care', 'pediatric intensive care unit', 'pediatric icu'],
  'pediatric intensive care unit': ['picu', 'pediatric intensive care'],
  
  // Internal Medicine variations
  'im': ['internal medicine', 'internal medicine department'],
  'internal medicine': ['im', 'internal medicine department'],
  
  // Other common variations
  'lab': ['laboratory', 'laboratory department', 'clinical laboratory'],
  'laboratory': ['lab', 'laboratory department'],
  'pharmacy': ['pharmaceutical services', 'pharmacy department'],
  'radiology': ['imaging', 'imaging department', 'radiology department'],
  'imaging': ['radiology', 'radiology department', 'imaging department'],
};

// Common suffix words to remove during normalization
const SUFFIX_WORDS = ['unit', 'department', 'dept', 'division', 'section', 'clinic', 'center', 'centre', 'services', 'service'];

// Common stopwords to remove
const STOPWORDS = ['the', 'of', 'for', 'and', 'a', 'an', 'in', 'on', 'at', 'to', 'from'];

/**
 * Normalize a string for matching:
 * - lowercase
 * - trim
 * - remove punctuation
 * - collapse multiple spaces
 * - remove common suffix words
 * - normalize "&" -> "and"
 * - remove stopwords
 */
export function normalizeString(str: string): string {
  if (!str) return '';
  
  let normalized = str
    .toLowerCase()
    .trim()
    // Remove punctuation except spaces
    .replace(/[^\w\s]/g, ' ')
    // Normalize "&" -> "and" (before removing punctuation)
    .replace(/&/g, 'and')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim();
  
  // Remove suffix words
  const words = normalized.split(' ');
  const filteredWords = words.filter(word => !SUFFIX_WORDS.includes(word));
  
  // Remove stopwords
  const withoutStopwords = filteredWords.filter(word => !STOPWORDS.includes(word));
  
  return withoutStopwords.join(' ').trim();
}

/**
 * Check if a string matches any alias in the aliases map
 * Returns the canonical name if found, null otherwise
 */
export function findAliasMatch(normalizedInput: string, aliases: Record<string, string[]>): string | null {
  // Check if input matches any alias key
  for (const [canonical, variations] of Object.entries(aliases)) {
    const normalizedCanonical = normalizeString(canonical);
    if (normalizedInput === normalizedCanonical) {
      return canonical;
    }
    
    // Check if input matches any variation
    for (const variation of variations) {
      const normalizedVariation = normalizeString(variation);
      if (normalizedInput === normalizedVariation) {
        return canonical;
      }
    }
  }
  
  return null;
}

/**
 * Calculate Jaro-Winkler similarity between two strings
 * Returns a value between 0 and 1 (1 = identical)
 */
export function jaroWinklerSimilarity(str1: string, str2: string): number {
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);
  
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;
  
  // Jaro distance
  const matchWindow = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);
  
  let matches = 0;
  let transpositions = 0;
  
  // Find matches
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, s2.length);
    
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }
  
  if (matches === 0) return 0.0;
  
  // Find transpositions
  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }
  
  const jaro = (
    matches / s1.length +
    matches / s2.length +
    (matches - transpositions / 2) / matches
  ) / 3.0;
  
  // Winkler modification (common prefix up to 4 chars)
  let prefix = 0;
  for (let i = 0; i < Math.min(4, s1.length, s2.length); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }
  
  return jaro + (0.1 * prefix * (1 - jaro));
}

/**
 * Token set ratio similarity (alternative to Jaro-Winkler)
 * Better for multi-word strings
 */
export function tokenSetRatio(str1: string, str2: string): number {
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);
  
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;
  
  const tokens1 = new Set(s1.split(' ').filter(t => t.length > 0));
  const tokens2 = new Set(s2.split(' ').filter(t => t.length > 0));
  
  const intersection = new Set([...tokens1].filter(t => tokens2.has(t)));
  const union = new Set([...tokens1, ...tokens2]);
  
  if (union.size === 0) return 0.0;
  
  return intersection.size / union.size;
}

/**
 * Combined similarity score (uses both Jaro-Winkler and token set ratio)
 */
export function combinedSimilarity(str1: string, str2: string): number {
  const jw = jaroWinklerSimilarity(str1, str2);
  const tsr = tokenSetRatio(str1, str2);
  
  // Weighted average (favor token set ratio for multi-word strings)
  return (jw * 0.4 + tsr * 0.6);
}

export interface MatchResult {
  matched: boolean;
  matchType: 'exact' | 'alias' | 'fuzzy' | 'none';
  matchedItem?: {
    id: string;
    name: string;
    similarity: number;
  };
  requiresConfirmation: boolean; // true if similarity 0.75-0.87
}

/**
 * Match an AI-suggested department name against existing departments
 */
export function matchDepartment(
  aiDepartmentName: string,
  existingDepartments: Array<{ id: string; name: string; label?: string }>
): MatchResult {
  if (!aiDepartmentName || !aiDepartmentName.trim()) {
    return {
      matched: false,
      matchType: 'none',
      requiresConfirmation: false,
    };
  }
  
  const normalizedAI = normalizeString(aiDepartmentName);
  
  // CRITICAL LOGGING: Log matching process
  console.log(`[matchDepartment] Matching "${aiDepartmentName}" (normalized: "${normalizedAI}")`, {
    aiDepartmentName,
    normalizedAI,
    existingDepartmentsCount: existingDepartments.length,
    existingDepartments: existingDepartments.slice(0, 10).map(d => ({ id: d.id, name: d.name, label: d.label })),
  });
  
  // Step 1: Try exact match on normalized name
  for (const dept of existingDepartments) {
    const normalizedExisting = normalizeString(dept.name || dept.label || '');
    if (normalizedAI === normalizedExisting) {
      console.log(`[matchDepartment] ✅ Exact match: "${aiDepartmentName}" → "${dept.name}" (ID: ${dept.id})`);
      return {
        matched: true,
        matchType: 'exact',
        matchedItem: {
          id: dept.id,
          name: dept.name || dept.label || '',
          similarity: 1.0,
        },
        requiresConfirmation: false,
      };
    }
  }
  
  // Step 2: Try alias match
  const aliasMatch = findAliasMatch(normalizedAI, DEPARTMENT_ALIASES);
  if (aliasMatch) {
    console.log(`[matchDepartment] Found alias match: "${normalizedAI}" → "${aliasMatch}"`);
    // Find the canonical department - try both normalized and exact name match
    for (const dept of existingDepartments) {
      const deptName = dept.name || dept.label || '';
      const normalizedExisting = normalizeString(deptName);
      const normalizedCanonical = normalizeString(aliasMatch);
      
      // Try normalized match first
      if (normalizedExisting === normalizedCanonical) {
        console.log(`[matchDepartment] ✅ Alias match (normalized): "${aiDepartmentName}" → "${deptName}" (ID: ${dept.id})`);
        return {
          matched: true,
          matchType: 'alias',
          matchedItem: {
            id: dept.id,
            name: deptName,
            similarity: 0.95, // High confidence for alias match
          },
          requiresConfirmation: false,
        };
      }
      
      // Also try case-insensitive exact match on original names
      if (deptName.toLowerCase() === aliasMatch.toLowerCase() || 
          deptName.toLowerCase() === normalizedAI.toLowerCase()) {
        console.log(`[matchDepartment] ✅ Alias match (exact): "${aiDepartmentName}" → "${deptName}" (ID: ${dept.id})`);
        return {
          matched: true,
          matchType: 'alias',
          matchedItem: {
            id: dept.id,
            name: deptName,
            similarity: 0.95,
          },
          requiresConfirmation: false,
        };
      }
    }
    
    console.warn(`[matchDepartment] ⚠️ Alias match found ("${aliasMatch}") but no matching department in existingDepartments`);
  }
  
  // Step 3: Fuzzy match
  let bestMatch: { id: string; name: string; similarity: number } | null = null;
  let bestSimilarity = 0;
  const similarityScores: Array<{ id: string; name: string; similarity: number }> = [];
  
  for (const dept of existingDepartments) {
    const similarity = combinedSimilarity(aiDepartmentName, dept.name || dept.label || '');
    similarityScores.push({
      id: dept.id,
      name: dept.name || dept.label || '',
      similarity,
    });
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = {
        id: dept.id,
        name: dept.name || dept.label || '',
        similarity,
      };
    }
  }
  
  // Log top similarity scores for debugging
  const topScores = similarityScores
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);
  console.log(`[matchDepartment] Fuzzy match scores for "${aiDepartmentName}":`, topScores);
  
  if (bestMatch) {
    if (bestSimilarity >= 0.88) {
      // Auto-select
      console.log(`[matchDepartment] ✅ Fuzzy match (auto): "${aiDepartmentName}" → "${bestMatch.name}" (ID: ${bestMatch.id}, similarity: ${bestSimilarity.toFixed(3)})`);
      return {
        matched: true,
        matchType: 'fuzzy',
        matchedItem: bestMatch,
        requiresConfirmation: false,
      };
    } else if (bestSimilarity >= 0.75) {
      // Possible match, requires confirmation
      console.log(`[matchDepartment] ⚠️ Fuzzy match (needs confirmation): "${aiDepartmentName}" → "${bestMatch.name}" (ID: ${bestMatch.id}, similarity: ${bestSimilarity.toFixed(3)})`);
      return {
        matched: true,
        matchType: 'fuzzy',
        matchedItem: bestMatch,
        requiresConfirmation: true,
      };
    } else {
      console.log(`[matchDepartment] ❌ Fuzzy match below threshold: "${aiDepartmentName}" → "${bestMatch.name}" (ID: ${bestMatch.id}, similarity: ${bestSimilarity.toFixed(3)}, threshold: 0.75)`);
    }
  }
  
  // No match found
  console.log(`[matchDepartment] ❌ No match found for "${aiDepartmentName}"`);
  return {
    matched: false,
    matchType: 'none',
    requiresConfirmation: false,
  };
}

/**
 * Match an AI-suggested taxonomy item (operation, function, risk domain) against existing items
 */
export function matchTaxonomyItem(
  aiItemName: string,
  existingItems: Array<{ id: string; name: string }>
): MatchResult {
  if (!aiItemName || !aiItemName.trim()) {
    return {
      matched: false,
      matchType: 'none',
      requiresConfirmation: false,
    };
  }
  
  const normalizedAI = normalizeString(aiItemName);
  
  // Step 1: Exact match
  for (const item of existingItems) {
    const normalizedExisting = normalizeString(item.name);
    if (normalizedAI === normalizedExisting) {
      return {
        matched: true,
        matchType: 'exact',
        matchedItem: {
          id: item.id,
          name: item.name,
          similarity: 1.0,
        },
        requiresConfirmation: false,
      };
    }
  }
  
  // Step 2: Fuzzy match
  let bestMatch: { id: string; name: string; similarity: number } | null = null;
  let bestSimilarity = 0;
  
  for (const item of existingItems) {
    const similarity = combinedSimilarity(aiItemName, item.name);
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = {
        id: item.id,
        name: item.name,
        similarity,
      };
    }
  }
  
  if (bestMatch) {
    // CRITICAL: Lower thresholds for better auto-matching
    // Auto-match: >= 0.75 (was 0.88) - more lenient for taxonomy items
    // Requires confirmation: >= 0.65 (was 0.75) - still show match but ask user
    
    // CRITICAL LOGGING: Log similarity scores for debugging
    console.log(`[matchTaxonomyItem] Best match for "${aiItemName}":`, {
      matchedItem: bestMatch.name,
      similarity: bestSimilarity,
      autoMatchThreshold: 0.75,
      confirmationThreshold: 0.65,
      willAutoMatch: bestSimilarity >= 0.75,
      willRequireConfirmation: bestSimilarity >= 0.65 && bestSimilarity < 0.75,
    });
    
    if (bestSimilarity >= 0.75) {
      // Auto-match with high confidence
      console.log(`[matchTaxonomyItem] ✅ Auto-matched "${aiItemName}" → "${bestMatch.name}" (similarity: ${bestSimilarity.toFixed(3)}, threshold: 0.75)`);
      return {
        matched: true,
        matchType: 'fuzzy',
        matchedItem: bestMatch,
        requiresConfirmation: false,
      };
    } else if (bestSimilarity >= 0.65) {
      // Possible match, requires confirmation
      console.log(`[matchTaxonomyItem] ⚠️ Needs confirmation "${aiItemName}" → "${bestMatch.name}" (similarity: ${bestSimilarity.toFixed(3)}, threshold: 0.65)`);
      return {
        matched: true,
        matchType: 'fuzzy',
        matchedItem: bestMatch,
        requiresConfirmation: true,
      };
    } else {
      console.log(`[matchTaxonomyItem] ❌ Below threshold "${aiItemName}" → "${bestMatch.name}" (similarity: ${bestSimilarity.toFixed(3)}, threshold: 0.65)`);
    }
  }
  
  return {
    matched: false,
    matchType: 'none',
    requiresConfirmation: false,
  };
}
