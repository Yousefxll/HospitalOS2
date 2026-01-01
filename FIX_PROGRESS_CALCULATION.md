# ✅ إصلاح حساب النسبة المئوية - التحقق من الاكتمال الفعلي

## المشكلة:
- النسبة المئوية كانت تظهر 100% حتى لو لم تكتمل المعالجة
- كان يتم اعتبار `status === 'READY'` كافياً لإعطاء 100% دون التحقق من progress data

## ✅ الحل المطبق:

### 1. ✅ التحقق من progress data عند حساب النسبة:
- حتى لو `status === 'READY'`، يتم التحقق من progress data
- يجب أن تكون `pagesDone >= pagesTotal` و `chunksDone >= chunksTotal` للاعتبار 100%
- إذا كان status READY لكن progress غير مكتمل، يتم حساب النسبة الفعلية

### 2. ✅ تحسين منطق "allReady":
- يتم التحقق من progress data قبل اعتبار policy جاهز
- لا يتم إزالة الملفات من `uploadedJobs` حتى يتم التحقق من الاكتمال الفعلي

## كيف يعمل الآن:

### حساب النسبة المئوية:
```typescript
if (policy.status === 'READY') {
  // التحقق من progress data
  if (progress && progress.pagesTotal > 0 && progress.chunksTotal > 0) {
    if (progress.pagesDone >= progress.pagesTotal && 
        progress.chunksDone >= progress.chunksTotal) {
      totalProgress += 100; // مكتمل فعلاً
    } else {
      // حساب النسبة الفعلية
      const pagesProgress = (progress.pagesDone / progress.pagesTotal) * 50;
      const chunksProgress = (progress.chunksDone / progress.chunksTotal) * 50;
      totalProgress += pagesProgress + chunksProgress;
    }
  }
}
```

### التحقق من الاكتمال:
```typescript
const allReady = uploadedPolicies.every((p: Policy) => {
  if (p.status !== 'READY') return false;
  
  // التحقق من progress data
  const progress = p.progress;
  if (progress && progress.pagesTotal > 0 && progress.chunksTotal > 0) {
    return progress.pagesDone >= progress.pagesTotal && 
           progress.chunksDone >= progress.chunksTotal;
  }
  return true; // إذا لا يوجد progress data لكن status READY
});
```

## النتيجة:

- ✅ النسبة المئوية تعكس التقدم الفعلي
- ✅ لا تظهر 100% إلا عند الاكتمال الفعلي
- ✅ يتم التحقق من progress data قبل الاعتبار جاهز
- ✅ شريط التقدم أكثر دقة
