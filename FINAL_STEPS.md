# الخطوات النهائية لتشغيل Policy Engine

## ✅ الحل:

### افتح Terminal جديد وشغّل:

```bash
cd "/Users/yousef/Downloads/HospitalOS 2/policy-engine"

# تفعيل venv
source venv/bin/activate

# تثبيت الحزم الناقصة
pip install pdf2image sentence-transformers pytesseract easyocr Pillow python-dotenv

# شغّل policy-engine
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### يجب أن ترى:

```
INFO:     Uvicorn running on http://0.0.0.0:8001 (Press CTRL+C to quit)
INFO:     Application startup complete.
```

### التحقق:

افتح terminal آخر:
```bash
curl http://localhost:8001/health
```

يجب أن ترى: `{"ok":true}`

---

## الآن:

- ✅ Terminal 1: `yarn dev` (HospitalOS على 3000)
- ✅ Terminal 2: الأوامر أعلاه (policy-engine على 8001)

اذهب إلى http://localhost:3000/policies ✅
