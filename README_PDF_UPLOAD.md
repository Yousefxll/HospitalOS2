# Upload PDF Policies from Server

## طريقة رفع PDFs مباشرة من السيرفر

إذا كان لديك مشكلة في رفع PDFs من الواجهة، يمكنك رفعها مباشرة من السيرفر باستخدام الـ script.

### الطريقة 1: رفع ملف واحد

```bash
node scripts/upload-pdf-policies.js /path/to/your/file.pdf
```

### الطريقة 2: رفع عدة ملفات

```bash
node scripts/upload-pdf-policies.js file1.pdf file2.pdf file3.pdf
```

### الطريقة 3: رفع جميع PDFs من مجلد

```bash
node scripts/upload-pdf-policies.js /path/to/pdfs/folder
```

## أمثلة

```bash
# رفع ملف واحد
node scripts/upload-pdf-policies.js ~/Documents/policy.pdf

# رفع عدة ملفات
node scripts/upload-pdf-policies.js ~/Documents/policy1.pdf ~/Documents/policy2.pdf

# رفع جميع PDFs من مجلد
node scripts/upload-pdf-policies.js ~/Documents/policies/
```

## المميزات

- ✅ يعمل مباشرة من السيرفر (لا يحتاج واجهة)
- ✅ يدعم رفع ملف واحد أو عدة ملفات
- ✅ يدعم رفع جميع PDFs من مجلد
- ✅ يتحقق من وجود الملف مسبقاً
- ✅ يستخرج النص من جميع الصفحات
- ✅ يحفظ كل صفحة كسياسة منفصلة
- ✅ يعرض ملخص بعد الانتهاء

## ملاحظات

- تأكد من أن MongoDB متصل
- تأكد من أن ملف `.env.local` يحتوي على `MONGO_URL` و `DB_NAME`
- الملفات الموجودة مسبقاً سيتم تخطيها

