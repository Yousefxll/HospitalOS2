# حل مشكلة 404 Errors

## المشكلة:
ملفات Next.js static assets لا تُحمّل (404 errors)

## الحل:

### 1. أوقف خادم التطوير (إذا كان يعمل):
اضغط `CTRL+C` في Terminal الذي يشغّل `yarn dev`

### 2. نظف البناء:
```bash
cd "/Users/yousef/Downloads/HospitalOS 2"
rm -rf .next
rm -rf node_modules/.cache
```

### 3. أعد بناء المشروع:
```bash
yarn build
```

### 4. شغّل خادم التطوير من جديد:
```bash
yarn dev
```

### 5. افتح المتصفح:
- اذهب إلى `http://localhost:3000/policies`
- اضغط `Cmd+Shift+R` (Mac) أو `Ctrl+Shift+R` (Windows) لعمل hard refresh
- افتح Developer Console (F12) وتحقق من عدم وجود أخطاء 404

---

## ملاحظة:
إذا استمرت المشكلة:
1. تأكد من أن `yarn dev` يعمل بشكل صحيح
2. تأكد من أن port 3000 غير مستخدم من قبل تطبيق آخر
3. حاول إعادة تشغيل Terminal
