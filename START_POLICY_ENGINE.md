# كيفية تشغيل Policy Engine

policy-engine يحتاج أن يكون قيد التشغيل قبل استخدام صفحات Policies في HospitalOS.

## الخطوات:

### 1. الانتقال إلى مجلد policy-engine:
```bash
cd policy-engine
```

### 2. إنشاء virtual environment (اختياري لكن مستحسن):
```bash
python3 -m venv venv
source venv/bin/activate  # On Mac/Linux
# أو
venv\Scripts\activate  # On Windows
```

### 3. تثبيت المتطلبات:
```bash
pip install -r requirements.txt
```

### 4. تشغيل policy-engine:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

## التحقق من أن policy-engine يعمل:

افتح المتصفح أو استخدم curl:
```bash
curl http://localhost:8001/health
```

يجب أن ترى:
```json
{"ok": true}
```

## ملاحظات:

- policy-engine يعمل على المنفذ 8001
- HospitalOS (على المنفذ 3000) سيتصل بـ policy-engine تلقائياً
- يمكنك ترك policy-engine يعمل في terminal منفصل بينما HospitalOS يعمل في terminal آخر

## في حالة وجود مشاكل:

إذا كان المنفذ 8001 مستخدم:
```bash
lsof -ti:8001 | xargs kill -9
```

أو استخدم منفذ آخر (ولكن تأكد من تحديث `POLICY_ENGINE_URL` في `.env.local`):
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload
```
