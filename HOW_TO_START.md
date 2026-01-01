# كيفية تشغيل Policy Engine

## ⚠️ ملاحظة مهمة:
policy-engine يحتاج Python 3.12 و chromadb 0.4.18 مع numpy < 2.0.

## الخطوات:

### 1. افتح Terminal جديد

### 2. شغّل:

```bash
cd "/Users/yousef/Downloads/HospitalOS 2/policy-engine"
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### 3. إذا لم يعمل، أعد تثبيت chromadb:

```bash
cd "/Users/yousef/Downloads/HospitalOS 2/policy-engine"
source venv/bin/activate
pip uninstall -y chromadb
pip install chromadb==0.4.22 'numpy<2.0'
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### 4. التحقق:

```bash
curl http://localhost:8001/health
```

يجب أن ترى: `{"ok":true}`
