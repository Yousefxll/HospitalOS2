# 🔧 حل مشكلة 500 Internal Server Error في Login

## المشكلة
عند محاولة تسجيل الدخول، يظهر خطأ 500 Internal Server Error بسبب فشل الاتصال بـ MongoDB.

## الحل الكامل

### الخطوة 1: تحديث `.env.local`

افتح ملف `.env.local` وحدّث `MONGO_URL` إلى:

```env
MONGO_URL=mongodb+srv://Hospitalos_admin:RNfadl99@hospitalos-cluster.hqi1xpu.mongodb.net/?retryWrites=true&w=majority&authSource=admin
DB_NAME=hospital_ops
```

**⚠️ مهم جداً:**
- لا تضع اسم الـ database في الـ URL (قبل `?`) - يتم تحديده عبر `DB_NAME`
- تأكد من إضافة `&authSource=admin` إذا كان المستخدم في `admin` database
- استخدم `?retryWrites=true&w=majority&authSource=admin` بدلاً من `?appName=...`

### الخطوة 2: التحقق من MongoDB Atlas

#### أ) Network Access (IP Whitelist)

1. افتح [MongoDB Atlas Dashboard](https://cloud.mongodb.com/)
2. اذهب إلى **Security** → **Network Access**
3. اضغط **ADD IP ADDRESS**
4. اختر أحد الخيارات:
   - **Add Current IP Address** (أضف IP الحالي)
   - أو **ALLOW ACCESS FROM ANYWHERE** (`0.0.0.0/0`) للتطوير فقط ⚠️

#### ب) Database User

1. اذهب إلى **Security** → **Database Access**
2. تأكد من أن المستخدم `Hospitalos_admin` موجود
3. تأكد من أن لديه صلاحيات **Read and write to any database**

### الخطوة 3: إعادة تشغيل Next.js Server

**مهم جداً:** بعد تغيير `.env.local`، يجب إعادة تشغيل الـ server:

```bash
# 1. أوقف الـ server الحالي
# اضغط Ctrl+C في terminal الذي يعمل فيه npm run dev

# 2. أعد التشغيل
npm run dev
```

### الخطوة 4: فحص الـ Logs

بعد إعادة التشغيل، تحقق من الـ console. يجب أن ترى:

✅ **نجح الاتصال:**
```
MongoDB connected successfully to hospital_ops
```

❌ **فشل الاتصال:**
```
❌ MongoDB connection error: [تفاصيل الخطأ]
Connection details: {
  url: 'mongodb+srv://***:***@...',
  dbName: 'hospital_ops',
  error: '[رسالة الخطأ]'
}
```

### الخطوة 5: اختبار Login

1. افتح `http://localhost:3000/login`
2. أدخل البيانات:
   - Email: `admin@hospital.com`
   - Password: (كلمة المرور الخاصة بك)
3. اضغط **Sign In**

## الأخطاء الشائعة وحلولها

### ❌ Error: "authentication failed"
**السبب:** اسم المستخدم أو كلمة المرور غير صحيحة  
**الحل:** تحقق من MongoDB Atlas → Database Access → المستخدم

### ❌ Error: "getaddrinfo ENOTFOUND"
**السبب:** Cluster URL غير صحيح  
**الحل:** تحقق من Connection String في MongoDB Atlas → Connect

### ❌ Error: "connection timeout"
**السبب:** IP address غير مسموح به  
**الحل:** أضف IP address في Network Access

### ❌ Error: "Server selection timed out"
**السبب:** MongoDB Atlas غير قابل للوصول من شبكتك  
**الحل:** تحقق من Network Access وإعدادات Firewall

## التحسينات المطبقة في الكود

✅ معالجة أخطاء محسّنة في `lib/db.ts`  
✅ Connection timeout (10 ثواني)  
✅ رسائل خطأ واضحة  
✅ Retry logic في login route  
✅ Logging مفصل للأخطاء

## ملاحظات

- إذا استمرت المشكلة، تحقق من الـ logs في terminal حيث يعمل `npm run dev`
- الرسائل الجديدة ستوضح بالضبط سبب فشل الاتصال
- تأكد من إعادة تشغيل الـ server بعد أي تغيير في `.env.local`
