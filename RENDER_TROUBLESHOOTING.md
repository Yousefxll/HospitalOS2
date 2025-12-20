# 🔧 حل مشاكل Render - دليل استكشاف الأخطاء

## المشكلة: Internal Server Error (500) في صفحة Login

إذا واجهت خطأ 500 عند محاولة تسجيل الدخول، فالمشكلة على الأرجح في أحد الأسباب التالية:

### ✅ الحل 1: التحقق من Environment Variables على Render

1. اذهب إلى Render Dashboard
2. اختر الخدمة (Web Service)
3. اضغط على "Environment" في القائمة الجانبية
4. تأكد من وجود المتغيرات التالية:

```
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
DB_NAME=hospital_ops
JWT_SECRET=your-secret-key-here
NEXT_PUBLIC_BASE_URL=https://your-app-name.onrender.com
```

**⚠️ مهم**: 
- تأكد من أن `MONGO_URL` صحيح ولا يحتوي على مسافات إضافية
- استبدل `username`, `password`, و `cluster` بقيمك الفعلية من MongoDB Atlas

### ✅ الحل 2: التحقق من MongoDB Atlas Network Access

1. اذهب إلى [MongoDB Atlas Dashboard](https://cloud.mongodb.com)
2. اختر مشروعك → Network Access
3. تأكد من أن IP `0.0.0.0/0` موجود (للسماح بجميع IPs)
   - أو أضف IP الخاص بـ Render (يمكنك العثور عليه في Render Logs)

### ✅ الحل 3: التحقق من Render Logs

1. في Render Dashboard، اضغط على "Logs"
2. ابحث عن أخطاء مثل:
   - `MONGO_URL is not defined`
   - `MongoServerError: authentication failed`
   - `ECONNREFUSED`
   - `ENOTFOUND`

### ✅ الحل 4: التحقق من Database User في MongoDB Atlas

1. اذهب إلى MongoDB Atlas → Database Access
2. تأكد من أن المستخدم موجود ولديه الصلاحيات المناسبة
3. تأكد من أن كلمة المرور صحيحة

### ✅ الحل 5: اختبار الاتصال بقاعدة البيانات

يمكنك إنشاء API endpoint للاختبار (اختياري):

```typescript
// app/api/test-db/route.ts
import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = await connectDB();
    await db.admin().ping();
    return NextResponse.json({ success: true, message: 'Database connected' });
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
```

ثم افتح: `https://your-app-name.onrender.com/api/test-db`

---

## المشكلة: البناء (Build) فشل

### الحل:
1. تحقق من Logs في Render Dashboard
2. تأكد من أن `yarn.lock` موجود في المشروع
3. تأكد من أن Node.js version متوافق (22.x)

---

## المشكلة: التطبيق لا يعمل بعد النشر

### الحل:
1. تأكد من أن Start Command صحيح: `yarn start`
2. تأكد من أن Port هو 10000 (Render يستخدم هذا المنفذ تلقائياً)
3. تحقق من Logs للأخطاء

---

## المشكلة: صفحات معينة لا تعمل (404)

### الحل:
- هذا طبيعي إذا كانت الصفحة تحتاج إلى authentication
- تأكد من تسجيل الدخول أولاً

---

## نصائح إضافية

### 🔍 كيف تتحقق من Environment Variables بشكل صحيح:

1. في Render Dashboard → Environment
2. تأكد من أن كل variable موجود بدون أخطاء إملائية
3. بعد إضافة/تعديل variables، اضغط "Save Changes"
4. Render سيعيد تشغيل الخدمة تلقائياً

### 📊 التحقق من MongoDB Connection:

```bash
# في MongoDB Atlas → Database → Connect → Connect your application
# تأكد من أن Connection String يبدأ بـ: mongodb+srv://
```

### 🔐 JWT_SECRET:

يمكنك إنشاء JWT_SECRET قوي باستخدام:

```bash
openssl rand -base64 32
```

---

## إذا استمرت المشكلة

1. تحقق من Render Logs بالكامل
2. تحقق من MongoDB Atlas Logs
3. تأكد من أن جميع Environment Variables صحيحة
4. جرب إعادة تشغيل الخدمة في Render

---

**آخر تحديث**: بعد إضافة `export const dynamic = 'force-dynamic'` إلى login API route

