-- 1. Enable UUID extension
create extension if not exists "uuid-ossp";

-- 2. Create Borrowers Table
create table if not exists public.borrowers (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  phone text,
  address text,
  id_image_url text
);

-- FIX: Ensure the column exists even if the table was created previously without it.
alter table public.borrowers add column if not exists id_image_url text;

-- 3. Create Loans Table
create table if not exists public.loans (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  borrower_id uuid references public.borrowers(id) on delete cascade not null,
  principal numeric not null,
  interest_rate numeric not null,
  total_payable numeric not null,
  balance numeric not null,
  start_date timestamp with time zone default timezone('utc'::text, now()),
  due_date timestamp with time zone default timezone('utc'::text, now()),
  status text check (status in ('active', 'paid', 'defaulted')) default 'active'
);

-- UPDATE: Add Payment Frequency column
alter table public.loans add column if not exists payment_frequency text default 'daily';
-- UPDATE: Add Notes column
alter table public.loans add column if not exists notes text;

-- 4. Create Payments Table
create table if not exists public.payments (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  loan_id uuid references public.loans(id) on delete cascade not null,
  amount numeric not null,
  payment_date timestamp with time zone default timezone('utc'::text, now()),
  notes text
);

-- 5. Set up Storage Bucket for IDs
insert into storage.buckets (id, name, public)
values ('borrower-ids', 'borrower-ids', true)
on conflict (id) do nothing;

-- 6. Enable Row Level Security (RLS)
alter table public.borrowers enable row level security;
alter table public.loans enable row level security;
alter table public.payments enable row level security;

-- 7. Create Policies (Allow public access since no Auth is implemented yet)
-- Borrowers Policies
drop policy if exists "Enable all access for borrowers" on public.borrowers;
create policy "Enable all access for borrowers" on public.borrowers
for all using (true) with check (true);

-- Loans Policies
drop policy if exists "Enable all access for loans" on public.loans;
create policy "Enable all access for loans" on public.loans
for all using (true) with check (true);

-- Payments Policies
drop policy if exists "Enable all access for payments" on public.payments;
create policy "Enable all access for payments" on public.payments
for all using (true) with check (true);

-- Storage Policies
drop policy if exists "Give public access to borrower-ids" on storage.objects;
create policy "Give public access to borrower-ids" on storage.objects
for all using (bucket_id = 'borrower-ids') with check (bucket_id = 'borrower-ids');

-- 8. Force schema cache reload to ensure PostgREST sees the new column immediately
NOTIFY pgrst, 'reload config';