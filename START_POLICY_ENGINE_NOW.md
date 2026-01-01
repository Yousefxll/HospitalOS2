# تشغيل Policy Engine الآن - الحل النهائي

## ✅ Python 3.12 متوفر!

### الخطوات:

#### 1. افتح Terminal جديد

#### 2. شغّل هذه الأوامر بالترتيب:

```bash
cd "/Users/yousef/Downloads/HospitalOS 2/policy-engine"

# حذف venv القديم (إذا موجود)
rm -rf venv

# إنشاء جديد بـ Python 3.12
/opt/homebrew/opt/python@3.12/bin/python3.12 -m venv venv

# تفعيل
source venv/bin/activate

# تحديث pip
pip install --upgrade pip setuptools wheel

# تثبيت الحزم (قد يستغرق 5-10 دقائق)
pip install -r requirements.txt

# تشغيل policy-engine
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

- ✅ Terminal 1: `yarn dev` (HospitalOS على port 3000)
- ✅ Terminal 2: الأوامر أعلاه (policy-engine على port 8001)

بعد ذلك، اذهب إلى http://localhost:3000/policies ✅
