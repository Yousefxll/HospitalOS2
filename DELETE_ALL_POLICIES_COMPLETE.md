# ✅ حذف جميع Policies والملفات

## 📍 أماكن حفظ الملفات:

### Data Directory الرئيسي:
```
/Users/yousef/Downloads/HospitalOS 2/policy-engine/data
```

### البنية الكاملة:

1. **Job Files** (source of truth):
   ```
   data/jobs/{jobId}.json
   ```
   - كل job file يحتوي على: jobId, tenantId, policyId, filename, status, progress

2. **Policy Directories** (الملفات الأصلية):
   ```
   data/{tenantId}/{policyId}/{filename}.pdf
   ```
   - مثال: `data/default/0032f650-f0e1-430e-8add-81d98801c81c/[RH-002]Referral To Rehabilitation Services.pdf`

3. **Text Files** (النصوص المستخرجة):
   ```
   data/text/{tenantId}/{policyId}/page_{pageNum}.txt
   ```
   - نص كل صفحة في ملف منفصل

4. **Manifest Files**:
   - **Per-policy manifest**: `data/manifests/{tenantId}/{policyId}.json`
   - **Global manifest**: `data/{tenantId}/manifest.json`

5. **Vector Store (ChromaDB)**:
   ```
   data/chroma/
   ```
   - قاعدة بيانات vector embeddings

## ✅ Script للحذف:

تم إنشاء script في:
```
policy-engine/scripts/delete_all_policies.py
```

### الاستخدام:
```bash
cd policy-engine
python3 scripts/delete_all_policies.py
```

### ما يفعله Script:
1. ✅ يسرد جميع policies من job files
2. ✅ يحذف جميع job files
3. ✅ يحذف جميع chunks من ChromaDB
4. ✅ يحذف جميع policy directories والملفات
5. ✅ يحذف جميع manifest files
6. ✅ يحدث global manifest
7. ✅ يُنشئ تقرير شامل بالمسارات

### التقرير:
يُحفظ التقرير في:
```
policy-engine/deletion_report.json
```

التقرير يحتوي على:
- Data directory path
- قائمة بجميع policies المحذوفة
- قائمة بجميع job files المحذوفة (مع المسارات)
- قائمة بجميع policy directories المحذوفة (مع الملفات)
- قائمة بجميع manifest files المحذوفة
- أي أخطاء حدثت

## 📊 النتيجة:

✅ **تم حذف جميع الملفات بنجاح!**

- ✅ Job files: 0 files (لا توجد policies في النظام حالياً)
- ✅ Policy directories: 0 directories
- ✅ Manifest files: 0 files
- ✅ Vector store: تم التنظيف

## 🔍 للتحقق:

```bash
# فحص job files
ls -la policy-engine/data/jobs/

# فحص policy directories
ls -la policy-engine/data/default/

# فحص manifests
ls -la policy-engine/data/manifests/default/

# فحص ChromaDB
ls -la policy-engine/data/chroma/
```
