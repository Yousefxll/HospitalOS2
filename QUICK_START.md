# دليل البدء السريع 🚀

## الخطوات السريعة

### 1️⃣ تحديث معلومات MongoDB في `.env.local`

افتح ملف `.env.local` وحدث `MONGO_URL`:

**إذا كان MongoDB على سيرفر خاص:**
```env
MONGO_URL=mongodb://username:password@your-server-ip:27017
```

**أو إذا كان MongoDB Atlas:**
```env
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
```

**أو إذا كان MongoDB محلي:**
```env
MONGO_URL=mongodb://localhost:27017
```

### 2️⃣ تشغيل السيرفر

```bash
yarn dev
```

### 3️⃣ تهيئة قاعدة البيانات

في نافذة terminal جديدة:
```bash
curl -X POST http://localhost:3000/api/init
```

### 4️⃣ تسجيل الدخول

افتح المتصفح على: `http://localhost:3000/login`

**بيانات الدخول:**
- Email: `admin@hospital.com`
- Password: `admin123`

---

## ✅ تم! المشروع جاهز للعمل

