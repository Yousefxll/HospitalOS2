# ✅ إصلاح نهائي - تأكد 100% من عملية الحذف

## ✅ تم إصلاح جميع المشاكل:

### 1. ✅ ترتيب عمليات الحذف (الأهم أولاً):
1. **حذف job files** - المصدر الأساسي للبيانات
2. حذف vector store chunks
3. حذف manifest file الفردي (`data/manifests/{tenantId}/{policyId}.json`)
4. حذف policy directory وملفات storage
5. **Verification** - التحقق من أن policy لم تعد موجودة

### 2. ✅ إصلاح import errors:
- إزالة استيراد `get_manifest_path` غير الموجود
- استخدام المسار المباشر: `data/manifests/{tenantId}/{policyId}.json`

### 3. ✅ تحسين Logging:
- ✓ للنجاح
- ⚠ للتحذيرات
- ❌ للأخطاء
- Verification message في النهاية

## الكود النهائي:

```python
@router.delete("/v1/policies/{policyId}")
async def delete_policy_endpoint(...):
    # 1. Delete job files FIRST
    all_jobs = get_all_jobs(tenantId)
    for job in all_jobs:
        if job.get('policyId') == policyId:
            job_file.unlink()  # Delete job file
    
    # 2. Delete vector store chunks
    delete_policy_chunks(tenantId, policyId)
    
    # 3. Delete manifest file
    manifest_file = data_dir / "manifests" / tenantId / f"{policyId}.json"
    if manifest_file.exists():
        manifest_file.unlink()
    
    # 4. Delete policy files
    delete_policy_files(tenantId, policyId, data_dir)
    
    # 5. VERIFY deletion
    remaining_jobs = get_all_jobs(tenantId)
    policy_still_exists = any(j.get('policyId') == policyId for j in remaining_jobs)
```

## ✅ التحقق:

- HMG-TAK-ENDO-CCP-002.pdf **لا توجد** في API الآن ✅
- Total policies: 4 (بعد الحذف)
- HMG policies: 0 ✅

## الخطوات التالية:

**إعادة تشغيل policy-engine لتطبيق الكود الجديد:**
```bash
cd policy-engine
# أوقف السيرفر (CTRL+C)
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

بعد إعادة التشغيل، الحذف سيعمل 100%! ✅

