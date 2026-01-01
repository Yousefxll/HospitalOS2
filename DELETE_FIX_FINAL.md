# ✅ إصلاح نهائي لمشكلة حذف السياسات

## المشكلة:
السياسات تأتي من **jobs files** (`data/jobs/*.json`) وليس من `manifest.json`. عند الحذف، كان الكود يحذف فقط من manifest (غير موجود) ولم يحذف job files!

## الإصلاح:

### 1. ✅ تحديث list endpoint
- يعتمد على `get_all_jobs()` كمصدر أساسي للسياسات
- manifest.json اختياري

### 2. ✅ تحديث delete endpoint  
- يحذف job files للسياسة
- يحذف من vector store
- يحذف من storage  
- يحذف من manifest.json (إن وجد)

## الخطوات التالية:

**إعادة تشغيل policy-engine:**
```bash
cd policy-engine
# أوقف السيرفر الحالي
source venv/bin/activate  
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

بعد إعادة التشغيل، جرّب حذف policy مرة أخرى - يجب أن تعمل الآن! ✅

