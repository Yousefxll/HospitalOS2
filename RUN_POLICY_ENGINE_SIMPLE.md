# تشغيل Policy Engine - طريقة بسيطة

## المشكلة:
الحزم Python غير مثبتة، و policy-engine غير قيد التشغيل.

## الحل السريع:

### افتح Terminal جديد واكتب:

```bash
cd "/Users/yousef/Downloads/HospitalOS 2/policy-engine"
./start.sh
```

السكربت سيقوم بـ:
1. إنشاء virtual environment تلقائياً
2. تثبيت الحزم المطلوبة
3. تشغيل policy-engine

---

## أو يدوياً (إذا لم يعمل السكربت):

```bash
# 1. انتقل إلى المجلد
cd "/Users/yousef/Downloads/HospitalOS 2/policy-engine"

# 2. إنشاء virtual environment
python3 -m venv venv

# 3. تفعيل virtual environment
source venv/bin/activate

# 4. تثبيت الحزم (قد يستغرق 5-10 دقائق)
pip install --upgrade pip
pip install -r requirements.txt

# 5. تشغيل policy-engine
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

## التحقق:

بعد التشغيل، افتح terminal آخر واكتب:
```bash
curl http://localhost:8001/health
```

يجب أن ترى: `{"ok":true}`

## الآن:

- ✅ Terminal 1: `yarn dev` (HospitalOS على port 3000)
- ✅ Terminal 2: `./start.sh` أو `uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload` (policy-engine على port 8001)

بعد ذلك، اذهب إلى http://localhost:3000/policies وستعمل!
