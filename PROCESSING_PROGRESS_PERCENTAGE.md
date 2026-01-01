# ✅ إضافة النسبة المئوية لمعالجة الملفات

## ✅ التحسينات المطبقة:

### 1. ✅ النسبة المئوية الإجمالية:
- يتم حساب النسبة المئوية الإجمالية لجميع الملفات قيد المعالجة
- تظهر بجانب "Processing and indexing files..."
- مثال: "Processing and indexing files... 45%"

### 2. ✅ النسبة المئوية لكل ملف:
- كل ملف له شريط تقدم مع نسبته المئوية
- مثال: "example.pdf - 67% - 5/10 pages, 30/50 chunks"

## كيف يعمل:

### حساب النسبة الإجمالية:
```typescript
// يتم حساب متوسط التقدم لجميع الملفات
let totalProgress = 0;
let totalFiles = 0;

uploadedJobs.forEach(jobId => {
  const progress = processingProgress[jobId] || policy?.progress;
  // حساب التقدم لكل ملف
  if (progress && progress.pagesTotal > 0 && progress.chunksTotal > 0) {
    const pagesProgress = (progress.pagesDone / progress.pagesTotal) * 50;
    const chunksProgress = (progress.chunksDone / progress.chunksTotal) * 50;
    totalProgress += pagesProgress + chunksProgress;
  }
  totalFiles++;
});

const overallPercent = Math.round(totalProgress / totalFiles);
```

### عرض النسبة:
- **الإجمالي**: بجانب العنوان "Processing and indexing files... 45%"
- **لكل ملف**: في النص "filename.pdf - 67% - details"

## النتيجة:

- ✅ النسبة المئوية الإجمالية تظهر بجانب العنوان
- ✅ النسبة المئوية لكل ملف تظهر في التفاصيل
- ✅ شريط التقدم يتحرك مع النسبة المئوية
- ✅ تحديث تلقائي كل 2 ثانية

## الآن:

بدلاً من:
```
Processing and indexing files... [loader]
```

يظهر:
```
Processing and indexing files... 45% [loader]
filename.pdf - 67% - 5/10 pages, 30/50 chunks
[=====>     ] 67%
```

