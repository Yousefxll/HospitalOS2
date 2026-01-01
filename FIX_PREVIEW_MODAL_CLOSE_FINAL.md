# ✅ إصلاح نهائي - إغلاق Preview Modal بعد الحذف

## المشكلة:
- Preview Modal لا يُغلق بشكل صحيح بعد الحذف
- يبقى مفتوحاً ويحاول تحميل ملف محذوف → 404 error

## ✅ الحل النهائي:

### 1. ✅ إغلاق Preview قبل بدء الحذف:
- يتم إغلاق preview فوراً عند بدء عملية الحذف (قبل API call)
- هذا يمنع أي محاولات لتحميل الملف أثناء الحذف

### 2. ✅ استخدام useEffect للمراقبة:
- useEffect يراقب `policies` list
- إذا كان policy في preview غير موجود في القائمة (تم حذفه)، يتم إغلاق preview تلقائياً

### 3. ✅ تحسين Dialog open condition:
- Dialog يُفتح فقط إذا كان `isPreviewOpen && !!previewPolicyId`
- يضمن أن dialog لا يُفتح بدون policy ID

### 4. ✅ إغلاق تلقائي عند عدم وجود policy:
- في Preview Dialog، إذا لم يكن policy موجود، يتم إغلاق dialog تلقائياً بعد 100ms

## كيف يعمل الآن:

### عند الحذف:
```typescript
async function handleDelete(policyId: string) {
  // إغلاق preview فوراً - قبل API call
  if (previewPolicyId === policyId) {
    setIsPreviewOpen(false);
    setPreviewPolicyId(null);
  }
  
  // ... delete logic
  
  // التأكد مرة أخرى بعد الحذف
  if (previewPolicyId === policyId) {
    setIsPreviewOpen(false);
    setPreviewPolicyId(null);
  }
}
```

### useEffect للمراقبة:
```typescript
useEffect(() => {
  if (previewPolicyId && isPreviewOpen) {
    const policy = policies.find(p => p.policyId === previewPolicyId);
    if (!policy) {
      // Policy محذوف - إغلاق preview
      setIsPreviewOpen(false);
      setPreviewPolicyId(null);
    }
  }
}, [policies, previewPolicyId, isPreviewOpen]);
```

### Dialog Condition:
```typescript
<Dialog 
  open={isPreviewOpen && !!previewPolicyId}
  onOpenChange={(open) => {
    if (!open) {
      setIsPreviewOpen(false);
      setPreviewPolicyId(null);
    }
  }}
>
```

## النتيجة:

- ✅ Preview Modal يُغلق فوراً عند الحذف (قبل API call)
- ✅ useEffect يراقب ويغلق preview إذا تم حذف policy
- ✅ لا توجد 404 errors
- ✅ Dialog لا يُفتح بدون policy ID
- ✅ إغلاق تلقائي عند عدم وجود policy
