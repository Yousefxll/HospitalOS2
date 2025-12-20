# MedFlow - Hospital Operations Platform

A comprehensive hospital operations management system built with Next.js, TypeScript, and MongoDB.

## Features Implemented

### ✅ Phase 1: Authentication & Core Infrastructure
- **JWT Authentication** with httpOnly cookies
- **Role-Based Access Control (RBAC)**: admin, supervisor, staff, viewer
- **Protected Routes** via middleware
- **MongoDB Integration** with connection pooling
- **Audit Trail** on all data operations (createdBy, updatedBy, timestamps)

### ✅ Phase 2: Admin Modules
- **User Management**
  - Create, view, and delete users
  - Assign roles and departments
  - View user status

- **Data Admin**
  - **Excel Import**: Upload and import data to any collection
  - **Excel Export**: Download data from collections
  - Preview functionality before import
  - Support for multiple collection types (OPD Census, Departments, Clinics, Equipment, etc.)

### ✅ Phase 3: OPD Modules
- **OPD Dashboard**
  - High-level KPIs (visits, utilization, active clinics)
  - Quick navigation to other OPD modules

- **Clinic Daily Census**
  - View patient counts per clinic by date
  - Filter by date
  - Summary statistics (total patients, active clinics, avg utilization)
  - Export to Excel functionality
  - Utilization rate visualization with color coding

### ✅ Phase 4: Equipment Module
- **Equipment Master**
  - Central registry of all equipment
  - Add new equipment with detailed information
  - Track manufacturer, model, serial number
  - Status management (active, maintenance, retired)
  - Search functionality
  - Location and department tracking

### ✅ Phase 5: Account Management
- **Account Page**
  - View profile information
  - Change password functionality
  - Display role and department

### 🎨 UI/UX Features
- **Modern Dashboard Layout**
  - Collapsible sidebar navigation
  - Header with user info and logout
  - Responsive design
  
- **Component Library**
  - Built with shadcn/ui components
  - TailwindCSS styling
  - Lucide icons
  - Toast notifications

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, React 18
- **Backend**: Next.js API Routes
- **Database**: MongoDB
- **Authentication**: JWT + httpOnly cookies
- **UI**: shadcn/ui, TailwindCSS, Radix UI
- **Charts**: Recharts (ready to use)
- **Tables**: TanStack Table (ready to use)
- **File Processing**: ExcelJS for Excel import/export
- **Validation**: Zod

## Getting Started

### 1. Initialize Database

First, create the default admin user and sample departments:

```bash
curl -X POST http://localhost:3000/api/init
```

**Default Credentials:**
- Email: `admin@hospital.com`
- Password: `admin123`

### 2. Login

Visit `http://localhost:3000/login` and use the default credentials.

### 3. Import Sample Data

1. Go to **Admin → Data Admin**
2. Select target collection (e.g., "OPD Census")
3. Upload an Excel file with appropriate columns
4. Preview and import

## Project Structure

```
/app
├── app/
│   ├── (dashboard)/          # Protected dashboard routes
│   │   ├── dashboard/        # Main dashboard
│   │   ├── opd/             # OPD modules
│   │   ├── equipment/       # Equipment modules
│   │   ├── admin/           # Admin modules
│   │   └── account/         # Account settings
│   ├── api/                 # API routes
│   │   ├── auth/           # Authentication endpoints
│   │   ├── admin/          # Admin endpoints
│   │   ├── opd/            # OPD endpoints
│   │   └── equipment/      # Equipment endpoints
│   ├── login/              # Login page
│   └── layout.tsx          # Root layout
├── lib/
│   ├── db.ts               # MongoDB connection
│   ├── auth.ts             # Auth utilities
│   ├── rbac.ts             # RBAC utilities
│   └── models/             # MongoDB models
├── components/
│   ├── ui/                 # UI components (shadcn)
│   ├── Sidebar.tsx         # Navigation sidebar
│   └── Header.tsx          # Top header
└── middleware.ts           # Route protection

```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Admin
- `GET /api/admin/users` - List all users
- `POST /api/admin/users` - Create user
- `DELETE /api/admin/users?id={id}` - Delete user
- `POST /api/admin/data-import` - Import Excel data
- `GET /api/admin/data-export?collection={name}` - Export data

### OPD
- `GET /api/opd/census?date={date}` - Get census data by date

### Equipment
- `GET /api/equipment` - List all equipment
- `POST /api/equipment` - Add new equipment

## Data Models

### User
- id, email, password (hashed)
- firstName, lastName, role
- department, isActive
- Audit fields (createdAt, updatedAt, createdBy, updatedBy)

### OPD Census
- id, date, clinicId, departmentId
- patientCount, newPatients, followUpPatients
- utilizationRate, notes
- Audit fields

### Equipment
- id, name, code, type
- manufacturer, model, serialNumber
- status, location, department
- Audit fields

## Environment Variables

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=hospital_ops
OPENAI_API_KEY=sk-emergent-...
JWT_SECRET=hospital-ops-secret-key-2025-super-secure-key
NEXT_PUBLIC_BASE_URL=https://...
```

## Modules to be Completed

### OPD (Remaining)
- [ ] Department View
- [ ] Department Days
- [ ] Rooms View
- [ ] Doctors View
- [ ] Clinic Utilization

### Scheduling
- [ ] Scheduling page
- [ ] Availability management

### IPD
- [ ] Bed Setup
- [ ] Live Beds
- [ ] Inpatient Dept Input

### Equipment (Remaining)
- [ ] Clinic Equipment Map
- [ ] Equipment Checklist
- [ ] Equipment Movements
- [ ] IPD Equipment Map
- [ ] IPD Daily Checklist

### Manpower & Nursing
- [ ] Manpower analysis
- [ ] Nursing Operations

### AI Policy Modules
- [ ] Policy Assistant (semantic search with citations)
- [ ] New Policy Generation
- [ ] Policy Harmonization

## AI Integration (Ready)

The platform is configured to use **Emergent LLM key** for AI features:
- Text generation
- Embeddings for semantic search
- Policy analysis and generation

OpenAI client is configured and ready for AI policy modules.

## Security Features

- **JWT Authentication** with secure httpOnly cookies
- **Password Hashing** using bcrypt
- **RBAC** enforced at middleware and API level
- **Input Validation** using Zod schemas
- **Audit Trail** on all data modifications

## Development Notes

- Hot reload enabled for fast development
- TypeScript strict mode
- MongoDB connection pooling
- Responsive design for mobile/tablet
- Export functionality for data analysis

## Next Steps

1. **Test the current modules** with real data
2. **Provide feedback** on UX and features
3. **Complete remaining OPD modules** (Department View, Rooms, Doctors, etc.)
4. **Implement IPD modules** (Beds, Occupancy)
5. **Build Equipment tracking** (Mapping, Checklist, Movements)
6. **Add AI Policy features** (Assistant, Generation, Harmonization)
7. **Add Charts and Analytics** using Recharts
8. **Implement PDF Export** for reports

## Support

For questions or issues, refer to the system logs or API error messages.

---

**Version**: 0.1.0 (MVP Phase)
**Last Updated**: December 2025
# HospitalOS
# HospitalOS
