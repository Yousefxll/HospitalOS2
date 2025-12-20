# Phase 4C-2 — Audit Trail for PX Cases - Complete

## ✅ Implementation Summary

### 1) Data Model

#### ✅ PXCaseAudit Model (`lib/models/PXCaseAudit.ts`)
- **Fields**:
  - `id`, `caseId` (reference to PXCase.id)
  - `actorUserId?`, `actorEmployeeId?` (who made the change)
  - `action`: ASSIGNMENT_CHANGED, STATUS_CHANGED, NOTES_UPDATED, ESCALATED, RESOLVED
  - `before`: Object snapshot subset (fields that changed)
  - `after`: Object snapshot subset (fields after change)
  - `createdAt`

### 2) API Updates

#### ✅ PATCH /api/patient-experience/cases/:id
- **Before applying updates**:
  - Captures relevant fields in `beforeState` object
  - Applies patch to case
  - Captures changed fields in `afterState` object
  - Creates `PXCaseAudit` records for each change type:
    - **ASSIGNMENT_CHANGED**: When assignedDeptKey/assignedRole/assignedUserId changes
    - **STATUS_CHANGED**: When status changes (except RESOLVED/ESCALATED)
    - **RESOLVED**: When status changes to RESOLVED or CLOSED
    - **ESCALATED**: When case is auto-escalated due to overdue
    - **NOTES_UPDATED**: When resolutionNotesEn changes

#### ✅ GET /api/patient-experience/cases/:id/audit
- **Purpose**: Get audit trail for a specific case
- **Returns**: Chronological list of audit records
- **Features**:
  - Resolves actor names from users collection
  - Sorted by `createdAt` (oldest first)
  - Enriched with actor info (name, email)

### 3) UI Updates

#### ✅ Cases Page Dialog (`app/(dashboard)/patient-experience/cases/page.tsx`)
- **History Section**:
  - Added "Change History" section in update dialog
  - Displays audit entries chronologically
  - Shows:
    - Actor name (with User icon)
    - Action type (badge)
    - Timestamp (formatted)
    - Before/After values for changed fields
  - Scrollable area (max-height: 264px)
  - Auto-loads when dialog opens
  - Auto-refreshes after case update

## ✅ Acceptance Criteria

### ✅ 1. Every patch action creates an audit row
- Status change → `STATUS_CHANGED` or `RESOLVED` audit
- Assignment change → `ASSIGNMENT_CHANGED` audit
- Notes update → `NOTES_UPDATED` audit
- Escalation → `ESCALATED` audit
- Multiple changes create multiple audit records

### ✅ 2. History renders correctly per case
- History section loads when dialog opens
- Shows all audit entries chronologically
- Displays actor, action, before/after values
- Refreshes after case update

## 📁 Files Created/Modified

### New Files:
1. `lib/models/PXCaseAudit.ts` - Audit model
2. `app/api/patient-experience/cases/[id]/audit/route.ts` - GET audit endpoint

### Modified Files:
1. `app/api/patient-experience/cases/[id]/route.ts` - Added audit trail creation
2. `app/(dashboard)/patient-experience/cases/page.tsx` - Added History section to dialog

## 🎯 Status: ✅ COMPLETE

All requirements implemented. Audit trail is ready for use.

