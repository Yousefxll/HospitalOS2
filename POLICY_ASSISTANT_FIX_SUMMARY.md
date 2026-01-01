# ✅ Policy Assistant - Related Policies Fix Complete

## Summary of Changes:

### 1. ✅ UI Controls Added:
- **Checkbox**: "Include supporting policies (communication/admin)" - default: **unchecked**
- **Dropdown**: "Relevance strictness" - options: **Strict** (default, minScore=0.78) / **Balanced** (minScore=0.70)

### 2. ✅ Primary vs Supporting Logic:
- Computes max score per policy from sources
- Sorts policies by max score (descending)
- **Primary policy** = top 1 policy by max score
- **Supporting policies** = the rest (only shown if checkbox is ON)

### 3. ✅ Supporting Policy Filtering:
- **Filename-based categorization**:
  - Keywords: "communication", "collaboration", "interdisciplinary", "handover", "reporting"
  - If filename contains any keyword → category = "supporting"
  - Otherwise → category = "core"

- **Threshold logic**:
  - Always include Primary policy (even if supporting category)
  - If checkbox **OFF**: show ONLY Primary policy
  - If checkbox **ON**:
    - Supporting category policies: minScore + 0.06 (Strict: 0.84, Balanced: 0.76)
    - Core policies: regular minScore (Strict: 0.78, Balanced: 0.70)

### 4. ✅ UI Updates:
- **Primary Policy**: Single card with "PRIMARY" badge (blue background)
- **Supporting Policies**: List (only visible when checkbox ON and list non-empty)
- Each policy card shows: filename, policyId, PRIMARY/SUPPORTING badge, Preview/View PDF buttons

### 5. ✅ Sources Section:
- If checkbox **OFF**: show sources ONLY from Primary policy
- If checkbox **ON**: show sources from Primary + Supporting (filtered by thresholds)
- Primary sources marked with "PRIMARY" badge

### 6. ✅ API Updates:
- Added `score?: number` field to `PolicyAISource` interface
- Updated `ai-ask` route to include score in sources (converted from policy-engine format)
- Score is used for filtering and sorting

## Result:
✅ Asking about IPSG / Identify Patient correctly should NOT include "Interdisciplinary Collaboration…" unless user enables "Include supporting policies"

✅ Primary policy always appears and matches best score

✅ No TypeScript errors

✅ Page compiles successfully

## Testing:
1. Ask a question about IPSG / Identify Patient correctly
2. Verify: Only Primary policy appears (no "Interdisciplinary Collaboration")
3. Enable "Include supporting policies" checkbox
4. Verify: Supporting policies appear (if they meet the higher threshold)
5. Change "Relevance strictness" to "Balanced"
6. Verify: More policies may appear (lower threshold)
