# ✅ إصلاح نهائي - إغلاق Preview Modal بعد الحذف

## المشكلة:
- Preview Modal لا يُغلق بشكل صحيح بعد الحذف
- يبقى مفتوحاً ويحاول تحميل ملف محذوف → 404 error

## ✅ الحل النهائي:

### 1. ✅ إغلاق Preview قبل API call:
- يتم إغلاق preview فوراً عند بدء عملية الحذف (قبل confirm و API call)
- هذا يمنع أي محاولات لتحميل الملف أثناء الحذف

### 2. ✅ useEffect للمراقبة:
- useEffect يراقب `policies` list
- إذا كان policy في preview غير موجود في القائمة (تم حذفه)، يتم إغلاق preview تلقائياً
- يعمل كـ backup layer

### 3. ✅ Dialog Condition:
- Dialog يُفتح فقط إذا كان `isPreviewOpen && !!previewPolicyId`
- يمنع فتح dialog بدون policy ID

### 4. ✅ Early Return في Render:
- إذا لم يكن policy موجود في render، يتم return null
- useEffect سيتولى إغلاق dialog

## كيف يعمل الآن:

### عند الحذف (قبل API):
```typescript
async function handleDelete(policyId: string) {
  // إغلاق preview فوراً - قبل أي شيء آخر
  if (previewPolicyId === policyId) {
    setIsPreviewOpen(false);
    setPreviewPolicyId(null);
  }
  
  if (!confirm(...)) return;
  // ... delete API call
}
```

### useEffect للمراقبة:
```typescript
useEffect(() => {
  if (previewPolicyId) {
    const policy = policies.find(p => p.policyId === previewPolicyId);
    if (!policy && isPreviewOpen) {
      // Policy محذوف - إغلاق فوري
      setIsPreviewOpen(false);
      setPreviewPolicyId(null);
    }
  }
}, [policies, previewPolicyId, isPreviewOpen]);
```

### Render Protection:
```typescript
{previewPolicyId && (() => {
  const policy = policies.find(p => p.policyId === previewPolicyId);
  if (!policy) {
    return null; // useEffect will close dialog
  }
  // ... render iframe
})()}
```

## النتيجة:

- ✅ Preview Modal يُغلق فوراً عند بدء الحذف (قبل API)
- ✅ useEffect يراقب ويغلق preview إذا تم حذف policy
- ✅ Dialog condition يمنع فتح dialog بدون policy
- ✅ Early return في render كحماية إضافية
- ✅ لا توجد 404 errors
