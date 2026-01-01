# ✅ إصلاح Preview Modal بعد الحذف

## المشكلة:
- بعد حذف policy، يبقى Preview Modal مفتوحاً
- يحاول تحميل ملف محذوف → 404 error
- Preview Modal يظهر فارغاً

## ✅ الحل المطبق:

### 1. ✅ إغلاق Preview عند الحذف:
- عند حذف policy، يتم إغلاق Preview Modal تلقائياً
- يتم تنظيف `previewPolicyId` state

### 2. ✅ التحقق من وجود Policy في Preview:
- قبل عرض iframe، يتم التحقق من وجود policy
- إذا لم يكن موجود: رسالة "Policy not found"
- إذا لم يكن READY: رسالة "Policy not ready"

### 3. ✅ إغلاق Modal بشكل صحيح:
- عند إغلاق Modal، يتم تنظيف `previewPolicyId`
- يمنع محاولات تحميل ملفات غير موجودة

## كيف يعمل الآن:

### عند الحذف:
```typescript
async function handleDelete(policyId: string) {
  // Close preview if the deleted policy is being previewed
  if (previewPolicyId === policyId) {
    setIsPreviewOpen(false);
    setPreviewPolicyId(null);
  }
  // ... delete logic
}
```

### في Preview Dialog:
```typescript
{previewPolicyId && (() => {
  const policy = policies.find(p => p.policyId === previewPolicyId);
  if (!policy) {
    return <div>Policy not found - may have been deleted</div>;
  }
  if (policy.status !== 'READY') {
    return <div>Policy not ready</div>;
  }
  return <iframe src={...} />;
})()}
```

## النتيجة:

- ✅ Preview Modal يُغلق تلقائياً عند الحذف
- ✅ لا توجد 404 errors
- ✅ رسائل واضحة إذا كان policy غير موجود
- ✅ تجربة مستخدم أفضل
