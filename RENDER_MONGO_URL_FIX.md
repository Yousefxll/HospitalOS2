# 🔧 إصلاح MONGO_URL على Render

## المشكلة الحالية:
```
querySrv ENOTFOUND _mongodb._tcp.hospitalos-cluster.hqilxpu.mongodb.net
```

## السبب:
`MONGO_URL` الحالي غير مكتمل أو يحتوي على أخطاء.

## الحل:

### في Render Dashboard → Environment Variables:

عدّل `MONGO_URL` إلى هذا الشكل:

```
mongodb+srv://Hospitalos_admin:B2FHgUsqayqWIBHA@hospitalos-cluster.hqilxpu.mongodb.net/?retryWrites=true&w=majority&appName=HospitalOS-Cluster
```

**أو إذا كنت تريد تحديد اسم قاعدة البيانات في الـ URL:**

```
mongodb+srv://Hospitalos_admin:B2FHgUsqayqWIBHA@hospitalos-cluster.hqilxpu.mongodb.net/hospital_ops?retryWrites=true&w=majority&appName=HospitalOS-Cluster
```

### الاختلافات المهمة:

**قبل (❌ خاطئ):**
```
mongodb+srv://...@hospitalos-cluster.hqilxpu.mongodb.net/?appName=HospitalOS-Cluster
```
- ❌ ينقص `retryWrites=true&w=majority`
- ❌ قد يسبب مشاكل في الاتصال

**بعد (✅ صحيح):**
```
mongodb+srv://...@hospitalos-cluster.hqilxpu.mongodb.net/?retryWrites=true&w=majority&appName=HospitalOS-Cluster
```
- ✅ يحتوي على معاملات MongoDB الأساسية
- ✅ يضمن اتصال مستقر

## خطوات التطبيق:

1. **في Render Dashboard:**
   - اذهب إلى **Environment** → **Edit**
   - عدّل `MONGO_URL` بالشكل الصحيح أعلاه
   - اضغط **Save Changes**

2. **بعد الحفظ:**
   - Render سيعيد تشغيل الخدمة تلقائياً
   - انتظر 1-2 دقيقة

3. **تحقق من Logs:**
   - اذهب إلى **Logs**
   - ابحث عن: `MongoDB connected successfully`
   - إذا ظهر هذا، يعني الاتصال نجح ✅

4. **جرّب تسجيل الدخول:**
   - اذهب إلى `https://hmgdashboard.com/login`
   - Email: `admin@hospital.com`
   - Password: `admin123`

## إذا استمر الخطأ ENOTFOUND:

### 1. تحقق من MongoDB Atlas:
- اذهب إلى MongoDB Atlas → **Database** → **Connect**
- اختر **"Connect your application"**
- انسخ الـ Connection String الكامل
- تأكد من أن اسم الـ cluster صحيح

### 2. تحقق من Network Access:
- MongoDB Atlas → **Network Access**
- تأكد من وجود `0.0.0.0/0` (للسماح بجميع IPs)
- أو أضف IP الخاص بـ Render

### 3. تحقق من Database User:
- MongoDB Atlas → **Database Access**
- تأكد من أن المستخدم `Hospitalos_admin` موجود
- تأكد من أن كلمة المرور صحيحة

### 4. إذا كان اسم Cluster مختلف:
إذا كان اسم الـ cluster في MongoDB Atlas مختلف عن `hospitalos-cluster.hqilxpu.mongodb.net`:
- انسخ الـ Connection String مباشرة من MongoDB Atlas
- استخدمه في `MONGO_URL`

---

**ملاحظة مهمة**: تأكد من عدم وجود مسافات في البداية أو النهاية في `MONGO_URL`

