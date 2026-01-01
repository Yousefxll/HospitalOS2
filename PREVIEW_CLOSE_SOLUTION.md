# ✅ الحل النهائي - إغلاق Preview Modal

## ✅ تم تطبيق الحل:

### 1. ✅ إغلاق Preview قبل Confirm:
```typescript
async function handleDelete(policyId: string) {
  // إغلاق preview فوراً - قبل confirm
  if (previewPolicyId === policyId) {
    setIsPreviewOpen(false);
    setPreviewPolicyId(null);
  }
  
  if (!confirm('Are you sure...')) return;
  // ... rest of delete logic
}
```

### 2. ✅ useEffect للمراقبة:
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

### 3. ✅ Dialog Condition:
```typescript
<Dialog open={isPreviewOpen && !!previewPolicyId}>
```

### 4. ✅ Validation في Render:
```typescript
{previewPolicyId && (() => {
  const policy = policies.find(p => p.policyId === previewPolicyId);
  if (!policy) {
    return <div>Policy not found</div>;
  }
  // ... render iframe
})()}
```

## النتيجة:

- ✅ Preview يُغلق فوراً عند بدء الحذف
- ✅ useEffect يراقب ويغلق إذا تم حذف policy
- ✅ Dialog condition يمنع فتح بدون policy ID
- ✅ Validation في render

## إذا كانت المشكلة ما زالت موجودة:

1. **تحقق من console logs:**
   - يجب أن ترى: "Policy not found in list, closing preview: ..."
   
2. **Hard refresh:**
   - اضغط `Cmd+Shift+R` (Mac) أو `Ctrl+Shift+R` (Windows)

3. **تحقق من policy-engine:**
   - تأكد من أن policy-engine يعمل على port 8001
