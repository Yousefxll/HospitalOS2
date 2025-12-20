# 🚀 ابدأ من هنا - نشر المشروع على Render

## ⚡ الخطوات السريعة (5 دقائق)

### 1️⃣ اذهب إلى Render Dashboard
👉 [https://dashboard.render.com](https://dashboard.render.com)

### 2️⃣ اضغط "New +" → "Web Service"

### 3️⃣ اختر المستودع
- اختر: **Yousefxll/HospitalOS2**

### 4️⃣ املأ الإعدادات الأساسية

```
Name: hospitalos
Region: Singapore (أو الأقرب لك)
Branch: main
Build Command: yarn install && yarn build
Start Command: yarn start
```

### 5️⃣ أضف Environment Variables

في قسم "Environment Variables"، أضف:

| المتغير | القيمة |
|---------|--------|
| `MONGO_URL` | `mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority` |
| `DB_NAME` | `hospital_ops` |
| `JWT_SECRET` | استخدم: `openssl rand -base64 32` لإنشاء مفتاح |
| `NEXT_PUBLIC_BASE_URL` | `https://hospitalos.onrender.com` (استبدل hospitalos باسم التطبيق) |

**⚠️ مهم**: 
- استبدل `username` و `password` و `cluster` في `MONGO_URL` بقيمك من MongoDB Atlas
- بعد اختيار اسم التطبيق، استبدله في `NEXT_PUBLIC_BASE_URL`

### 6️⃣ اضغط "Create Web Service"

### 7️⃣ انتظر البناء (5-10 دقائق)

### 8️⃣ بعد النشر، افتح:
```
https://your-app-name.onrender.com/api/init
```
لتهيئة قاعدة البيانات

### 9️⃣ سجل الدخول:
```
https://your-app-name.onrender.com/login
Email: admin@hospital.com
Password: admin123
```

---

## 📚 للتفاصيل الكاملة
راجع: `RENDER_SETUP_STEPS.md` أو `RENDER_DEPLOYMENT.md`

---

## ⚠️ متطلبات قبل النشر

### MongoDB Atlas
إذا لم يكن لديك MongoDB Atlas:
1. اذهب إلى [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. أنشئ حساب مجاني
3. أنشئ cluster جديد
4. احصل على Connection String
5. في Network Access، أضف IP: `0.0.0.0/0` (لجميع IPs)

### JWT Secret
أنشئ مفتاح آمن:
```bash
openssl rand -base64 32
```

---

✅ **جاهز! ابدأ الآن**

