# حل بسيط - إعادة تشغيل yarn dev

## المشكلة:
أخطاء 404 في static files - الخادم لا يخدم الملفات بشكل صحيح

## الحل السريع:

### 1. أوقف yarn dev:
- في Terminal الذي يشغّل `yarn dev`
- اضغط `CTRL+C`

### 2. نظف وأعد البناء:
```bash
cd "/Users/yousef/Downloads/HospitalOS 2"
rm -rf .next
yarn build
```

### 3. شغّل yarn dev:
```bash
yarn dev
```

### 4. في المتصفح:
- اذهب إلى `http://localhost:3000/policies`
- اضغط `Cmd+Shift+R` لعمل hard refresh
- يجب أن تختفي أخطاء 404

---

**ملاحظة:** أخطاء البناء التي تراها (Dynamic server usage) طبيعية في Next.js - لا تمنع التشغيل في development mode.
