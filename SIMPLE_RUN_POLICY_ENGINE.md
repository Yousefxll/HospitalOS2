# تشغيل Policy Engine - طريقة بسيطة

## ⚠️ المشكلة الحالية:
Python 3.14 جديد جداً و chromadb لا يعمل معه.

## ✅ الحل السريع:

### 1. تثبيت Python 3.11:

```bash
brew install python@3.11
```

### 2. افتح Terminal جديد وشغّل:

```bash
cd "/Users/yousef/Downloads/HospitalOS 2/policy-engine"

# حذف venv القديم
rm -rf venv

# إنشاء جديد بـ Python 3.11
python3.11 -m venv venv

# تفعيل
source venv/bin/activate

# تثبيت الحزم
pip install --upgrade pip
pip install -r requirements.txt

# تشغيل
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### 3. التحقق:

في terminal آخر:
```bash
curl http://localhost:8001/health
```

يجب أن ترى: `{"ok":true}`

---

## الآن:

- ✅ Terminal 1: `yarn dev` (HospitalOS على 3000)
- ✅ Terminal 2: الأوامر أعلاه (policy-engine على 8001)

بعد ذلك، اذهب إلى http://localhost:3000/policies ✅
