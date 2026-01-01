# ✅ إضافة شريط التحميل وتحسين عرض Policies

## ما تم إنجازه:

### 1. ✅ شريط التحميل (Progress Bar)
- تم إضافة `Progress` component من `@/components/ui/progress`
- يظهر شريط تحميل أثناء رفع الملفات
- يعرض النسبة المئوية (0% → 30% → 70% → 100%)

### 2. ✅ تحسين عرض السياسات
- السياسات تظهر فوراً بعد الرفع
- Auto-refresh كل 3 ثواني أثناء المعالجة
- تتبع الـ jobs المرفوعة حتى تصبح READY

### 3. ✅ Loading States
- Loading indicator عند تحميل الصفحة لأول مرة
- شريط تحميل أثناء الرفع
- رسالة "Processing..." أثناء المعالجة

### 4. ✅ Auto-Polling
- Polling كل 3 ثواني للسياسات قيد المعالجة
- توقف تلقائي عند اكتمال المعالجة
- Toast notification عند اكتمال المعالجة

## الميزات الجديدة:

### أثناء الرفع:
- ✅ شريط تحميل مع النسبة المئوية
- ✅ رسالة "Uploading and processing files..."
- ✅ زر Upload مع spinner

### بعد الرفع:
- ✅ السياسات تظهر فوراً في الجدول
- ✅ Badge يوضح الحالة (QUEUED/PROCESSING/READY)
- ✅ Progress indicator لكل policy
- ✅ رسالة "Processing uploaded files..." أثناء المعالجة

### عند اكتمال المعالجة:
- ✅ Toast notification: "Indexing complete"
- ✅ Status يتغير إلى READY
- ✅ Preview button يصبح active

## الاستخدام:

1. اضغط "Upload Policies"
2. اختر ملف (أو عدة ملفات)
3. ستظهر:
   - شريط تحميل مع النسبة المئوية
   - السياسات تظهر فوراً في الجدول
   - Status: QUEUED أو PROCESSING
4. أثناء المعالجة:
   - رسالة "Processing uploaded files..."
   - Auto-refresh كل 3 ثواني
   - Progress indicator في الجدول
5. عند الانتهاء:
   - Status يصبح READY
   - Toast: "Indexing complete"
   - Preview button يصبح active

