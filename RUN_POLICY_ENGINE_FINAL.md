# تشغيل Policy Engine - الحل النهائي

## المشكلة:
Python 3.14 جديد جداً وبعض الحزم لم تدعمه بالكامل. 

## الحل:

### 1. افتح Terminal جديد

### 2. شغّل الأوامر التالية:

```bash
cd "/Users/yousef/Downloads/HospitalOS 2/policy-engine"

# إنشاء virtual environment
python3 -m venv venv

# تفعيل virtual environment
source venv/bin/activate

# تحديث pip
pip install --upgrade pip setuptools wheel

# تثبيت الحزم الأساسية أولاً
pip install fastapi uvicorn[standard] python-multipart pydantic pydantic-settings

# تثبيت chromadb
pip install chromadb

# تثبيت باقي الحزم
pip install sentence-transformers PyPDF2 pdf2image pytesseract easyocr Pillow numpy python-dotenv
```

### 3. شغّل policy-engine:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### 4. التحقق:

في terminal آخر:
```bash
curl http://localhost:8001/health
```

يجب أن ترى: `{"ok":true}`

---

## ملاحظة مهمة:

إذا واجهت مشاكل في التثبيت مع Python 3.14، يمكنك استخدام Python 3.11 أو 3.12:

```bash
# تثبيت Python 3.11 باستخدام Homebrew
brew install python@3.11

# استخدام Python 3.11
python3.11 -m venv venv
source venv/bin/activate
# ثم كرر خطوات التثبيت
```
