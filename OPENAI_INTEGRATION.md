# ربط policy-engine بـ OpenAI

## ✅ تم الإكمال

تم ربط policy-engine بـ OpenAI API key لاستخدامه في الميزات التالية:

### الميزات المدعومة:

1. **Generate Policy** (`POST /v1/generate`)
   - إنشاء سياسات جديدة باستخدام OpenAI
   - يدعم معايير CBAHI, JCI, Local
   - يستخدم `gpt-4o-mini` model

2. **Harmonize Policies** (`POST /v1/harmonize`)
   - توحيد سياسات متعددة في سياسة واحدة
   - يقرأ محتوى السياسات من storage
   - يحل التعارضات والاختلافات

3. **Detect Conflicts** (`POST /v1/conflicts`)
   - الكشف عن التعارضات بين السياسات
   - يدعم 3 أوضاع:
     - `single`: تحليل سياسة واحدة للتعارضات الداخلية
     - `pair`: مقارنة سياستين محددتين
     - `global`: تحليل جميع السياسات (مبسط)

### التغييرات:

1. ✅ إضافة `openai>=1.0.0` إلى `requirements.txt`
2. ✅ إنشاء `app/openai_client.py` - OpenAI client helper
3. ✅ تحديث `routes_generate.py` - استخدام OpenAI لإنشاء السياسات
4. ✅ تحديث `routes_harmonize.py` - استخدام OpenAI لتوحيد السياسات
5. ✅ تحديث `routes_conflicts.py` - استخدام OpenAI للكشف عن التعارضات

### الإعداد:

1. تثبيت الحزم:
```bash
cd policy-engine
source venv/bin/activate
pip install openai>=1.0.0
```

2. إضافة OpenAI API Key:
```bash
export OPENAI_API_KEY=sk-your-api-key-here
```

أو في `.env` file:
```
OPENAI_API_KEY=sk-your-api-key-here
```

### الاستخدام:

كل endpoint سيفحص وجود `OPENAI_API_KEY`:
- إذا كان موجود: يستخدم OpenAI
- إذا لم يكن موجود: يرجع خطأ 503 مع رسالة واضحة

### ملاحظة:

- جميع endpoints تستخدم `gpt-4o-mini` model (اقتصادي وسريع)
- يمكن تعديل الـ model في الكود إذا لزم الأمر
- جميع الـ API calls لها error handling مناسب

