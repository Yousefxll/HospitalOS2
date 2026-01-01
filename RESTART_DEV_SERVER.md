# إعادة تشغيل خادم التطوير

## المشكلة:
أخطاء 404 للـ static files - الملفات موجودة لكن الخادم لا يخدمها بشكل صحيح

## الحل:

### 1. أوقف خادم yarn dev الحالي:
- في Terminal الذي يشغّل `yarn dev`
- اضغط `CTRL+C`

### 2. تأكد من تنظيف البناء:
```bash
cd "/Users/yousef/Downloads/HospitalOS 2"
rm -rf .next
rm -rf node_modules/.cache
```

### 3. أعد بناء المشروع:
```bash
yarn build
```

### 4. شغّل خادم التطوير:
```bash
yarn dev
```

### 5. انتظر حتى ترى:
```
- ready started server on 0.0.0.0:3000
- Local: http://localhost:3000
```

### 6. في المتصفح:
- اذهب إلى `http://localhost:3000/policies`
- اضغط `Cmd+Shift+R` (Mac) أو `Ctrl+Shift+R` (Windows) لعمل hard refresh
- تحقق من Console - يجب أن تختفي أخطاء 404

---

## ملاحظة مهمة:
إذا استمرت المشكلة، تأكد من:
1. لا يوجد خادم آخر يعمل على port 3000
2. `yarn dev` يعمل بشكل صحيح (لا توجد أخطاء في Terminal)
3. `.next` directory موجود بعد `yarn build`
