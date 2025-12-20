# Phase 4C-1 — In-App Notifications for Patient Experience - Complete

## ✅ Implementation Summary

### 1) Data Model

#### ✅ Notification Model (`lib/models/Notification.ts`)
- **Fields**:
  - `id`, `type` (PX_CASE_CREATED, PX_CASE_ASSIGNED, PX_CASE_ESCALATED, PX_CASE_STATUS_CHANGED)
  - `title_en`, `message_en` (English-only)
  - `recipientType` ("user" | "department")
  - `recipientUserId?`, `recipientDeptKey?`
  - `refType` ("PXCase" | "PXVisit")
  - `refId`
  - `readAt?`
  - `meta?` (optional object)
  - `createdAt`

### 2) API Endpoints

#### ✅ GET /api/notifications
- **Query Parameters**:
  - `unread`: '1' | '0' (filter by read status)
  - `recipientType`: 'user' | 'department'
  - `limit`, `skip`: Pagination
- **Features**:
  - Fetches notifications for current user (direct + department-based)
  - Gets user's department from users collection
  - Returns `unreadCount` in response
  - Supports pagination

#### ✅ PATCH /api/notifications/:id
- **Purpose**: Mark single notification as read
- Sets `readAt` to current date

#### ✅ PATCH /api/notifications/mark-all-read
- **Purpose**: Mark all user's notifications as read
- Updates all unread notifications for user (direct + department)

### 3) UI Components

#### ✅ Notifications Page (`/notifications`)
- **Table Display**:
  - Type (with icon and badge)
  - Title (English)
  - Message (English)
  - Date (formatted + relative time)
  - Status (Read/Unread badge)
  - Actions (Mark Read button)
- **Filters**:
  - Toggle "Unread Only" / "Show All"
  - "Mark All Read" button (when unread > 0)
- **Features**:
  - Unread notifications highlighted (bg-muted/50)
  - Real-time unread count display
  - Language toggle support

#### ✅ Sidebar Badge
- **Unread Count Badge**:
  - Shows on "Notifications" menu item
  - Displays count (or "99+" if > 99)
  - Red badge variant
  - Auto-refreshes every 30 seconds
  - Positioned absolutely (top-right)

### 4) Notification Triggers

#### ✅ Case Creation (`app/api/patient-experience/route.ts`)
- **When**: Auto-creating PXCase for unresolved complaint
- **Notification Type**: `PX_CASE_CREATED`
- **Recipient**: Department where complaint occurred (`departmentKey`)
- **Message**: "A new {severity} severity complaint case has been created and requires attention."

#### ✅ Case Updates (`app/api/patient-experience/cases/[id]/route.ts`)
- **Assignment Change**:
  - Type: `PX_CASE_ASSIGNED`
  - Recipient: New assigned department
  - Message: "A complaint case has been assigned to your department."
  
- **Escalation**:
  - Type: `PX_CASE_ESCALATED`
  - Recipient: Assigned department (or original department)
  - Message: "Case has been escalated due to SLA overdue. Immediate attention required."
  - Triggered when: Case is overdue and not resolved
  
- **Status Change**:
  - Type: `PX_CASE_STATUS_CHANGED`
  - Recipient: Assigned department
  - Message: "Case status has been changed to {newStatus}."
  - Only if not escalation or assignment change

## ✅ Acceptance Criteria

### ✅ 1. Creating unresolved complaint creates case AND notification
- When visit is created with complaint type and not resolved → case created
- Notification `PX_CASE_CREATED` sent to department where complaint occurred

### ✅ 2. Assign/status updates generate notifications
- Assignment change → `PX_CASE_ASSIGNED` notification
- Status change → `PX_CASE_STATUS_CHANGED` notification
- Escalation → `PX_CASE_ESCALATED` notification

### ✅ 3. Notifications page lists and can mark read
- Page displays all notifications in table
- Can mark individual notification as read
- Can mark all notifications as read
- Filter by unread/read status

### ✅ 4. Sidebar shows unread count
- Badge displays on "Notifications" menu item
- Shows count of unread notifications
- Auto-refreshes every 30 seconds
- Red badge with count (or "99+")

## 📁 Files Created/Modified

### New Files:
1. `lib/models/Notification.ts` - Notification model
2. `app/api/notifications/route.ts` - GET notifications endpoint
3. `app/api/notifications/[id]/route.ts` - PATCH single notification
4. `app/api/notifications/mark-all-read/route.ts` - PATCH mark all read
5. `app/(dashboard)/notifications/page.tsx` - Notifications page

### Modified Files:
1. `app/api/patient-experience/route.ts` - Added notification trigger on case creation
2. `app/api/patient-experience/cases/[id]/route.ts` - Added notification triggers on case updates
3. `components/Sidebar.tsx` - Added Notifications menu item with unread badge

## 🎯 Status: ✅ COMPLETE

All requirements implemented. Notification system is ready for use.
