# دليل إعداد المشروع

## الخطوة 1: إعداد قاعدة البيانات MongoDB

### خيار 1: MongoDB محلي
```bash
# تشغيل MongoDB محلياً
brew services start mongodb-community  # على macOS
# أو
sudo systemctl start mongod  # على Linux
```

### خيار 2: MongoDB Atlas (سحابي)
1. اذهب إلى https://www.mongodb.com/cloud/atlas
2. أنشئ حساب مجاني
3. أنشئ cluster جديد
4. احصل على connection string

### خيار 3: MongoDB على سيرفر خاص
استخدم connection string الخاص بك

## الخطوة 2: تحديث ملف .env.local

افتح ملف `.env.local` وحدث القيم التالية:

```env
# إذا كان MongoDB محلي
MONGO_URL=mongodb://localhost:27017

# إذا كان MongoDB Atlas أو سيرفر خاص
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority

# اسم قاعدة البيانات
DB_NAME=hospital_ops

# مفتاح JWT (غيّره لقيمة آمنة)
JWT_SECRET=your-super-secret-jwt-key-here

# OpenAI API Key (اختياري)
OPENAI_API_KEY=sk-...

# Base URL
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

## الخطوة 3: تهيئة قاعدة البيانات

بعد تشغيل السيرفر، قم بتهيئة قاعدة البيانات:

```bash
curl -X POST http://localhost:3000/api/init
```

أو افتح المتصفح على: `http://localhost:3000/api/init`

هذا سينشئ:
- مستخدم admin افتراضي
- أقسام عينة

**بيانات الدخول الافتراضية:**
- Email: `admin@hospital.com`
- Password: `admin123`

## الخطوة 4: تشغيل السيرفر

```bash
# وضع التطوير
yarn dev

# أو
npm run dev
```

السيرفر سيعمل على: `http://localhost:3000`

## الخطوة 5: تسجيل الدخول

1. افتح المتصفح على: `http://localhost:3000/login`
2. استخدم بيانات الدخول الافتراضية
3. ابدأ العمل!

## استكشاف الأخطاء

### خطأ: "MONGO_URL is not defined"
- تأكد من وجود ملف `.env.local`
- تأكد من أن المتغيرات مكتوبة بشكل صحيح

### خطأ: "MongoServerError: Authentication failed"
- تحقق من بيانات الاتصال في `MONGO_URL`
- تأكد من أن المستخدم لديه صلاحيات

### خطأ: "Port 3000 already in use"
- غيّر البورت في `package.json` أو
- أوقف العملية التي تستخدم البورت 3000

## ملاحظات مهمة

1. **لا ترفع ملف `.env.local` إلى Git** - يحتوي على معلومات حساسة
2. **غيّر JWT_SECRET** في الإنتاج
3. **استخدم MongoDB Atlas** للإنتاج (أو سيرفر خاص)
4. **احفظ نسخة احتياطية** من قاعدة البيانات بانتظام

