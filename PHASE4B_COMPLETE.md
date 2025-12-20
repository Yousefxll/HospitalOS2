# Phase 4B — Patient Experience Cases & Follow-up - Complete

## ✅ Implementation Summary

### 1) Data Model

#### ✅ PXCase Model (`lib/models/PXCase.ts`)
- **Fields**:
  - `visitId`: Reference to PatientExperience.id
  - `status`: 'OPEN' | 'IN_PROGRESS' | 'ESCALATED' | 'RESOLVED' | 'CLOSED'
  - `severity`: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  - `assignedDeptKey`, `assignedRole`, `assignedUserId`
  - `slaMinutes`, `dueAt` (calculated: createdAt + slaMinutes)
  - `firstResponseAt`, `resolvedAt`
  - `resolutionNotesOriginal`, `resolutionNotesLang`, `resolutionNotesEn`
  - `escalationLevel`

### 2) Auto-Case Creation Logic

#### ✅ Updated Visit Creation (`app/api/patient-experience/route.ts`)
- **When creating a Visit**:
  - Checks if `typeKey` contains "PRAISE" (if not, it's a complaint)
  - Checks if `status` is RESOLVED/CLOSED or `resolvedNow=true`
  - If complaint and not resolved → **auto-creates PXCase**
  - **SLA calculation**: Fetches `SLARule` by severity from `sla_rules` collection
  - Default SLA: 1440 minutes (24 hours) if no rule found
  - Calculates `dueAt = createdAt + slaMinutes`

### 3) API Endpoints

#### ✅ GET /api/patient-experience/cases
- **Query Parameters**:
  - `status`: Filter by status
  - `severity`: Filter by severity
  - `overdue`: 'true' | 'false' (filter by overdue)
  - `assignedDeptKey`: Filter by assigned department
  - `limit`, `skip`: Pagination
- **Features**:
  - Resolves visit details and department labels to English
  - Calculates `isOverdue` flag
  - Returns pagination info

#### ✅ PATCH /api/patient-experience/cases/:id
- **Body Parameters**:
  - `status`: Update case status
  - `assignedDeptKey`, `assignedRole`, `assignedUserId`: Assignment
  - `resolutionNotesOriginal`, `resolutionNotesLang`: Resolution notes
- **Features**:
  - Auto-sets `firstResponseAt` when status changes to IN_PROGRESS
  - Auto-sets `resolvedAt` when status changes to RESOLVED/CLOSED
  - **Auto-escalation**: If overdue and not resolved → sets status to ESCALATED
  - Translates resolution notes to English if Arabic

### 4) Cases Management Page

#### ✅ `/patient-experience/cases`
- **Table Columns**:
  - Date, Patient, Complaint (detailsEn), Severity, Status, SLA, Assigned, Actions
- **Filters**:
  - Status (OPEN, IN_PROGRESS, ESCALATED, RESOLVED, CLOSED)
  - Severity (LOW, MEDIUM, HIGH, CRITICAL)
  - Overdue (Yes/No)
  - Assigned Department
- **Actions**:
  - Edit button opens dialog
  - Update status, assignment, resolution notes
- **Display**:
  - Shows overdue indicator (red clock icon)
  - Shows SLA countdown/overdue time
  - Uses English labels for all structured fields
  - Displays `detailsEn` for complaint text

### 5) SLA & Escalation Logic

#### ✅ SLA Calculation
- Fetches `SLARule` from `sla_rules` collection by severity
- Default: 1440 minutes (24 hours) if no rule found
- `dueAt = createdAt + slaMinutes`

#### ✅ Overdue Detection
- Checks: `now > dueAt` AND status not RESOLVED/CLOSED
- Marked as `isOverdue` in API response

#### ✅ Auto-Escalation
- In PATCH endpoint: If overdue and not resolved → auto-escalate
- Sets status to `ESCALATED`
- Increments `escalationLevel`

## ✅ Acceptance Criteria

### ✅ 1. Unresolved complaints become cases
- When creating a visit with complaint type and status != RESOLVED/CLOSED → case auto-created
- Case linked to visit via `visitId`

### ✅ 2. SLA dueAt calculated correctly
- Fetches SLA minutes from `sla_rules` by severity
- Calculates `dueAt = createdAt + slaMinutes`
- Default fallback: 1440 minutes

### ✅ 3. Overdue cases detected
- API calculates `isOverdue` flag
- UI shows overdue indicator (red clock icon)
- Auto-escalation when updating overdue cases

### ✅ 4. Management page works
- Table displays all cases with filters
- Edit dialog allows updating status, assignment, resolution notes
- All structured fields use English labels (`label_en`)
- Complaint text displays from `detailsEn`

### ✅ 5. Dashboard not broken
- No changes to existing dashboard/visits pages
- Cases are separate entity, doesn't affect existing flows

## 📁 Files Created/Modified

### New Files:
1. `lib/models/PXCase.ts` - Case model
2. `app/api/patient-experience/cases/route.ts` - GET cases endpoint
3. `app/api/patient-experience/cases/[id]/route.ts` - PATCH case endpoint
4. `app/(dashboard)/patient-experience/cases/page.tsx` - Cases management page

### Modified Files:
1. `app/api/patient-experience/route.ts` - Added auto-case creation logic
2. `components/Sidebar.tsx` - Added Cases link to navigation

## 🎯 Status: ✅ COMPLETE

All requirements implemented. Cases management is ready for use.
