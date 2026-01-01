# تشغيل Policy Engine بسرعة

## الخطوات السريعة:

### 1. افتح Terminal جديد (منفصل عن HospitalOS)

### 2. انتقل إلى مجلد policy-engine:
```bash
cd "/Users/yousef/Downloads/HospitalOS 2/policy-engine"
```

### 3. تثبيت المتطلبات (أول مرة فقط):
```bash
pip3 install -r requirements.txt
```

### 4. تشغيل policy-engine:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

## التحقق من التشغيل:

يجب أن ترى رسالة مثل:
```
INFO:     Uvicorn running on http://0.0.0.0:8001 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

افتح متصفح أو استخدم curl:
```bash
curl http://localhost:8001/health
```

يجب أن ترى: `{"ok":true}`

## الآن:

- ✅ Terminal 1: HospitalOS (`yarn dev`) - يجب أن يعمل على http://localhost:3000
- ✅ Terminal 2: policy-engine (`uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload`) - يجب أن يعمل على http://localhost:8001

بعد تشغيل policy-engine، اذهب إلى http://localhost:3000/policies وستعمل الصفحة بدون أخطاء!
