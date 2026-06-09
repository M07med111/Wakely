# Mizan Legal Office

نظام إدارة مكتب محاماة مبني بـ React وTanStack Start وVite وSupabase، مع واجهة عربية RTL ومساعد قانوني ذكي.

## المتطلبات

- Node.js `>=22.12.0`
- npm
- مشروع Supabase مهيأ بملفات `supabase/migrations`

> ملاحظة: قد تعمل بعض أوامر التطوير على Node 20، لكن حزم TanStack Start وCloudflare/Wrangler الحديثة تتطلب Node 22+ للإنتاج.

## التشغيل المحلي

1. انسخ `.env.example` إلى `.env`.
2. املأ مفاتيح Supabase ومزود الذكاء الاصطناعي المتوافق مع Chat Completions.
3. ثبت الحزم:

```bash
npm install --no-audit --no-fund
```

4. شغل التطبيق:

```bash
npm run dev
```

## الفحص

```bash
npm run lint
npm run test
npm run typecheck
npm run build
```

أو شغل الفحص المجمع:

```bash
npm run check
```

## متغيرات البيئة

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AI_API_KEY`
- `AI_API_BASE_URL`
- `AI_MODEL`
- `ALLOWED_ORIGINS`

`ALLOWED_ORIGINS` قائمة origins مفصولة بفواصل لاستخدام CORS في Edge Function:

```env
ALLOWED_ORIGINS=https://your-domain.com,http://localhost:8080,http://127.0.0.1:8080
```

## حدود الملفات

رفع مستندات القضايا يقبل:

- PDF أو صور فقط
- 5 ملفات كحد أقصى في العملية الواحدة
- 10MB كحد أقصى لكل ملف

## ملاحظات إنتاج

- لا ترفع `.env` إلى git؛ الملف متجاهل ومزال من التتبع.
- اعتمد `package-lock.json` مع npm لتثبيت قابل للتكرار.
- اضبط `ALLOWED_ORIGINS` على دومينات الإنتاج قبل نشر `supabase/functions/ai-chat`.
- شغل `npm run check` قبل النشر.
- حزم Excel وOCR والمساعد الذكي يتم تحميلها عند الحاجة لتقليل حجم التحميل الأولي.
