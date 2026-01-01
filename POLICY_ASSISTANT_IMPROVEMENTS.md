# ✅ Policy Assistant Improvements - Related Policies Fix

## Changes Made:

### 1. ✅ UI Controls Added:
- **Checkbox**: "Include supporting policies (communication/admin)" - default: unchecked
- **Dropdown**: "Relevance strictness" - options: Strict (default) / Balanced
  - Strict: minScore = 0.78
  - Balanced: minScore = 0.70

### 2. ✅ Primary vs Supporting Logic:
- Compute max score per policy from sources
- Sort policies by max score (descending)
- Primary policy = top 1 policy by max score
- Supporting policies = the rest (only shown if checkbox is ON)

### 3. ✅ Supporting Policy Filtering:
- **Filename-based categorization**:
  - Keywords: "communication", "collaboration", "interdisciplinary", "handover", "reporting"
  - If filename contains any keyword → category = "supporting"
  - Otherwise → category = "core"

- **Threshold logic**:
  - Always include Primary policy (even if supporting category)
  - If checkbox OFF: show ONLY Primary policy
  - If checkbox ON:
    - Supporting category policies: minScore + 0.06
      - Strict mode: 0.84
      - Balanced mode: 0.76
    - Core policies: regular minScore

### 4. ✅ UI Updates:
- **Primary Policy**: Single card with "PRIMARY" badge (blue background)
- **Supporting Policies**: List (only visible when checkbox ON and list non-empty)
- Each policy card shows:
  - filename
  - policyId
  - Badge: PRIMARY or SUPPORTING
  - Preview / View PDF buttons

### 5. ✅ Sources Section:
- If checkbox OFF: show sources ONLY from Primary policy
- If checkbox ON: show sources from Primary + Supporting (filtered by thresholds)
- Primary sources marked with "PRIMARY" badge

### 6. ✅ API Updates:
- Added `score` field to `PolicyAISource` interface
- Updated `ai-ask` route to include score in sources
- Score conversion: distance → similarity (1.0 - abs(distance))

## Result:
- Asking about IPSG / Identify Patient correctly should NOT include "Interdisciplinary Collaboration…" unless user enables "Include supporting policies"
- Primary policy always appears and matches best score
- No TypeScript errors
- Page compiles successfully
