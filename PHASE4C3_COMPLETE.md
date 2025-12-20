# Phase 4C-3 — SLA Runner Endpoint - Complete

## ✅ Implementation Summary

### 1) API Endpoint

#### ✅ POST /api/patient-experience/cases/run-sla
- **Purpose**: Run SLA check and automatically escalate overdue cases
- **Security**: Restricted to `admin` or `supervisor` role only
- **Behavior**:
  1. Finds all `PXCase` where:
     - `status` in (`OPEN`, `IN_PROGRESS`)
     - `dueAt < now` (overdue)
  2. For each overdue case:
     - Skips if already `ESCALATED`
     - Skips if `escalationLevel >= 3` (max escalation)
     - Sets `status = ESCALATED`
     - Increments `escalationLevel` by 1
     - Updates `updatedAt` and `updatedBy`
  3. Creates audit record:
     - Action: `ESCALATED`
     - Before: old status and escalation level
     - After: new status (`ESCALATED`) and new escalation level
  4. Creates notification:
     - Type: `PX_CASE_ESCALATED`
     - Recipient: assigned department (if available)
     - Message includes escalation level

### 2) Response Format

```json
{
  "success": true,
  "processed": 5,
  "escalated": 3,
  "skipped": 2,
  "errors": ["Case xxx: error message"],
  "message": "Processed 5 overdue cases, escalated 3"
}
```

### 3) Security

- **Role Check**: Uses `requireRole(userRole, ['admin', 'supervisor'])`
- **401 Unauthorized**: If no userId
- **403 Forbidden**: If user is not admin or supervisor

### 4) Error Handling

- Individual case errors are caught and logged
- Errors array returned in response (if any)
- Process continues even if one case fails

## ✅ Acceptance Criteria

### ✅ 1. Running the endpoint escalates overdue cases
- Finds cases with `status in (OPEN, IN_PROGRESS)` and `dueAt < now`
- Sets `status = ESCALATED` (if not already)
- Increments `escalationLevel` by 1 (capped at 3)

### ✅ 2. Generates audit record
- Creates `PXCaseAudit` with action `ESCALATED`
- Records before/after state (status, escalationLevel)

### ✅ 3. Generates notification
- Creates `PX_CASE_ESCALATED` notification
- Sent to assigned department (if available)
- Includes escalation level in message

### ✅ 4. Security enforced
- Only admin/supervisor can run the endpoint
- Returns 403 Forbidden for unauthorized users

## 📁 Files Created/Modified

### New Files:
1. `app/api/patient-experience/cases/run-sla/route.ts` - SLA runner endpoint

### Modified Files:
- None (reuses existing models and utilities)

## 🎯 Status: ✅ COMPLETE

All requirements implemented. SLA runner is ready for use.

## 📝 Usage

This endpoint can be called:
- Manually by admin/supervisor
- Via scheduled job/cron (to be configured separately)
- Example: `POST /api/patient-experience/cases/run-sla`

