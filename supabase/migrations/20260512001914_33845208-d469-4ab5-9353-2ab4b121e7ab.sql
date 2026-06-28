
-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select using (auth.uid() = id);
create policy "own profile upsert" on public.profiles for insert with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);

-- Auto profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Updated_at helper
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- Clients
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  national_id text,
  phone text,
  address text,
  notes text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.clients(user_id);
create index on public.clients(full_name);
alter table public.clients enable row level security;
create policy "clients owner all" on public.clients for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger clients_updated before update on public.clients for each row execute function public.set_updated_at();

-- Cases
create table public.cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  case_number text not null,
  court_name text,
  opponent_name text,
  case_type text,
  status text not null default 'active',
  next_session_date timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.cases(user_id);
create index on public.cases(client_id);
alter table public.cases enable row level security;
create policy "cases owner all" on public.cases for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger cases_updated before update on public.cases for each row execute function public.set_updated_at();

-- Sessions
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  session_date timestamptz not null,
  location text,
  notes text,
  outcome text,
  created_at timestamptz not null default now()
);
create index on public.sessions(user_id);
create index on public.sessions(case_id);
create index on public.sessions(session_date);
alter table public.sessions enable row level security;
create policy "sessions owner all" on public.sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Payments
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  case_id uuid references public.cases(id) on delete set null,
  amount numeric(12,2) not null default 0,
  currency text not null default 'EGP',
  status text not null default 'pending', -- pending | paid
  due_date date,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
create index on public.payments(user_id);
alter table public.payments enable row level security;
create policy "payments owner all" on public.payments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Documents
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  case_id uuid references public.cases(id) on delete cascade,
  name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);
create index on public.documents(user_id);
alter table public.documents enable row level security;
create policy "documents owner all" on public.documents for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Storage bucket for documents (private)
insert into storage.buckets (id, name, public) values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "documents bucket select own" on storage.objects for select
  using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "documents bucket insert own" on storage.objects for insert
  with check (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "documents bucket delete own" on storage.objects for delete
  using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);
