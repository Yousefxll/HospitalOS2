# 🔧 حل مشكلة MONGO_URL على Render

## المشكلة
```
Error: MONGO_URL is not defined in environment variables
```

## الحل المطبق

تم تعديل `lib/db.ts` لقراءة `MONGO_URL` في runtime بدلاً من module load time.

### قبل التعديل:
```typescript
const MONGO_URL = process.env.MONGO_URL!; // ❌ يقرأ في module load time
```

### بعد التعديل:
```typescript
export async function connectDB(): Promise<Db> {
  // ✅ يقرأ في runtime عند الحاجة
  const MONGO_URL = process.env.MONGO_URL;
  if (!MONGO_URL) {
    throw new Error('MONGO_URL is not defined in environment variables');
  }
  // ...
}
```

## خطوات التطبيق على Render

### 1. تأكد من أن التعديلات تم رفعها إلى GitHub
```bash
git pull origin main
```

### 2. في Render Dashboard:

#### أ) التحقق من Environment Variables:
1. اذهب إلى **Environment** في القائمة الجانبية
2. تأكد من وجود:
   ```
   MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
   DB_NAME=hospital_ops
   JWT_SECRET=your-secret-key
   ```
3. **مهم**: تأكد من عدم وجود مسافات إضافية في `MONGO_URL`

#### ب) إعادة النشر:
1. اضغط على **"Manual Deploy"** في أعلى الصفحة
2. اختر **"Clear build cache & deploy"**
3. انتظر حتى ينتهي البناء (5-10 دقائق)

### 3. بعد النشر:

#### أ) تحقق من Logs:
1. اذهب إلى **Logs** في Render Dashboard
2. ابحث عن:
   - ✅ `MongoDB connected successfully` = نجح الاتصال
   - ❌ `MONGO_URL is not defined` = المشكلة ما زالت موجودة

#### ب) تهيئة قاعدة البيانات:
بعد التأكد من نجاح الاتصال، افتح:
```
https://hmgdashboard.com/api/init
```
أو:
```
https://your-app-name.onrender.com/api/init
```

هذا سينشئ المستخدم الافتراضي:
- Email: `admin@hospital.com`
- Password: `admin123`

### 4. جرّب تسجيل الدخول:
```
https://hmgdashboard.com/login
Email: admin@hospital.com
Password: admin123
```

## استكشاف الأخطاء الإضافية

### إذا استمر الخطأ بعد إعادة النشر:

#### 1. تحقق من MongoDB Atlas:
- اذهب إلى [MongoDB Atlas](https://cloud.mongodb.com)
- **Network Access**: تأكد من وجود `0.0.0.0/0` (للسماح بجميع IPs)
- **Database Access**: تأكد من أن المستخدم موجود وكلمة المرور صحيحة

#### 2. تحقق من صيغة MONGO_URL:
يجب أن تكون بهذا الشكل:
```
mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
```

**مثال صحيح:**
```
mongodb+srv://Hospitalos_admin:ab9VtwZxaGiftB00@hospitalos-cluster.hqi1xpu.mongodb.net/hospital_ops?retryWrites=true&w=majority
```

**أخطاء شائعة:**
- ❌ مسافات في البداية أو النهاية
- ❌ `mongodb://` بدلاً من `mongodb+srv://`
- ❌ كلمة مرور خاطئة
- ❌ اسم cluster خاطئ

#### 3. تحقق من Render Logs بالتفصيل:
ابحث عن:
- `MONGO_URL environment variable is missing`
- `Available env vars:` - سيعرض المتغيرات المتاحة
- `MongoServerError` - مشكلة في الاتصال
- `ENOTFOUND` - اسم cluster غير صحيح

## ملاحظات مهمة

1. **بعد تعديل Environment Variables**، يجب إعادة تشغيل الخدمة
2. **Render يستخدم HTTPS دائماً** - تأكد من `NEXT_PUBLIC_BASE_URL=https://...`
3. **MongoDB Atlas** قد يستغرق بضع دقائق لتحديث Network Access

---

**آخر تحديث**: بعد إصلاح قراءة `MONGO_URL` في runtime

