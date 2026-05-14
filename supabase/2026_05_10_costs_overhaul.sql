-- ============================================================
-- VTZ Rent-a-Car — Costs Overhaul Migration
-- Run this in the Supabase SQL Editor
--
-- Adds:
--   1. image_url on vehicle_expenses (receipt photos)
--   2. global_expenses parent table (for fleet-wide costs like advertising)
--   3. global_expense_id FK on vehicle_expenses (links split rows back to parent)
--   4. receipts storage bucket + RLS policies
-- ============================================================

-- 1. Receipt photo on existing per-vehicle expenses
alter table public.vehicle_expenses
  add column if not exists image_url text;

-- 2. Parent table for global expenses (snapshot at split time)
create table if not exists public.global_expenses (
  id              uuid primary key default gen_random_uuid(),
  description     text not null,
  total_amount    numeric(10,2) not null,
  type            text not null check (type in ('fuel','maintenance','insurance','washing','tyre','other')),
  vendor          text,
  date            date not null default current_date,
  image_url       text,
  vehicle_count   integer not null,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now()
);

alter table public.global_expenses enable row level security;

do $$
begin
  execute 'drop policy if exists "Allow all for authenticated" on public.global_expenses';
  if not exists (
    select 1 from pg_policies
    where tablename = 'global_expenses'
      and policyname = 'Staff can manage global expenses'
  ) then
    execute 'create policy "Staff can manage global expenses"
      on public.global_expenses
      for all
      using (public.is_staff())
      with check (public.is_staff())';
  end if;
end $$;

-- 3. Link from each child vehicle_expenses row back to its parent global_expenses row
alter table public.vehicle_expenses
  add column if not exists global_expense_id uuid references public.global_expenses(id) on delete cascade;

create index if not exists idx_vehicle_expenses_global_id
  on public.vehicle_expenses(global_expense_id);

create index if not exists idx_vehicle_expenses_vehicle_date
  on public.vehicle_expenses(vehicle_id, date desc);

-- 4. Storage bucket for receipt photos
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

do $$
begin
  execute 'drop policy if exists "auth_users_upload_receipts" on storage.objects';
  execute 'drop policy if exists "auth_users_read_receipts" on storage.objects';
  execute 'drop policy if exists "auth_users_delete_receipts" on storage.objects';

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'auth_users_upload_receipts'
  ) then
    execute 'create policy "auth_users_upload_receipts"
      on storage.objects for insert to authenticated
      with check (
        bucket_id = ''receipts''
        and (storage.foldername(name))[1] = auth.uid()::text
      )';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'auth_users_read_receipts'
  ) then
    execute 'create policy "auth_users_read_receipts"
      on storage.objects for select to authenticated
      using (
        bucket_id = ''receipts''
        and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
      )';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'auth_users_delete_receipts'
  ) then
    execute 'create policy "auth_users_delete_receipts"
      on storage.objects for delete to authenticated
      using (
        bucket_id = ''receipts''
        and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
      )';
  end if;
end $$;
