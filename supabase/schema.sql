-- VTZ Rent-a-Car Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =====================
-- PROFILES (role management)
-- =====================
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  role text not null default 'agent' check (role in ('admin', 'agent')),
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create or replace function is_admin(user_id uuid default auth.uid())
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = user_id and role = 'admin'
  );
$$ language sql stable security definer set search_path = public;

create or replace function is_staff(user_id uuid default auth.uid())
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = user_id and role in ('admin', 'agent')
  );
$$ language sql stable security definer set search_path = public;

create or replace function enforce_profile_role_change()
returns trigger as $$
begin
  if new.role is distinct from old.role and not public.is_admin(auth.uid()) then
    raise exception 'Only admins can change profile roles';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger protect_profile_roles
  before update on profiles
  for each row execute function enforce_profile_role_change();

create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Admins can view all profiles" on profiles for select using (public.is_admin());
create policy "Users can update own profile" on profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "Admins can update profiles" on profiles for update using (public.is_admin()) with check (true);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', 'agent');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =====================
-- VEHICLES (fleet)
-- =====================
create table vehicles (
  id uuid default uuid_generate_v4() primary key,
  make text not null,
  model text not null,
  year integer not null,
  registration text not null unique,
  chassis_number text,
  color text,
  status text not null default 'free' check (status in ('free', 'rented', 'service', 'washing', 'inactive')),
  purchase_price numeric(12,2),
  purchase_date date,
  daily_rate numeric(10,2) not null default 0,
  registration_expiry date,
  next_service_km integer,
  current_km integer default 0,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table vehicles enable row level security;
create or replace function enforce_vehicle_staff_update()
returns trigger as $$
begin
  if not public.is_admin(auth.uid()) then
    if (to_jsonb(new) - 'status' - 'current_km' - 'persistent_damage' - 'updated_at')
       is distinct from
       (to_jsonb(old) - 'status' - 'current_km' - 'persistent_damage' - 'updated_at') then
      raise exception 'Agents can only update operational vehicle fields';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger protect_vehicle_staff_updates
  before update on vehicles
  for each row execute function enforce_vehicle_staff_update();

create policy "Staff can view vehicles" on vehicles for select using (public.is_staff());
create policy "Admins can manage vehicles" on vehicles for all using (public.is_admin()) with check (public.is_admin());
create policy "Staff can update operational vehicle fields" on vehicles for update using (public.is_staff()) with check (public.is_staff());

-- =====================
-- VEHICLE COSTS (maintenance, insurance, etc.)
-- =====================
create table vehicle_costs (
  id uuid default uuid_generate_v4() primary key,
  vehicle_id uuid references vehicles(id) on delete cascade not null,
  cost_type text not null check (cost_type in ('service', 'tyres', 'insurance_ao', 'insurance_kasko', 'other')),
  description text,
  amount numeric(10,2) not null,
  cost_date date not null default current_date,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

alter table vehicle_costs enable row level security;
create policy "Staff can view costs" on vehicle_costs for select using (public.is_staff());
create policy "Admins can manage costs" on vehicle_costs for all using (public.is_admin()) with check (public.is_admin());

-- =====================
-- CLIENTS
-- =====================
create table clients (
  id uuid default uuid_generate_v4() primary key,
  client_type text not null default 'individual' check (client_type in ('individual', 'company')),
  full_name text not null,
  company_name text,
  id_number text,
  drivers_license text,
  email text,
  phone text,
  address text,
  city text,
  is_blacklisted boolean default false,
  blacklist_reason text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table clients enable row level security;
create policy "Staff can view clients" on clients for select using (public.is_staff());
create policy "Staff can insert clients" on clients for insert with check (public.is_staff());
create policy "Staff can update clients" on clients for update using (public.is_staff()) with check (public.is_staff());
create policy "Admins can delete clients" on clients for delete using (public.is_admin());

-- =====================
-- SHORT-TERM RENTALS
-- =====================
create table rentals (
  id uuid default uuid_generate_v4() primary key,
  vehicle_id uuid references vehicles(id) not null,
  client_id uuid references clients(id) not null,
  start_date date not null,
  end_date date not null,
  pickup_km integer,
  return_km integer,
  fuel_level_out integer default 100, -- percentage
  fuel_level_in integer,
  daily_rate numeric(10,2) not null,
  total_days integer,
  total_amount numeric(10,2),
  deposit_amount numeric(10,2) default 0,
  deposit_returned boolean default false,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  damage_report_out jsonb, -- {areas: [{x, y, type, note}], notes: ''}
  damage_report_in jsonb,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table rentals enable row level security;
create policy "Staff can view rentals" on rentals for select using (public.is_staff());
create policy "Staff can insert rentals" on rentals for insert with check (public.is_staff());
create policy "Staff can update rentals" on rentals for update using (public.is_staff()) with check (public.is_staff());
create policy "Admins can delete rentals" on rentals for delete using (public.is_admin());

-- =====================
-- LEASING OFFERS (long-term / B2B)
-- =====================
create table leasing_offers (
  id uuid default uuid_generate_v4() primary key,
  client_id uuid references clients(id),
  vehicle_description text not null,
  -- Inputs
  vehicle_price numeric(12,2) not null,
  down_payment_pct numeric(5,4) not null default 0.15,
  annual_interest_rate numeric(5,4) not null default 0.07,
  period_months integer not null default 48,
  kasko_yearly numeric(10,2) default 0,
  ao_yearly numeric(10,2) default 0,
  tyres_total numeric(10,2) default 0,
  service_total numeric(10,2) default 0,
  admin_total numeric(10,2) default 0,
  margin_pct numeric(5,4) not null default 0.17,
  vat_pct numeric(5,4) not null default 0.17,
  residual_value numeric(12,2) default 0,
  -- Calculated outputs (stored for history)
  monthly_financing_rate numeric(10,2),
  total_cost numeric(12,2),
  monthly_cost numeric(10,2),
  margin_amount numeric(10,2),
  monthly_rent_no_vat numeric(10,2),
  monthly_rent_with_vat numeric(10,2),
  vtx_profit numeric(12,2),
  possible_profit numeric(12,2),
  -- Meta
  status text default 'draft' check (status in ('draft', 'sent', 'accepted', 'rejected')),
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

alter table leasing_offers enable row level security;
create policy "Admins only leasing" on leasing_offers for all using (public.is_admin()) with check (public.is_admin());

-- =====================
-- VIEWS
-- =====================

-- Dashboard stats
create or replace view dashboard_stats as
select
  count(*) filter (where status = 'free') as free_vehicles,
  count(*) filter (where status = 'rented') as rented_vehicles,
  count(*) filter (where status = 'service') as in_service,
  count(*) as total_vehicles,
  count(*) filter (where registration_expiry between current_date and current_date + interval '30 days') as expiring_registrations,
  count(*) filter (where registration_expiry < current_date) as expired_registrations
from vehicles
where status != 'inactive';

-- Today's activity
create or replace view todays_activity as
select
  r.id,
  'checkout' as activity_type,
  r.start_date as activity_date,
  v.make || ' ' || v.model as vehicle_name,
  v.registration,
  c.full_name as client_name
from rentals r
join vehicles v on r.vehicle_id = v.id
join clients c on r.client_id = c.id
where r.start_date = current_date and r.status = 'active'
union all
select
  r.id,
  'checkin' as activity_type,
  r.end_date as activity_date,
  v.make || ' ' || v.model as vehicle_name,
  v.registration,
  c.full_name as client_name
from rentals r
join vehicles v on r.vehicle_id = v.id
join clients c on r.client_id = c.id
where r.end_date = current_date and r.status = 'active';
