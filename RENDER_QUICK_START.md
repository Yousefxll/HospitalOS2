# دليل النشر السريع على Render ⚡

## الخطوات الأساسية

### 1. إعداد Environment Variables في Render

```env
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
DB_NAME=hospital_ops
JWT_SECRET=your-super-secret-jwt-key
NEXT_PUBLIC_BASE_URL=https://your-app-name.onrender.com
CRON_SECRET=your-cron-secret (اختياري)
OPENAI_API_KEY=sk-... (اختياري)
```

### 2. Build & Start Commands

- **Build Command**: `yarn install && yarn build`
- **Start Command**: `yarn start`

### 3. بعد النشر - تهيئة قاعدة البيانات

```bash
curl -X POST https://your-app-name.onrender.com/api/init
```

---

📖 **للتفاصيل الكاملة**: راجع `RENDER_DEPLOYMENT.md`

