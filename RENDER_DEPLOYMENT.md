# دليل النشر على Render 🚀

هذا الدليل يوضح كيفية نشر مشروع HospitalOS على Render.

## المتطلبات الأساسية

1. حساب على [Render.com](https://render.com)
2. حساب MongoDB Atlas (أو قاعدة بيانات MongoDB)
3. معرفة بسيطة بـ Git

## الخطوة 1: إعداد قاعدة البيانات MongoDB

### استخدام MongoDB Atlas (موصى به)

1. اذهب إلى [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. أنشئ حساب مجاني (إن لم يكن لديك)
3. أنشئ cluster جديد
4. احصل على Connection String

**مثال:**
```
mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
```

## الخطوة 2: رفع المشروع إلى Git

تأكد من أن المشروع موجود على GitHub/GitLab/Bitbucket:

```bash
git add .
git commit -m "Prepare for Render deployment"
git push origin main
```

## الخطوة 3: إنشاء Web Service على Render

1. سجل الدخول إلى [Render Dashboard](https://dashboard.render.com)
2. اضغط على "New +" → "Web Service"
3. اختر المستودع (Repository) الخاص بك
4. املأ البيانات التالية:
   - **Name**: `hospitalos` (أو أي اسم تفضله)
   - **Environment**: `Node`
   - **Region**: اختر الأقرب لك
   - **Branch**: `main` (أو الفرع الذي تريد النشر منه)
   - **Root Directory**: اتركه فارغاً (إذا كان المشروع في الجذر)
   - **Build Command**: `yarn install && yarn build`
   - **Start Command**: `yarn start`

## الخطوة 4: إعداد Environment Variables

في صفحة إعدادات الخدمة، اذهب إلى "Environment" وأضف المتغيرات التالية:

### متغيرات مطلوبة:

```env
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
DB_NAME=hospital_ops
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
NEXT_PUBLIC_BASE_URL=https://your-app-name.onrender.com
```

### متغيرات اختيارية:

```env
OPENAI_API_KEY=sk-... (إذا كنت تستخدم ميزات AI)
CRON_SECRET=your-cron-secret-key (سيتم إنشاؤه تلقائياً إذا استخدمت render.yaml)
NODE_ENV=production
```

**ملاحظات مهمة:**
- `MONGO_URL`: استبدل `username` و `password` و `cluster` بقيمك الفعلية
- `JWT_SECRET`: استخدم مفتاح قوي وعشوائي (يمكن استخدام `openssl rand -base64 32`)
- `NEXT_PUBLIC_BASE_URL`: استبدل `your-app-name` باسم التطبيق الفعلي على Render

## الخطوة 5: النشر

1. اضغط على "Create Web Service"
2. انتظر حتى ينتهي البناء (Build) - قد يستغرق 5-10 دقائق
3. بعد اكتمال البناء، سيكون التطبيق متاحاً على: `https://your-app-name.onrender.com`

## الخطوة 6: تهيئة قاعدة البيانات

بعد النشر الأول، يجب تهيئة قاعدة البيانات:

```bash
curl -X POST https://your-app-name.onrender.com/api/init
```

أو افتح المتصفح على: `https://your-app-name.onrender.com/api/init`

## إعداد Cron Jobs (اختياري)

إذا كنت تستخدم cron jobs (مثل SLA scheduler):

### الطريقة 1: استخدام Cron Job Service في Render

1. في Render Dashboard، اضغط على "New +" → "Cron Job"
2. املأ البيانات:
   - **Name**: `sla-scheduler`
   - **Schedule**: `*/15 * * * *` (كل 15 دقيقة)
   - **Command**: 
     ```bash
     curl -X GET https://your-app-name.onrender.com/api/cron/patient-experience/run-sla?secret=YOUR_CRON_SECRET
     ```
   - **Service**: اختر الخدمة التي أنشأتها

### الطريقة 2: استخدام خدمة خارجية

يمكنك استخدام خدمات مثل:
- [cron-job.org](https://cron-job.org)
- [EasyCron](https://www.easycron.com)
- [UptimeRobot](https://uptimerobot.com)

## استكشاف الأخطاء

### خطأ: "Build failed"

- تأكد من أن `package.json` يحتوي على جميع dependencies
- تأكد من أن Build Command صحيح: `yarn install && yarn build`
- راجع Build Logs في Render Dashboard

### خطأ: "MONGO_URL is not defined"

- تأكد من إضافة `MONGO_URL` في Environment Variables
- تأكد من عدم وجود مسافات إضافية في القيمة

### خطأ: "Port already in use"

- Next.js يستخدم PORT تلقائياً من environment - لا حاجة لتحديده يدوياً

### التطبيق لا يعمل بعد النشر

1. تحقق من Logs في Render Dashboard
2. تأكد من أن جميع Environment Variables موجودة
3. تأكد من أن Start Command صحيح: `yarn start`

## نصائح إضافية

### تخزين الملفات (PDF Policies)

⚠️ **مهم**: المشروع يستخدم نظام الملفات لتخزين ملفات PDF في `storage/policies/`. 

على Render، نظام الملفات ephemeral (مؤقت) - أي أن الملفات ستُفقد عند إعادة التشغيل. 

**الحلول المقترحة:**
1. **للإنتاج**: استخدم خدمة تخزين سحابي مثل AWS S3، Google Cloud Storage، أو Cloudinary
2. **للاختبار**: يمكنك الاستمرار في استخدام filesystem، لكن اعلم أن الملفات قد تُفقد عند إعادة التشغيل

### تحسين الأداء

- استخدم MongoDB Atlas للحصول على أداء أفضل
- قم بترقية الخطة إلى Paid للحصول على أداء أفضل (Render Free قد يكون بطيئاً في التشغيل الأول)

### الأمان

- **لا ترفع** ملفات `.env.local` إلى Git
- استخدم JWT_SECRET قوي وفريد
- استخدم HTTPS دائماً (مفعل تلقائياً على Render)

### النسخ الاحتياطي

- قم بعمل backup منتظم لقاعدة البيانات
- استخدم MongoDB Atlas للحصول على نسخ احتياطية تلقائية

## الدعم

إذا واجهت مشاكل:
1. راجع Build Logs و Runtime Logs في Render Dashboard
2. تحقق من أن جميع المتغيرات البيئية موجودة وصحيحة
3. تأكد من أن قاعدة البيانات متاحة ومتصل بها

---

**تم النشر بنجاح! 🎉**

الآن يمكنك الوصول إلى التطبيق على: `https://your-app-name.onrender.com`

