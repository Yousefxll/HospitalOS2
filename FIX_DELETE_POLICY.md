# ✅ إصلاح مشكلة حذف السياسات

## المشكلة:
عند حذف سياسة، تظهر رسالة نجاح لكن السياسة لا تُحذف فعلياً.

## الإصلاحات:

### 1. ✅ إنشاء `/v1/policies/{policyId}` DELETE endpoint في policy-engine
- تم إنشاء `policy-engine/app/api/routes_policies.py`
- Endpoint يحذف:
  - البيانات من vector store (ChromaDB)
  - الملفات من storage
  - الإدخال من manifest.json

### 2. ✅ إضافة `delete_policy_files` في storage.py
- يحذف directory كامل للسياسة
- يزيل الإدخال من manifest.json

### 3. ✅ تحسين handleDelete في frontend
- إضافة `await` لـ `fetchPolicies()` بعد الحذف
- تحسين error handling
- إضافة console.error للتشخيص

### 4. ✅ التأكد من تسجيل routes في main.py
- التأكد من أن `policies_router` مسجل في FastAPI app

## الخطوات التالية:

1. **إعادة تشغيل policy-engine:**
```bash
cd policy-engine
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

2. **تجربة الحذف:**
- اذهب إلى `/policies`
- اضغط على أيقونة سلة المهملات
- تأكد من أن السياسة تختفي فوراً

## الكود الجديد:

### `policy-engine/app/api/routes_policies.py`:
```python
@router.delete("/v1/policies/{policyId}")
async def delete_policy_endpoint(
    policyId: str,
    tenantId: str = Query(..., description="Tenant identifier")
):
    # Delete from vector store
    delete_policy_chunks(tenantId, policyId)
    
    # Delete files from storage
    delete_policy_files(tenantId, policyId, Path(settings.data_dir))
    
    return {"message": "Policy deleted successfully", ...}
```

### `app/(dashboard)/policies/page.tsx`:
```typescript
async function handleDelete(policyId: string) {
  // ...
  if (response.ok) {
    toast({ title: 'Success', ... });
    await fetchPolicies(); // ✅ await مهم هنا
  }
}
```
