# الحل النهائي - Policy Engine

## المشكلة:
Python 3.14 و numpy 2.x غير متوافقين مع chromadb 0.4.18.

## الحل:

### 1. افتح Terminal جديد

### 2. شغّل هذه الأوامر:

```bash
cd "/Users/yousef/Downloads/HospitalOS 2/policy-engine"

# حذف venv القديم
rm -rf venv

# إنشاء جديد بـ Python 3.12
/opt/homebrew/opt/python@3.12/bin/python3.12 -m venv venv

# تفعيل
source venv/bin/activate

# تحديث pip
pip install --upgrade pip

# تثبيت الحزم الأساسية (بإصدارات محددة)
pip install 'uvicorn[standard]' fastapi python-multipart pydantic pydantic-settings PyPDF2 numpy==1.24.3 chromadb==0.4.18

# (اختياري) باقي الحزم
pip install sentence-transformers pdf2image pytesseract easyocr Pillow python-dotenv

# شغّل
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### 3. يجب أن ترى:

```
INFO:     Uvicorn running on http://0.0.0.0:8001 (Press CTRL+C to quit)
INFO:     Application startup complete.
```

### 4. التحقق:

```bash
curl http://localhost:8001/health
```

يجب أن ترى: `{"ok":true}`

---

## الآن:

- ✅ Terminal 1: `yarn dev` (HospitalOS على 3000)
- ✅ Terminal 2: الأوامر أعلاه (policy-engine على 8001)

اذهب إلى http://localhost:3000/policies ✅
