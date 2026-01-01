# ✅ تم إضافة شريط التحميل وتحسين عرض Policies

## ما تم إنجازه:

### 1. ✅ شريط التحميل (Progress Bar)
- إضافة `Progress` component
- يظهر أثناء رفع الملفات
- يعرض النسبة المئوية (0% → 30% → 70% → 100%)

### 2. ✅ تحسين عرض السياسات
- السياسات تظهر فوراً بعد الرفع
- Auto-refresh كل 3 ثواني أثناء المعالجة
- تتبع الـ jobs المرفوعة حتى تصبح READY

### 3. ✅ Loading States
- Loading indicator عند تحميل الصفحة
- شريط تحميل أثناء الرفع
- رسالة "Processing..." أثناء المعالجة

### 4. ✅ Auto-Polling
- Polling كل 3 ثواني للسياسات قيد المعالجة
- توقف تلقائي عند اكتمال المعالجة
- Toast notification عند اكتمال المعالجة

## كيفية الاستخدام:

1. اضغط "Upload Policies"
2. اختر ملف (أو عدة ملفات)
3. ستظهر:
   - ✅ شريط تحميل مع النسبة المئوية
   - ✅ السياسات تظهر فوراً في الجدول
   - ✅ Status: QUEUED أو PROCESSING
4. أثناء المعالجة:
   - ✅ رسالة "Processing uploaded files..."
   - ✅ Auto-refresh كل 3 ثواني
   - ✅ Progress indicator في الجدول
5. عند الانتهاء:
   - ✅ Status يصبح READY
   - ✅ Toast: "Indexing complete"
   - ✅ Preview button يصبح active

## التغييرات:

- ✅ إضافة `uploadProgress` state
- ✅ إضافة `uploadedJobs` state لتتبع الملفات المرفوعة
- ✅ تحديث `handleUpload` لإظهار progress
- ✅ تحسين `fetchPolicies` لتتبع jobs
- ✅ تحسين polling للسياسات الجديدة
- ✅ إضافة Progress bar component
- ✅ إصلاح Progress component لدعم `value` prop

