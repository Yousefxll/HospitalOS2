# تعليمات نهائية لتشغيل Policy Engine

## المشكلة:
Python 3.14 غير متوافق مع chromadb. يجب استخدام Python 3.12.

## الحل النهائي:

### افتح Terminal جديد وشغّل:

```bash
cd "/Users/yousef/Downloads/HospitalOS 2/policy-engine"

# حذف venv القديم
rm -rf venv

# إنشاء جديد بـ Python 3.12
/opt/homebrew/opt/python@3.12/bin/python3.12 -m venv venv

# تفعيل
source venv/bin/activate

# تحديث pip
pip install --upgrade pip setuptools wheel

# تثبيت الحزم (يستغرق 5-10 دقائق)
pip install -r requirements.txt

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
