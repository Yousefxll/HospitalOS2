# ✅ إصلاح حذف Policies من MongoDB

## المشكلة:
Policies ما زالت تظهر لأنها موجودة في **MongoDB** (النظام القديم)، وليس فقط في policy-engine.

## النظام الحالي:
- **Policy Engine**: `/api/policy-engine/policies` → لا يوجد policies ✅
- **MongoDB**: `policy_documents` collection → يحتوي على policies ❌

## الحل:

### حذف من MongoDB:
```javascript
// Connect to MongoDB
const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.MONGO_URL);
await client.connect();
const db = client.db(process.env.DB_NAME);

// Delete all policies
await db.collection('policy_documents').deleteMany({});
await db.collection('policy_chunks').deleteMany({});

console.log('All policies deleted from MongoDB');
```

## ملاحظة:
النظام الحالي يستخدم **policy-engine** كالمصدر الأساسي، لكن إذا كانت هناك policies في MongoDB، يجب حذفها أيضاً.
