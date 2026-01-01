# الحل الكامل - Policy Engine

## المشكلة:
Python 3.14 و numpy 2.x غير متوافقين. بعض الحزم ناقصة.

## ✅ الحل النهائي:

### افتح Terminal جديد:

```bash
cd "/Users/yousef/Downloads/HospitalOS 2/policy-engine"

# تأكد من تفعيل venv
source venv/bin/activate

# تأكد من Python 3.12
python3 --version  # يجب أن يظهر: Python 3.12.x

# تثبيت الحزم الناقصة
pip install easyocr pytesseract Pillow python-dotenv

# شغّل policy-engine
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### يجب أن ترى:

```
INFO:     Uvicorn running on http://0.0.0.0:8001 (Press CTRL+C to quit)
INFO:     Application startup complete.
```

### التحقق:

```bash
curl http://localhost:8001/health
```

يجب أن ترى: `{"ok":true}`

---

## الآن:

- ✅ Terminal 1: `yarn dev` (HospitalOS على 3000)
- ✅ Terminal 2: الأوامر أعلاه (policy-engine على 8001)

اذهب إلى http://localhost:3000/policies ✅
