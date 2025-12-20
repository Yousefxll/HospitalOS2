# Phase 5-1 — Patient Experience Analytics APIs - Complete

## ✅ Implementation Summary

### 1) GET /api/patient-experience/analytics/summary

**Location**: `app/api/patient-experience/analytics/summary/route.ts`

**Query Parameters**:
- `from`: ISO date string (optional)
- `to`: ISO date string (optional)
- `departmentKey`: string (optional)
- `floorKey`: string (optional)
- `severity`: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' (optional)

**Returns**:
- `totalVisits`: Total number of visits matching filters
- `totalComplaints`: Number of complaint visits
- `totalPraise`: Number of praise visits
- `avgSatisfaction`: Average satisfaction percentage (praises / total visits * 100)
- `totalCases`: Total number of cases linked to filtered visits
- `openCases`: Cases with status OPEN or IN_PROGRESS
- `overdueCases`: Cases that are not resolved/closed and past dueAt
- `avgResolutionMinutes`: Average resolution time in minutes (for resolved cases only)
- `slaBreachPercent`: Percentage of cases that breached SLA (resolved after dueAt OR escalated)

**Features**:
- Filters visits by date range, location, and severity
- Links cases to filtered visits
- Calculates comprehensive KPIs
- Uses English labels internally (keys resolved server-side)

### 2) GET /api/patient-experience/analytics/breakdown

**Location**: `app/api/patient-experience/analytics/breakdown/route.ts`

**Query Parameters**:
- `from`: ISO date string (optional)
- `to`: ISO date string (optional)
- `groupBy`: 'department' | 'room' | 'domain' | 'type' | 'severity' (required)

**Returns**:
- Array of objects with:
  - `key`: The canonical key
  - `label_en`: English label (resolved from setup collections)
  - `count`: Number of visits in this group
  - `percentage`: Percentage of total visits
- `total`: Total number of visits

**Features**:
- Groups visits by specified dimension
- Resolves keys to English labels (`label_en`) from setup collections:
  - Departments: `floor_departments` collection
  - Rooms: `floor_rooms` collection
  - Domains: `complaint_domains` collection
  - Types: `complaint_types` collection
  - Severity: Uses enum value directly (LOW, MEDIUM, HIGH, CRITICAL)
- Sorts results by count (descending)
- Calculates percentages

### 3) GET /api/patient-experience/analytics/trends

**Location**: `app/api/patient-experience/analytics/trends/route.ts`

**Query Parameters**:
- `from`: ISO date string (optional, defaults to 30 days ago)
- `to`: ISO date string (optional, defaults to today)
- `bucket`: 'day' | 'week' (default: 'day')

**Returns**:
- Array of time series objects:
  - `date`: ISO date string (YYYY-MM-DD)
  - `complaints`: Number of complaints in this bucket
  - `praise`: Number of praises in this bucket
  - `cases`: Number of cases created in this bucket
  - `overdue`: Number of overdue cases in this bucket
- `bucket`: The bucket type used
- `from`: Start date (ISO string)
- `to`: End date (ISO string)

**Features**:
- Time series aggregation by day or week
- Fills in missing dates in the range (zero values)
- Groups visits and cases by date bucket
- Calculates overdue cases per bucket
- Default date range: last 30 days if not specified
- Week buckets start on Monday

## ✅ Rules Compliance

### ✅ English Labels
- All endpoints use `label_en` from setup collections
- Keys are resolved server-side using lookup maps
- No Arabic strings in structured responses

### ✅ Key-Based Storage
- Uses canonical keys internally (`floorKey`, `departmentKey`, `roomKey`, `domainKey`, `typeKey`)
- Joins labels from setup collections server-side
- Maintains consistency with existing Phase 2-4C architecture

## 📁 Files Created

1. `app/api/patient-experience/analytics/summary/route.ts` - Summary analytics endpoint
2. `app/api/patient-experience/analytics/breakdown/route.ts` - Breakdown analytics endpoint
3. `app/api/patient-experience/analytics/trends/route.ts` - Trends analytics endpoint

## 🎯 Acceptance Criteria

### ✅ Summary Endpoint
- Returns all required KPIs: totalVisits, totalComplaints, totalPraise, avgSatisfaction, totalCases, openCases, overdueCases, avgResolutionMinutes, slaBreachPercent
- Supports filtering by date range, departmentKey, floorKey, severity
- Calculates metrics correctly

### ✅ Breakdown Endpoint
- Supports grouping by department, room, domain, type, severity
- Returns counts and percentages
- Uses English labels (`label_en`) in responses
- Validates `groupBy` parameter

### ✅ Trends Endpoint
- Returns time series data for complaints, praise, cases, overdue
- Supports day and week buckets
- Fills missing dates with zero values
- Defaults to last 30 days if date range not provided

## 🔍 Technical Details

### Summary Calculations
- **avgSatisfaction**: `(praises / totalVisits) * 100`
- **avgResolutionMinutes**: Average of `(resolvedAt - createdAt)` in minutes for resolved cases
- **slaBreachPercent**: `(breachedCases / totalCases) * 100` where breached = escalated OR resolved after dueAt

### Breakdown Resolution
- Fetches labels from setup collections in parallel
- Creates lookup maps for efficient resolution
- Handles missing keys gracefully (falls back to key itself)

### Trends Bucketing
- **Day bucket**: Groups by date (YYYY-MM-DD)
- **Week bucket**: Groups by week start (Monday)
- Fills gaps in date range to ensure continuous time series

## 🎯 Status: ✅ COMPLETE

All three analytics endpoints implemented with proper validation, error handling, and English label resolution.

