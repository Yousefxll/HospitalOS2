# ✅ تم إصلاح Import Errors

## المشكلة:
كانت هناك imports مفقودة في `jobs.py` و `manifest.py`:
- `get_job_path` غير موجود في `storage.py`
- `get_file_path` غير موجود
- `get_text_path` غير موجود
- `get_manifest_path` غير موجود

## الحل:

### 1. ✅ `jobs.py`:
- استبدال `get_job_path()` ببناء المسار مباشرة: `data_dir / "jobs" / f"{job_id}.json"`
- استبدال `get_file_path()` ببناء المسار: `data_dir / tenant_id / policy_id / filename`
- استبدال `get_text_path()` ببناء المسار: `data_dir / "text" / tenant_id / policy_id / f"page_{page_num}.txt"`

### 2. ✅ `manifest.py`:
- استبدال `get_manifest_path()` ببناء المسار مباشرة: `data_dir / "manifests" / tenant_id / f"{policy_id}.json"`

## النتيجة:

✅ **جميع imports تم إصلاحها!**
✅ **Policy Engine يعمل الآن**

## الخطوات التالية:

1. ✅ تم تشغيل Policy Engine على port 8001
2. ✅ جميع policies محذوفة
3. 🔄 يجب أن يعمل النظام بشكل طبيعي الآن
