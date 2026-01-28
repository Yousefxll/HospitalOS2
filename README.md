# SYRA — Enterprise Policy & Procedure Platform

SYRA is an enterprise-grade policy and procedure management system built with Next.js, TypeScript, and MongoDB.

## Features Implemented

### ✅ Phase 1: Authentication & Core Infrastructure
- **JWT Authentication** with httpOnly cookies
- **Role-Based Access Control (RBAC)**: admin, supervisor, staff, viewer
- **Protected Routes** via middleware
- **MongoDB Integration** with connection pooling
- **Audit Trail** on all data operations (createdBy, updatedBy, timestamps)
- **Tenant Isolation** with session-based tenantId enforcement

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

### ✅ Phase 5: Policy Service
- **Policy Library**
  - PDF upload and indexing
  - Full-text search with line/page references
  - AI-powered Q&A
  - Policy management (view/delete/deactivate)
  - Tenant isolation and audit logging

### ✅ Phase 6: Account Management
- **Account Page**
  - View profile information
  - Change password functionality
  - Display role and department

### 🎨 UI/UX Features
- **Modern Dashboard Layout**
  - Collapsible sidebar navigation
  - Header with user info and logout
  - Responsive design
  - Light/Dark theme toggle
  
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
- **Charts**: Recharts
- **Tables**: TanStack Table
- **File Processing**: ExcelJS for Excel import/export
- **Validation**: Zod

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- Yarn >= 1.22.0
- MongoDB (local or Atlas)

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd "HospitalOS 2"
   ```

2. **Install dependencies**
   ```bash
   yarn install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

4. **Required environment variables**
   ```env
   MONGO_URL=mongodb://localhost:27017
   DB_NAME=hospital_ops
   JWT_SECRET=your-super-secret-jwt-key-here-change-this
   ```

5. **Initialize database**
   ```bash
   curl -X POST http://localhost:3000/api/init
   ```

6. **Staff ID index migration (idempotent)**
   ```bash
   npx -y tsx scripts/migrations/058_users_staffid_unique.ts
   ```

6. **Start development server**
   ```bash
   yarn dev
   ```

7. **Access the application**
   - Open `http://localhost:3000/login`
   - Default credentials:
     - Email: `admin@hospital.com`
     - Password: `admin123`

### Production Deployment

#### Build for Production

```bash
# Install dependencies
yarn install

# Build the application
yarn build

# Start production server
yarn start
```

#### Render.com Deployment

See [DEPLOY_RENDER.md](./DEPLOY_RENDER.md) for detailed Render deployment instructions.

**Quick steps:**
1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Set build command: `yarn build`
4. Set start command: `yarn start`
5. Configure environment variables (see Environment Variables section)
6. Deploy

#### Environment Variables for Production

Required variables:
- `MONGO_URL` - MongoDB connection string
- `JWT_SECRET` - Secret key for JWT tokens (generate with `openssl rand -base64 32`)
- `DB_NAME` - Database name (defaults to `hospital_ops`)

Optional variables:
- `OPENAI_API_KEY` - Required for AI features (policy assistant, translations)
- `POLICY_ENGINE_URL` - Policy engine service URL (defaults to `http://localhost:8001`)
- `POLICY_ENGINE_TENANT_ID` - Policy engine tenant ID (defaults to `default`)
- `NEXT_PUBLIC_BASE_URL` - Public base URL for the application
- `CORS_ORIGINS` - Allowed CORS origins (defaults to `*`)

See `.env.example` for all available options.

## Project Structure

```
/app
├── app/
│   ├── (dashboard)/          # Protected dashboard routes
│   │   ├── dashboard/        # Main dashboard
│   │   ├── opd/             # OPD modules
│   │   ├── equipment/       # Equipment modules
│   │   ├── admin/           # Admin modules
│   │   ├── policies/        # Policy library
│   │   └── account/         # Account settings
│   ├── api/                 # API routes
│   │   ├── auth/           # Authentication endpoints
│   │   ├── admin/          # Admin endpoints
│   │   ├── opd/            # OPD endpoints
│   │   ├── policies/       # Policy endpoints
│   │   └── equipment/      # Equipment endpoints
│   ├── login/              # Login page
│   └── layout.tsx          # Root layout
├── lib/
│   ├── db.ts               # MongoDB connection
│   ├── auth.ts             # Auth utilities
│   ├── rbac.ts             # RBAC utilities
│   ├── security/           # Security modules (auth, sessions, rate limiting)
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
- `GET /api/admin/users` - List all users (tenant-scoped)
- `POST /api/admin/users` - Create user
- `DELETE /api/admin/users?id={id}` - Delete user
- `POST /api/admin/data-import` - Import Excel data
- `GET /api/admin/data-export?collection={name}` - Export data

### Policies
- `GET /api/policies/list` - List policies (tenant-scoped)
- `POST /api/policies/upload` - Upload policy PDF
- `GET /api/policies/view/[documentId]` - View policy PDF
- `DELETE /api/policies/[documentId]` - Delete policy
- `POST /api/policies/search` - Search policies
- `POST /api/policies/ai-ask` - AI-powered policy Q&A

### OPD
- `GET /api/opd/census?date={date}` - Get census data by date

### Equipment
- `GET /api/equipment` - List all equipment
- `POST /api/equipment` - Add new equipment

## Development Scripts

```bash
# Development
yarn dev              # Start development server

# Production
yarn build            # Build for production
yarn start            # Start production server

# Code Quality
yarn lint             # Run ESLint
yarn typecheck        # Run TypeScript type checking

# Testing
yarn test             # Run tests (placeholder)
```

## Security Features

- **JWT Authentication** with secure httpOnly cookies
- **Password Hashing** using bcrypt
- **RBAC** enforced at middleware and API level
- **Tenant Isolation** - all data filtered by session tenantId
- **Input Validation** using Zod schemas
- **Audit Trail** on all data modifications
- **Rate Limiting** on API endpoints
- **CSRF Protection** (when enabled)
- **Security Headers** (HSTS, CSP, etc.)

See [SECURITY.md](./SECURITY.md) for detailed security documentation.

## Support

For questions or issues, refer to:
- [SECURITY.md](./SECURITY.md) - Security documentation
- [DEPLOY_RENDER.md](./DEPLOY_RENDER.md) - Render deployment guide
- System logs or API error messages

---

**Version**: 0.1.0  
**Last Updated**: January 2025
