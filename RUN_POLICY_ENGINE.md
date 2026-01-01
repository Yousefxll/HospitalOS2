# تشغيل Policy Engine - خطوات مفصلة

## المشكلة الحالية:
policy-engine غير قيد التشغيل، والحزم المطلوبة غير مثبتة.

## الحل:

### الطريقة 1: استخدام السكربت (الأسهل)

```bash
cd "/Users/yousef/Downloads/HospitalOS 2/policy-engine"
./start.sh
```

### الطريقة 2: يدوياً

```bash
# 1. انتقل إلى مجلد policy-engine
cd "/Users/yousef/Downloads/HospitalOS 2/policy-engine"

# 2. ثبّت الحزم (أول مرة فقط - قد يستغرق 5-10 دقائق)
pip3 install -r requirements.txt

# 3. شغّل policy-engine
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

## التحقق من التشغيل:

بعد التشغيل، يجب أن ترى:
```
INFO:     Uvicorn running on http://0.0.0.0:8001 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Application startup complete.
```

ثم افتح terminal آخر وتحقق:
```bash
curl http://localhost:8001/health
```

يجب أن ترى: `{"ok":true}`

## ملاحظات مهمة:

1. **يجب أن يكون لديك terminalين:**
   - Terminal 1: HospitalOS (`yarn dev`) - يعمل على port 3000
   - Terminal 2: policy-engine (`uvicorn...`) - يعمل على port 8001

2. **تثبيت الحزم قد يستغرق وقتاً** - خاصة `sentence-transformers` و `chromadb`

3. **إذا ظهرت أخطاء أثناء التثبيت:**
   - تأكد أن Python 3.9+ مثبت
   - قد تحتاج: `pip3 install --upgrade pip`

4. **بعد التشغيل الناجح:**
   - اذهب إلى http://localhost:3000/policies
   - يجب أن تختفي رسائل الخطأ 503
   - يمكنك رفع الملفات بنجاح
