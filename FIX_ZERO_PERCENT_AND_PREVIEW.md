# ✅ إصلاح مشكلة 0% ومشكلة Preview بعد الحذف

## المشاكل:

### 1. ✅ النسبة تبقى 0%:
- عندما لا يكون policy موجود بعد (قيد الإنشاء)
- عندما يكون status QUEUED بدون progress data
- عندما لا يوجد progress data

### 2. ✅ Preview بعد الحذف:
- يظهر 404 error عند محاولة فتح preview لملف محذوف
- لا يوجد validation قبل فتح preview

## ✅ الحلول المطبقة:

### 1. ✅ تحسين حساب النسبة المئوية:
- عند عدم وجود policy: 5% (بدلاً من 0%)
- عند QUEUED: 5% (بدلاً من 0%)
- عند وجود progress data: على الأقل 5%
- هذا يمنع ظهور 0% ويوضح أن هناك تقدم

### 2. ✅ تحسين عرض Progress لكل ملف:
- إذا لم يكن policy موجود: يظهر "Processing..." مع 5%
- يظهر اسم الملف حتى لو لم يكتمل بعد
- جميع الحالات تعرض progress بدلاً من الاختفاء

### 3. ✅ إصلاح Preview:
- التحقق من وجود policy قبل فتح preview
- التحقق من status === 'READY' قبل فتح preview
- رسائل خطأ واضحة للمستخدم
- معالجة errors في iframe

## كيف يعمل الآن:

### حساب النسبة:
```typescript
if (!policy) {
  totalProgress += 5; // At least 5% if policy not found yet
} else if (status === 'QUEUED') {
  totalProgress += 5; // At least 5% for queued files
} else if (progress && progress.pagesTotal > 0) {
  // Calculate from actual progress, minimum 5%
  totalProgress += Math.max(pagesProgress + chunksProgress, 5);
}
```

### Preview Validation:
```typescript
function handlePreview(policyId: string) {
  const policy = policies.find(p => p.policyId === policyId);
  if (!policy) {
    toast({ title: 'Policy not found', ... });
    return;
  }
  if (policy.status !== 'READY') {
    toast({ title: 'Policy not ready', ... });
    return;
  }
  // Open preview
}
```

## النتيجة:

- ✅ النسبة لا تبقى 0% - تظهر على الأقل 5%
- ✅ الملفات تظهر في القائمة حتى أثناء المعالجة
- ✅ Preview يتحقق من وجود policy قبل الفتح
- ✅ رسائل خطأ واضحة للمستخدم
