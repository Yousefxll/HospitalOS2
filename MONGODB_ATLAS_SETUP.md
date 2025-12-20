# إعداد MongoDB Atlas

## خطوات الحصول على Connection String

### 1. سجل الدخول إلى MongoDB Atlas
- اذهب إلى: https://cloud.mongodb.com
- سجل الدخول بحسابك

### 2. أنشئ أو اختر Cluster
- إذا لم يكن لديك cluster، أنشئ واحداً (Free tier متاح)
- اختر المنطقة الأقرب لك

### 3. احصل على Connection String
1. اضغط على **"Connect"** بجانب cluster
2. اختر **"Connect your application"**
3. اختر **"Node.js"** كـ Driver
4. انسخ الـ Connection String

الشكل سيكون مثل:
```
mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

### 4. أنشئ Database User
1. في نفس صفحة Connect، اختر **"Create Database User"**
2. أدخل username و password
3. **احفظ هذه المعلومات!** ستحتاجها في Connection String

### 5. أضف IP Address
1. في صفحة Network Access
2. اضغط **"Add IP Address"**
3. اختر **"Add Current IP Address"** أو **"Allow Access from Anywhere"** (للاختبار فقط)

### 6. استبدل في Connection String
استبدل:
- `<username>` → اسم المستخدم الذي أنشأته
- `<password>` → كلمة المرور التي أنشأتها

مثال:
```
mongodb+srv://myuser:mypassword123@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

### 7. أضف اسم قاعدة البيانات
أضف اسم قاعدة البيانات في نهاية الـ connection string:

```
mongodb+srv://myuser:mypassword123@cluster0.xxxxx.mongodb.net/hospital_ops?retryWrites=true&w=majority
```

## تحديث ملف .env.local

افتح ملف `.env.local` وحدث `MONGO_URL`:

```env
MONGO_URL=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/hospital_ops?retryWrites=true&w=majority
```

**⚠️ مهم:** 
- لا ترفع ملف `.env.local` إلى Git
- استخدم كلمة مرور قوية للمستخدم
- في الإنتاج، استخدم IP Whitelist محددة

