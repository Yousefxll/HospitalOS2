# الحل النهائي - تشغيل Policy Engine

## ✅ تم إعداد Python 3.12

### الخطوات النهائية:

#### 1. افتح Terminal جديد

#### 2. شغّل هذه الأوامر:

```bash
cd "/Users/yousef/Downloads/HospitalOS 2/policy-engine"

# تأكد من تفعيل venv
source venv/bin/activate

# تأكد أنك تستخدم Python 3.12
python3 --version  # يجب أن يظهر: Python 3.12.12

# تثبيت الحزم الأساسية
pip install --upgrade pip
pip install fastapi 'uvicorn[standard]' python-multipart pydantic pydantic-settings PyPDF2

# تثبيت chromadb
pip install chromadb==0.4.18

# تثبيت باقي الحزم (اختياري - للوظائف الكاملة)
pip install sentence-transformers pdf2image pytesseract easyocr Pillow numpy python-dotenv

# شغّل policy-engine
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

#### 3. يجب أن ترى:

```
INFO:     Uvicorn running on http://0.0.0.0:8001 (Press CTRL+C to quit)
INFO:     Application startup complete.
```

#### 4. التحقق:

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
