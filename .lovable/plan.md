# خطة التطوير الشاملة — نظام المستشار محسن عياده

طلبك كبير جدًا ويلامس كل أجزاء النظام (قاعدة البيانات، الواجهات، الذكاء الاصطناعي، البريد، OCR، التقارير). عشان نحافظ على الجودة ونتجنب كسر أي حاجة شغّالة، هقسّمها لأربع مراحل قابلة للتنفيذ والمراجعة.

---

## المرحلة 1 — قاعدة البيانات والـ Workflows الأساسية (الأهم)

**تعديلات Supabase (migration واحدة):**

- `clients`: إضافة `email`, `poa_number`, `poa_year`, `poa_letter`, `poa_type` (عام/خاص), `poa_file_path`
- `cases`: إضافة `case_year` (int), `case_category` (enum: جنائي/أسرة/مدني/عسكرية/اقتصادية/مجلس دولة/إدارية عليا), `court_location`. توليد `case_number_display` كـ generated column أو في الـ UI.
- `payments`: إضافة `total_amount`, `paid_amount` (computed من installments)؛ جدول جديد `payment_installments` (amount, paid_at, notes, payment_id).
- جدول جديد `case_activities` للـ Activity Timeline (موجود الـ component بس مفيش جدول حقيقي).
- `documents`: إضافة `ocr_text` (text, nullable) لدعم البحث.
- Storage bucket جديد `case-documents` مع RLS سياسات (owner only).
- تحديث حالات `cases.status`: القيم تبقى `active|closed|pending` بس الـ labels في الـ UI تتغير لـ "متداولة/منتهية".

**Workflows:**

- بعد إضافة موكل → فتح modal "قضية جديدة" تلقائيًا مع `client_id` معبّى.
- نموذج موكل جديد بالحقول الجديدة + رفع ملف التوكيل.
- نموذج قضية جديدة بـ dropdowns للنوع + حقول رقم/سنة/مركز منفصلة وعرض القضية بصيغة `245 / 2025 / مدني / الإسماعيلية`.

**UI fixes:**

- Status badges بألوان جديدة (أخضر = منتهية، أصفر = متداولة، أحمر = جلسة قريبة خلال 3 أيام).
- التأكد إن كل الكروت (clients/cases) قابلة للضغط بالكامل (موجود بس هنراجعه).

---

## المرحلة 2 — المستندات والمدفوعات

**المستندات داخل صفحة القضية:**

- Drag & drop upload (PDF/صور) لـ Supabase Storage.
- قائمة الملفات مع preview (للصور) و download.
- ربط بكل قضية عبر `documents.case_id`.

**المدفوعات:**

- صفحة دفعة جديدة: إجمالي الأتعاب + تسجيل دفعات جزئية متعددة.
- عرض: المدفوع، المتبقي، نسبة السداد.
- حالة تلقائية: paid لو متبقي=0، partial لو فيه دفعات، pending لو ولا دفعة.

---

## المرحلة 3 — OCR + الإيميل + المساعد الذكي

**OCR:**

- استخدام Tesseract.js (شغّال في المتصفح، عربي + إنجليزي) لاستخراج النص بعد رفع الصورة.
- حفظ النص في `documents.ocr_text` وإتاحة البحث داخله.

**Email Notifications:**

- استخدام Lovable Emails (مدمج، مجاني، بدون مفاتيح خارجية).
- عند إنشاء/تعديل جلسة → enqueue email للموكل (لو عنده إيميل) بتفاصيل الجلسة والمحامي.
- يتطلب إعداد domain للإيميل (هطلب منك تعمله من واجهة الإعداد).

**AI Assistant Upgrade:**

- توسيع الـ system prompt بسياق قانوني مصري مفصّل (قانون المحاماة، الإجراءات، الصيغ).
- 4 quick prompts: صياغة مذكرة / تلخيص قضية / كتابة إنذار / إنشاء صحيفة دعوى.
- ربط المحادثة بقضية محددة لتغذية الـ context.

---

## المرحلة 4 — التقارير و UI Polish

- صفحة "تقرير الجلسات المستقبلية" مع فلتر تاريخ + طباعة + Export PDF/Excel.
- تحسينات تايبوغرافيا (Cairo weights) + sticky quick actions على الموبايل.
- مراجعة أداء (lazy loading للصفحات الثقيلة).

---

## التفاصيل التقنية (للمراجعة)

```text
Tables changes:
  clients      + email, poa_number, poa_year, poa_letter, poa_type, poa_file_path
  cases        + case_year (int), case_category (text), court_location (text)
  payments     + total_amount (numeric)
  + payment_installments (id, payment_id, amount, paid_at, notes, user_id)
  + case_activities (id, case_id, user_id, type, description, metadata jsonb, created_at)
  documents    + ocr_text (text)
  storage: bucket "case-documents" (private, RLS by user_id prefix)

Libraries to add:
  tesseract.js          → OCR في المتصفح
  react-dropzone        → drag & drop رفع ملفات
  (xlsx + print موجودين بالفعل)

Email infra:
  Lovable Emails (auth + transactional queue) — يحتاج تفعيل domain
```

---

## أسئلة سريعة قبل ما أبدأ

1. **OCR**: تمام أستخدم Tesseract.js في المتصفح؟ (مجاني، بدون API key، شوية أبطأ من الـ cloud لكن خصوصية كاملة).
2. **Email**: تمام أستخدم Lovable Emails؟ هتحتاج تعمل setup لـ domain للإرسال (هرشّحلك الزرار في وقته).
3. **ترتيب التنفيذ**: نبدأ بالمرحلة 1 (الأهم — DB + workflows + status fixes) في هذه الـ run، ولا تفضّل ترتيب مختلف؟

لو موافق على الخطة، رد بـ "ابدأ" أو حدد المرحلة اللي عايز نبدأ بيها وهبدأ على طول.
