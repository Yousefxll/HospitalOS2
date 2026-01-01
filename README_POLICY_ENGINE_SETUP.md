# إعداد وتشغيل Policy Engine

## ⚠️ متطلبات مهمة:

- Python 3.12 (مستحسن) أو Python 3.11
- **لا تستخدم Python 3.14** - غير متوافق مع chromadb

## الخطوات:

### 1. تأكد من Python 3.12:

```bash
which python3.12
# يجب أن يظهر: /opt/homebrew/opt/python@3.12/bin/python3.12
```

إذا لم يكن متوفر:
```bash
brew install python@3.12
```

### 2. افتح Terminal جديد وشغّل:

```bash
cd "/Users/yousef/Downloads/HospitalOS 2/policy-engine"

# حذف venv القديم
rm -rf venv

# إنشاء جديد بـ Python 3.12
/opt/homebrew/opt/python@3.12/bin/python3.12 -m venv venv

# تفعيل
source venv/bin/activate

# تأكد من Python 3.12
python3 --version  # يجب أن يظهر: Python 3.12.x

# تحديث pip
pip install --upgrade pip

# تثبيت الحزم الأساسية
pip install 'uvicorn[standard]' fastapi python-multipart pydantic pydantic-settings PyPDF2 'numpy<2.0' chromadb==0.4.18

# (اختياري) تثبيت باقي الحزم
pip install sentence-transformers pdf2image pytesseract easyocr Pillow python-dotenv

# شغّل policy-engine
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### 3. يجب أن ترى:

```
INFO:     Uvicorn running on http://0.0.0.0:8001 (Press CTRL+C to quit)
INFO:     Application startup complete.
```

### 4. التحقق:

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
