# ✅ إصلاح مشكلة البحث - تحويل من MongoDB إلى policy-engine

## المشكلة:
- `/api/policies/search` كان يستخدم MongoDB collections (`policy_documents`, `policy_chunks`)
- لكن النظام الحالي يستخدم `policy-engine` مع ChromaDB
- البحث كان يفشل لأن MongoDB collections فارغة

## الحل:
✅ تم تحويل `/api/policies/search` لاستخدام `policy-engine`:
- يرسل الطلب إلى `policy-engine` `/v1/search`
- يحول النتائج من format `policy-engine` إلى format المتوقع من frontend
- يجمع النتائج حسب `policyId` ويعرض `matches` لكل policy

## التحويلات:
1. **Request**: `{ q, limit }` → `{ tenantId, query, topK }`
2. **Response**: `{ results: [{ policyId, filename, pageNumber, lineStart, lineEnd, snippet, score }] }` → `{ results: [{ documentId, title, matches: [...] }] }`

## الآن:
- ✅ البحث يعمل مع `policy-engine`
- ✅ النتائج تظهر بشكل صحيح
- ✅ يمكن البحث عن policies الموجودة في ChromaDB

## الخطوات التالية للمستخدم:
1. اذهب إلى `/ai/policy-assistant`
2. ابحث عن "patient" أو أي كلمة أخرى
3. يجب أن تظهر النتائج الآن ✅

