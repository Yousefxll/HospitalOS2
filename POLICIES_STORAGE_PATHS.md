# 📍 أماكن حفظ Policies والملفات

## Data Directory الرئيسي:
```
/Users/yousef/Downloads/HospitalOS 2/policy-engine/data
```

## البنية الكاملة للملفات:

### 1. **Job Files** (المصدر الأساسي للـ policies):
```
data/jobs/{jobId}.json
```
- **الوصف**: ملفات JSON تحتوي على معلومات كل job (policy processing job)
- **المحتوى**: jobId, tenantId, policyId, filename, status, progress, error
- **مثال**: `data/jobs/abc123-def456-ghi789.json`

### 2. **Policy Directories** (الملفات الأصلية - PDFs):
```
data/{tenantId}/{policyId}/{filename}.pdf
```
- **الوصف**: مجلد لكل policy يحتوي على الملف الأصلي (PDF)
- **مثال**: 
  - `data/default/0032f650-f0e1-430e-8add-81d98801c81c/[RH-002]Referral To Rehabilitation Services.pdf`
  - `data/default/2be204f6-f096-4273-b941-db92380ae5c9/HMG-TAK-ENDO-CCP-002.pdf`

### 3. **Text Files** (النصوص المستخرجة من PDFs):
```
data/text/{tenantId}/{policyId}/page_{pageNum}.txt
```
- **الوصف**: ملف نصي لكل صفحة من PDF
- **مثال**: 
  - `data/text/default/0032f650-f0e1-430e-8add-81d98801c81c/page_1.txt`
  - `data/text/default/0032f650-f0e1-430e-8add-81d98801c81c/page_2.txt`

### 4. **Manifest Files**:

#### Per-Policy Manifest:
```
data/manifests/{tenantId}/{policyId}.json
```
- **الوصف**: ملف manifest لكل policy يحتوي على معلومات الاستخراج والفهرسة
- **المحتوى**: fileHash, pages, chunks, status
- **مثال**: `data/manifests/default/0032f650-f0e1-430e-8add-81d98801c81c.json`

#### Global Manifest:
```
data/{tenantId}/manifest.json
```
- **الوصف**: ملف manifest عام يحتوي على قائمة بجميع policies
- **المحتوى**: {policyId: {filename, indexedAt}}
- **مثال**: `data/default/manifest.json`

### 5. **Vector Store (ChromaDB)**:
```
data/chroma/
```
- **الوصف**: قاعدة بيانات ChromaDB لحفظ embeddings
- **الاستخدام**: للبحث السريع في policies
- **البنية الداخلية**: ChromaDB تُدير بنيتها الخاصة

### 6. **Files Directory** (قديم - غير مستخدم حالياً):
```
data/files/
```
- **ملاحظة**: هذا directory قديم وقد لا يُستخدم

## 📊 ملخص المسارات:

```
policy-engine/data/
├── jobs/                          # Job files (source of truth)
│   └── {jobId}.json
├── {tenantId}/                    # Tenant directories (default)
│   ├── {policyId}/                # Policy directories
│   │   └── {filename}.pdf         # Original PDF files
│   └── manifest.json              # Global manifest
├── text/{tenantId}/               # Extracted text files
│   └── {policyId}/
│       └── page_{N}.txt
├── manifests/{tenantId}/          # Per-policy manifests
│   └── {policyId}.json
└── chroma/                        # ChromaDB vector store
    └── (ChromaDB internal files)
```

## 🔍 للبحث عن ملفات policy معينة:

```bash
# البحث عن policy ID معين
find policy-engine/data -name "*0032f650*" -type f

# عرض جميع PDFs
find policy-engine/data -name "*.pdf"

# عرض جميع job files
find policy-engine/data/jobs -name "*.json"
```

## ✅ Script للحذف:

تم إنشاء script في:
```
policy-engine/scripts/delete_all_policies.py
```

### الاستخدام:
```bash
cd policy-engine
python3 scripts/delete_all_policies.py
# Type "yes" to confirm
```

### التقرير:
يُحفظ في: `policy-engine/deletion_report.json`

## 📝 ملاحظات:

- **Job files** هي المصدر الأساسي (source of truth) - إذا تم حذفها، لن تظهر policies في القائمة
- **Policy directories** تحتوي على الملفات الأصلية (PDFs)
- **Vector store** تحتوي على embeddings للبحث السريع
- **Manifests** تحتوي على معلومات الفهرسة والاستخراج
