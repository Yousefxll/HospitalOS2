# 🔧 حل مشكلة 500 Internal Server Error في Policy Operations

## المشكلة

عند محاولة:
- حذف policy → `500 Internal Server Error`
- تحميل ملف policy → `500 Internal Server Error`
- أي عملية تتطلب policy-engine → `500 Internal Server Error`

## السبب

**policy-engine غير شغال** - الـ Next.js API routes تحاول الاتصال بـ `http://localhost:8001` لكن الـ server غير موجود.

## الحل

### الخطوة 1: تشغيل policy-engine

افتح terminal جديد وانتقل إلى مجلد policy-engine:

```bash
cd "/Users/yousef/Downloads/HospitalOS 2/policy-engine"
```

### الخطوة 2: تشغيل الـ server

#### الطريقة الأولى (موصى بها):

```bash
# تأكد من وجود virtual environment
python3 -m venv venv
source venv/bin/activate  # On macOS/Linux

# أو إذا كان venv موجود:
source venv/bin/activate

# ثبت المتطلبات
pip install -r requirements.txt

# شغل الـ server
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

#### الطريقة الثانية (استخدام start.sh):

```bash
chmod +x start.sh
./start.sh
```

### الخطوة 3: التحقق من أن الـ server يعمل

افتح terminal آخر وتحقق:

```bash
curl http://localhost:8001/health
```

يجب أن ترى:
```json
{"ok": true}
```

### الخطوة 4: اختبار الوظائف

بعد تشغيل policy-engine:
1. جرّب حذف policy مرة أخرى → يجب أن يعمل
2. جرّب فتح ملف policy → يجب أن يعمل

## ملاحظات

- **policy-engine يجب أن يكون شغال دائماً** عندما تريد استخدام Policy System
- إذا أوقفت policy-engine، جميع العمليات (Delete, Preview, Reprocess, Search) ستفشل
- يمكنك تشغيل policy-engine في terminal منفصل أو في background

## تشغيل في Background (اختياري)

إذا أردت تشغيل policy-engine في background:

```bash
cd "/Users/yousef/Downloads/HospitalOS 2/policy-engine"
source venv/bin/activate
nohup uvicorn app.main:app --host 0.0.0.0 --port 8001 > policy-engine.log 2>&1 &
```

للتحقق من الـ logs:
```bash
tail -f policy-engine.log
```

لإيقاف policy-engine:
```bash
# ابحث عن process ID
ps aux | grep uvicorn

# أوقفه
kill <PID>
```

## المشاكل الشائعة

### خطأ: "Port 8001 already in use"
- هناك process آخر يستخدم port 8001
- أوقف العملية القديمة:
  ```bash
  lsof -ti:8001 | xargs kill -9
  ```

### خطأ: "Module not found"
- تأكد من تفعيل virtual environment
- ثبت المتطلبات: `pip install -r requirements.txt`

### خطأ: "OPENAI_API_KEY required"
- أضف `OPENAI_API_KEY` إلى `.env` في مجلد policy-engine (إذا كنت تستخدم OpenAI embeddings)

