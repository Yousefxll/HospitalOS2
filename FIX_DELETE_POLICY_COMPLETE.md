# ✅ تم إصلاح مشكلة حذف السياسات

## المشكلة الحقيقية:
السياسات تأتي من **jobs files** وليس من `manifest.json`! لذلك عند حذف policy، يجب حذف job files أيضاً.

## الإصلاحات:

### 1. ✅ إصلاح list_policies endpoint
- الآن يعتمد على `get_all_jobs()` كالمصدر الأساسي
- manifest.json اختياري (للتوافق مع الإصدارات السابقة)

### 2. ✅ إصلاح delete endpoint
- يحذف job files للسياسة
- يحذف من vector store
- يحذف من storage
- يحذف من manifest.json (إن وجد)

### 3. ✅ إضافة logging للتشخيص

## الكود المحدث:

### `routes_policies.py` - List endpoint:
```python
# Get all jobs - this is the source of truth for policies
all_jobs = get_all_jobs(tenantId)

# Build policies list from jobs (primary source)
policies = []
for job in all_jobs:
    policy_info = {
        "policyId": job.get('policyId'),
        "filename": job.get('filename'),
        "status": job.get('status'),
        ...
    }
```

### `routes_policies.py` - Delete endpoint:
```python
# Delete job files for this policy
all_jobs = get_all_jobs(tenantId)
for job in all_jobs:
    if job.get('policyId') == policyId:
        job_file = jobs_dir / f"{job_id}.json"
        if job_file.exists():
            job_file.unlink()
```

## الآن يجب أن يعمل الحذف بشكل صحيح!

**إعادة تشغيل policy-engine:**
```bash
cd policy-engine
# أوقف السيرفر الحالي (CTRL+C)
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

