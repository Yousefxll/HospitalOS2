# دليل نظام الصلاحيات - Security Permissions Guide

## المبدأ الأساسي (Core Principle)

**"Fail Secure" - إذا لم يكن لديك صلاحية صريحة، فأنت ممنوع من الوصول**

## القواعد الأساسية (Core Rules)

1. **جميع API Routes يجب أن تتحقق من الصلاحيات**
   - استخدام `requireAuth` للتحقق من المصادقة
   - استخدام `requirePermission` أو `requireRoutePermission` للتحقق من الصلاحيات
   - **ممنوع** استخدام `x-user-id` أو `x-user-role` headers

2. **جميع Frontend Pages يجب أن تتحقق من الصلاحيات**
   - استخدام `hasRoutePermission` للتحقق من الصلاحية
   - إعادة التوجيه إلى `/welcome` إذا لم يكن لديه صلاحية

3. **Sidebar يجب أن يخفي العناصر بدون صلاحية**
   - استخدام `hasRoutePermission` لتصفية العناصر

4. **Middleware يتحقق من المصادقة فقط**
   - الصلاحيات يتم التحقق منها في API routes و Frontend pages

## استخدام نظام الصلاحيات

### في API Routes

```typescript
import { requireAuth } from '@/lib/security/auth';
import { requirePermission, requireRoutePermission } from '@/lib/security/permissions';

// مثال 1: التحقق من صلاحية محددة
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  
  const permissionCheck = await requirePermission(request, 'px.visits.view', auth);
  if (permissionCheck instanceof NextResponse) return permissionCheck;
  
  // ... rest of the code
}

// مثال 2: التحقق من صلاحية المسار
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  
  const permissionCheck = await requireRoutePermission(request, '/patient-experience/visits', auth);
  if (permissionCheck instanceof NextResponse) return permissionCheck;
  
  // ... rest of the code
}

// مثال 3: التحقق من عدة صلاحيات (أي واحدة)
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  
  const permissionCheck = await requirePermission(request, ['px.cases.delete', 'px.cases.edit'], auth);
  if (permissionCheck instanceof NextResponse) return permissionCheck;
  
  // ... rest of the code
}
```

### في Frontend Pages

```typescript
import { hasRoutePermission } from '@/lib/permissions';
import { useMe } from '@/lib/hooks/useMe';
import { useRouter } from 'next/navigation';

export default function MyPage() {
  const router = useRouter();
  const { me, isLoading } = useMe();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  
  useEffect(() => {
    if (isLoading || !me) return;
    
    const permissions = me.user?.permissions || [];
    const hasAccess = hasRoutePermission(permissions, '/my-page');
    setHasPermission(hasAccess);
    
    if (!hasAccess) {
      router.push('/welcome');
      return;
    }
  }, [me, isLoading, router]);
  
  if (!hasPermission) {
    return <div>Loading...</div>;
  }
  
  // ... rest of the component
}
```

### في Sidebar

```typescript
import { hasRoutePermission } from '@/lib/permissions';

// في getFilteredNavItems
const filteredItems = navItems.filter(item => {
  if (!item.href) return true;
  if (userRole === 'syra-owner') return true; // Owner has access to everything
  
  return hasRoutePermission(userPermissions, item.href);
});
```

## الصلاحيات المتاحة (Available Permissions)

جميع الصلاحيات معرّفة في `lib/permissions.ts`:

- **Dashboard**: `dashboard.view`
- **OPD**: `opd.dashboard.view`, `opd.census.view`, `opd.performance.view`, etc.
- **ER**: `er.register.view`, `er.triage.view`, `er.disposition.view`, etc.
- **Patient Experience**: `px.dashboard.view`, `px.analytics.view`, `px.reports.view`, etc.
- **Policies**: `policies.view`, `policies.upload.create`, etc.
- **Admin**: `admin.users.view`, `admin.users.create`, etc.

## خريطة المسارات (Route Permissions Map)

جميع المسارات معرّفة في `ROUTE_PERMISSIONS` في `lib/permissions.ts`:

```typescript
export const ROUTE_PERMISSIONS: Record<string, string> = {
  '/dashboard': 'dashboard.view',
  '/patient-experience/visits': 'px.visits.view',
  '/patient-experience/cases': 'px.cases.view',
  // ... etc
};
```

## إضافة مسار جديد

1. **إضافة الصلاحية في `lib/permissions.ts`**:
```typescript
export const PERMISSIONS: Permission[] = [
  // ... existing permissions
  { key: 'my-module.view', label: 'View My Module', category: 'My Module' },
];
```

2. **إضافة المسار في `ROUTE_PERMISSIONS`**:
```typescript
export const ROUTE_PERMISSIONS: Record<string, string> = {
  // ... existing routes
  '/my-module': 'my-module.view',
};
```

3. **إضافة التحقق في API Route**:
```typescript
const permissionCheck = await requireRoutePermission(request, '/my-module', auth);
```

4. **إضافة التحقق في Frontend Page**:
```typescript
const hasAccess = hasRoutePermission(permissions, '/my-module');
```

## الأخطاء الشائعة (Common Mistakes)

### ❌ خطأ: استخدام headers
```typescript
// DON'T DO THIS
const userId = request.headers.get('x-user-id');
const userRole = request.headers.get('x-user-role');
```

### ✅ صحيح: استخدام requireAuth
```typescript
// DO THIS
const auth = await requireAuth(request);
if (auth instanceof NextResponse) return auth;
const { userId, userRole } = auth;
```

### ❌ خطأ: السماح بالوصول للمسارات غير المعرفة
```typescript
// DON'T DO THIS (old code)
if (!requiredPermission) {
  return true; // Backward compatibility - SECURITY RISK!
}
```

### ✅ صحيح: رفض الوصول (Fail Secure)
```typescript
// DO THIS (current code)
if (!requiredPermission) {
  return false; // Fail secure - deny access
}
```

## التحقق من الصلاحيات

### في API Routes
- ✅ `requireAuth` - للتحقق من المصادقة
- ✅ `requirePermission` - للتحقق من صلاحية محددة
- ✅ `requireRoutePermission` - للتحقق من صلاحية المسار
- ✅ `requireRole` - للتحقق من الدور (Role)

### في Frontend
- ✅ `hasRoutePermission` - للتحقق من صلاحية المسار
- ✅ `hasPermission` - للتحقق من صلاحية محددة (من `lib/security/permissions.ts`)

## ملاحظات مهمة (Important Notes)

1. **Admin users** (مع صلاحية `admin.users`) لديهم وصول لجميع الصلاحيات تلقائياً
2. **syra-owner** لديه وصول لجميع الصلاحيات تلقائياً
3. **إذا لم يكن المسار في `ROUTE_PERMISSIONS`، يتم رفض الوصول** (Fail Secure)
4. **جميع التحققات يجب أن تكون على مستوى Server-side** (API routes)
5. **Frontend checks هي للـ UX فقط** - الحماية الحقيقية في API

## الملفات المهمة

- `lib/permissions.ts` - تعريف الصلاحيات و `ROUTE_PERMISSIONS`
- `lib/security/permissions.ts` - دوال التحقق من الصلاحيات (Server-side)
- `lib/security/auth.ts` - دوال المصادقة والتحقق من الأدوار
- `components/Sidebar.tsx` - تصفية العناصر بناءً على الصلاحيات

