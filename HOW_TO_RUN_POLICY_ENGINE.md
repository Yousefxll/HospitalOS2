# كيفية تشغيل Policy Engine

## المشكلة الحالية:
policy-engine غير قيد التشغيل، مما يسبب أخطاء 503 في صفحات Policies.

## الحل السريع:

### افتح Terminal جديد واكتب:

```bash
cd "/Users/yousef/Downloads/HospitalOS 2/policy-engine"
./start.sh
```

السكربت سيقوم بـ:
1. ✅ إنشاء virtual environment تلقائياً
2. ✅ تثبيت الحزم المطلوبة
3. ✅ تشغيل policy-engine

### بعد التشغيل:

يجب أن ترى:
```
INFO:     Uvicorn running on http://0.0.0.0:8001 (Press CTRL+C to quit)
INFO:     Application startup complete.
```

### التحقق:

افتح terminal آخر واكتب:
```bash
curl http://localhost:8001/health
```

يجب أن ترى: `{"ok":true}`

---

## الآن يجب أن يكون لديك:

- ✅ **Terminal 1:** `yarn dev` (HospitalOS على port 3000)
- ✅ **Terminal 2:** `./start.sh` (policy-engine على port 8001)

## بعد ذلك:

اذهب إلى http://localhost:3000/policies وستعمل الصفحة بدون أخطاء! ✅

---

## ملاحظات:

- تثبيت الحزم قد يستغرق 5-10 دقائق (أول مرة فقط)
- إذا ظهرت أخطاء، تأكد أن Python 3.9+ مثبت
- يمكنك إيقاف policy-engine بـ CTRL+C في Terminal 2
