-- AI Chats
create table public.ai_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  client_id uuid,
  case_id uuid,
  title text not null default 'محادثة جديدة',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ai_chats enable row level security;
create policy "ai_chats owner all" on public.ai_chats for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index ai_chats_user_idx on public.ai_chats(user_id, updated_at desc);

create trigger ai_chats_set_updated_at before update on public.ai_chats
for each row execute function public.set_updated_at();

-- AI Messages
create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.ai_chats(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.ai_messages enable row level security;
create policy "ai_messages owner all" on public.ai_messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index ai_messages_chat_idx on public.ai_messages(chat_id, created_at);

-- AI Prompt Templates
create table public.ai_prompt_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  title text not null,
  prompt text not null,
  category text,
  is_global boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.ai_prompt_templates enable row level security;
create policy "ai_templates read" on public.ai_prompt_templates for select using (is_global = true or auth.uid() = user_id);
create policy "ai_templates insert" on public.ai_prompt_templates for insert with check (auth.uid() = user_id);
create policy "ai_templates update" on public.ai_prompt_templates for update using (auth.uid() = user_id);
create policy "ai_templates delete" on public.ai_prompt_templates for delete using (auth.uid() = user_id);

-- Seed global Arabic legal templates
insert into public.ai_prompt_templates (user_id, title, prompt, category, is_global) values
(null, 'صياغة مذكرة قانونية', 'اصغ مذكرة قانونية احترافية باللغة العربية مع المقدمة والوقائع والأسانيد القانونية والطلبات بناءً على المعطيات التالية:\n\n', 'memo', true),
(null, 'تلخيص قضية', 'لخص القضية التالية في نقاط واضحة وموجزة باللغة العربية القانونية، مع إبراز الأطراف والوقائع الجوهرية والمطالبات:\n\n', 'summary', true),
(null, 'استخراج النقاط المهمة', 'استخرج النقاط القانونية المهمة من النص التالي في صورة قائمة مرقمة باللغة العربية:\n\n', 'extract', true),
(null, 'كتابة إنذار قانوني', 'اصغ إنذاراً قانونياً رسمياً باللغة العربية موجهاً من الطرف الأول إلى الطرف الثاني بناءً على البيانات التالية:\n\n', 'notice', true),
(null, 'إنشاء صحيفة دعوى', 'اصغ صحيفة دعوى قضائية باللغة العربية وفق الشكل القانوني المعتمد (المحكمة، أطراف الدعوى، الوقائع، الأسانيد، الطلبات) من المعطيات التالية:\n\n', 'lawsuit', true),
(null, 'اقتراح الإجراءات القادمة', 'بناءً على تفاصيل القضية التالية، اقترح الخطوات القانونية القادمة الموصى بها مرتبة حسب الأولوية مع تبرير قانوني مختصر لكل خطوة:\n\n', 'next_steps', true),
(null, 'إعادة صياغة احترافية', 'أعد صياغة النص التالي بأسلوب قانوني احترافي ورصين باللغة العربية الفصحى مع الحفاظ على المعنى:\n\n', 'rewrite', true);