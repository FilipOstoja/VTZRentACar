-- ============================================================
-- VTZ Rent-a-Car — Seed / Dummy Data
-- Run this in the Supabase SQL Editor
-- ============================================================

-- ── 1. vehicle_expenses table ────────────────────────────────

create table if not exists public.vehicle_expenses (
  id            uuid primary key default gen_random_uuid(),
  vehicle_id    uuid not null references public.vehicles(id) on delete cascade,
  date          date not null,
  type          text not null check (type in ('fuel','maintenance','insurance','washing','tyre','other')),
  description   text,
  vendor        text,
  amount        numeric(10,2) not null default 0,
  created_at    timestamptz not null default now()
);

alter table public.vehicle_expenses enable row level security;

do $$
begin
  execute 'drop policy if exists "Allow all for authenticated" on public.vehicle_expenses';
  if not exists (
    select 1 from pg_policies
    where tablename = 'vehicle_expenses'
      and policyname = 'Staff can manage vehicle expenses'
  ) then
    execute 'create policy "Staff can manage vehicle expenses"
      on public.vehicle_expenses
      for all
      using (public.is_staff())
      with check (public.is_staff())';
  end if;
end $$;

-- ── 2. Clients ───────────────────────────────────────────────

insert into public.clients
  (id, client_type, full_name, company_name, id_number, email, phone, city, is_blacklisted, notes)
values
  ('c1000000-0000-0000-0000-000000000001', 'individual', 'Marko Petrović',    null,                  'BA12345678', 'marko.petrovic@email.com',   '+387 61 111 222', 'Mostar',     false, null),
  ('c1000000-0000-0000-0000-000000000002', 'individual', 'Ana Kovačević',     null,                  'BA87654321', 'ana.kovacevic@email.com',    '+387 62 333 444', 'Mostar',     false, null),
  ('c1000000-0000-0000-0000-000000000003', 'company',    'Ivan Marić',        'Marić Trade d.o.o.',  'BA11223344', 'ivan.maric@marictrade.ba',   '+387 63 555 666', 'Sarajevo',   false, 'Redovni poslovni klijent, plaća na fakturu'),
  ('c1000000-0000-0000-0000-000000000004', 'individual', 'Lejla Hadžić',      null,                  'BA55667788', 'lejla.hadzic@gmail.com',     '+387 61 777 888', 'Međugorje',  false, null),
  ('c1000000-0000-0000-0000-000000000005', 'company',    'Sead Begović',      'Begović & Co',        'BA99001122', 'sead@begovicco.ba',           '+387 65 999 000', 'Čapljina',   false, null),
  ('c1000000-0000-0000-0000-000000000006', 'individual', 'Mirela Šišić',      null,                  'BA33445566', 'mirela.sisic@hotmail.com',   '+387 66 123 456', 'Mostar',     false, null),
  ('c1000000-0000-0000-0000-000000000007', 'individual', 'Dejan Tomić',       null,                  'BA77889900', 'dejan.tomic@yahoo.com',      '+387 61 234 567', 'Mostar',     true,  'Kasni s plaćanjem, vozilo vraćeno s ogrebotinom'),
  ('c1000000-0000-0000-0000-000000000008', 'company',    'Nermina Oručević',  'Oruc Logistics',      'BA22334455', 'nermina@oruclogistics.com',  '+387 63 345 678', 'Sarajevo',   false, 'Plaća unaprijed, preporučen klijent')
on conflict (id) do nothing;

-- ── 3. Vehicles — VTZ stvarna flota ──────────────────────────
--
--   a01  VW Golf 8      Manual     2020  €60/dan
--   a02  VW Golf 8      Automatic  2022  €65/dan
--   a03  VW Passat      Estate     2022  €70/dan
--   a04  VW Passat      Sedan      2022  €80/dan
--   a05  VW Crafter     Van        2017  €100/dan

insert into public.vehicles
  (id, make, model, year, registration, chassis_number, color, status, purchase_price, daily_rate, registration_expiry, current_km, notes)
values
  ('a1000000-0000-0000-0000-000000000001',
   'Volkswagen', 'Golf 8', 2020,
   'M17-O-001', 'WVWZZZAUZMW100001',
   'Bijela', 'rented',
   18500, 60, '2026-02-14', 74300,
   'Manualni mjenjač, full kasko, bez depozita'),

  ('a1000000-0000-0000-0000-000000000002',
   'Volkswagen', 'Golf 8', 2022,
   'M17-O-002', 'WVWZZZAUZNW200002',
   'Siva', 'rented',
   22000, 65, '2026-05-20', 38900,
   'Automatski mjenjač, full kasko, bez depozita'),

  ('a1000000-0000-0000-0000-000000000003',
   'Volkswagen', 'Passat Estate', 2022,
   'M17-O-003', 'WVWZZZ3CZNW300003',
   'Crna', 'rented',
   26000, 70, '2025-11-08', 52100,
   'Automatik, veliki prtljažnik, full oprema'),

  ('a1000000-0000-0000-0000-000000000004',
   'Volkswagen', 'Passat Sedan', 2022,
   'M17-O-004', 'WVWZZZ3CZNW400004',
   'Srebrna', 'service',
   27500, 80, '2025-06-30', 61400,
   'Full oprema, automatik, premium udobnost — na servisu'),

  ('a1000000-0000-0000-0000-000000000005',
   'Volkswagen', 'Crafter', 2017,
   'M17-O-005', 'WV1ZZZ2EZH0500005',
   'Bijela', 'free',
   38000, 100, '2025-07-15', 189200,
   'Komercijalno vozilo, veliki teret, bez depozita')
on conflict (id) do nothing;

-- ── 4. Rentals ───────────────────────────────────────────────
-- Columns: id, vehicle_id, client_id, start_date, end_date,
--          pickup_km, daily_rate, total_days, total_amount,
--          deposit_amount, status

insert into public.rentals
  (id, vehicle_id, client_id, start_date, end_date,
   pickup_km, daily_rate, total_days, total_amount, deposit_amount, status)
values

  -- ACTIVE: Golf 8 Manual — Marko Petrović
  ('b0100000-0000-0000-0000-000000000001',
   'a1000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000001',
   current_date - 2, current_date + 5,
   74100, 60, 7, 420, 0, 'active'),

  -- ACTIVE: Passat Estate — Ivan Marić d.o.o.
  ('b0100000-0000-0000-0000-000000000002',
   'a1000000-0000-0000-0000-000000000003',
   'c1000000-0000-0000-0000-000000000003',
   current_date - 1, current_date + 7,
   51900, 70, 8, 560, 0, 'active'),

  -- ACTIVE: Golf 8 Automatic — Lejla Hadžić (starts today)
  ('b0100000-0000-0000-0000-000000000003',
   'a1000000-0000-0000-0000-000000000002',
   'c1000000-0000-0000-0000-000000000004',
   current_date, current_date + 6,
   38900, 65, 6, 390, 0, 'active'),

  -- COMPLETED: Golf 8 Automatic — Ana Kovačević
  ('b0100000-0000-0000-0000-000000000004',
   'a1000000-0000-0000-0000-000000000002',
   'c1000000-0000-0000-0000-000000000002',
   current_date - 20, current_date - 14,
   38500, 65, 6, 390, 0, 'completed'),

  -- COMPLETED: Passat Sedan — Nermina Oručević
  ('b0100000-0000-0000-0000-000000000005',
   'a1000000-0000-0000-0000-000000000004',
   'c1000000-0000-0000-0000-000000000008',
   current_date - 30, current_date - 25,
   61000, 80, 5, 400, 0, 'completed'),

  -- COMPLETED: Passat Estate — Marko Petrović
  ('b0100000-0000-0000-0000-000000000006',
   'a1000000-0000-0000-0000-000000000003',
   'c1000000-0000-0000-0000-000000000001',
   current_date - 45, current_date - 38,
   51400, 70, 7, 490, 0, 'completed'),

  -- COMPLETED: Crafter — Sead Begović d.o.o.
  ('b0100000-0000-0000-0000-000000000007',
   'a1000000-0000-0000-0000-000000000005',
   'c1000000-0000-0000-0000-000000000005',
   current_date - 15, current_date - 12,
   189000, 100, 3, 300, 0, 'completed'),

  -- COMPLETED: Golf 8 Manual — Mirela Šišić
  ('b0100000-0000-0000-0000-000000000008',
   'a1000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000006',
   current_date - 10, current_date - 7,
   73900, 60, 3, 180, 0, 'completed'),

  -- CANCELLED: Crafter — Dejan Tomić (blacklisted)
  ('b0100000-0000-0000-0000-000000000009',
   'a1000000-0000-0000-0000-000000000005',
   'c1000000-0000-0000-0000-000000000007',
   current_date - 5, current_date - 2,
   null, 100, 3, 300, 0, 'cancelled')
on conflict (id) do nothing;

-- ── 5. Vehicle expenses ──────────────────────────────────────

insert into public.vehicle_expenses
  (vehicle_id, date, type, description, vendor, amount)
values

  -- Golf 8 Manual (a01)
  ('a1000000-0000-0000-0000-000000000001', current_date - 90,  'insurance',   'Kasko osiguranje 2025',              'Euroherc Mostar',        980.00),
  ('a1000000-0000-0000-0000-000000000001', current_date - 90,  'insurance',   'AO osiguranje 2025',                 'Euroherc Mostar',        320.00),
  ('a1000000-0000-0000-0000-000000000001', current_date - 60,  'maintenance', 'Servis 70.000 km — ulje i filteri',  'VW Auto BH Mostar',      180.00),
  ('a1000000-0000-0000-0000-000000000001', current_date - 30,  'tyre',        'Ljetne gume 205/55 R16 set 4 kom',   'Guma Centar Mostar',     480.00),
  ('a1000000-0000-0000-0000-000000000001', current_date - 10,  'washing',     'Pranje i čišćenje unutrašnjosti',    'Car Wash Mostar',         35.00),
  ('a1000000-0000-0000-0000-000000000001', current_date - 3,   'fuel',        'Gorivo pred isporuku klijentu',      'NIS Petrol Mostar',       58.00),

  -- Golf 8 Automatic (a02)
  ('a1000000-0000-0000-0000-000000000002', current_date - 88,  'insurance',   'Kasko osiguranje 2025',              'Triglav Osiguranje',    1050.00),
  ('a1000000-0000-0000-0000-000000000002', current_date - 88,  'insurance',   'AO osiguranje 2025',                 'Triglav Osiguranje',     340.00),
  ('a1000000-0000-0000-0000-000000000002', current_date - 45,  'maintenance', 'Zamjena ulja, filtera zraka i goriva','VW Auto BH Mostar',     195.00),
  ('a1000000-0000-0000-0000-000000000002', current_date - 15,  'washing',     'Detalj čišćenje + poliranje laka',   'Premium Wash Mostar',     65.00),
  ('a1000000-0000-0000-0000-000000000002', current_date - 2,   'fuel',        'Gorivo',                             'Shell Mostar',            62.00),

  -- Passat Estate (a03)
  ('a1000000-0000-0000-0000-000000000003', current_date - 92,  'insurance',   'Kasko osiguranje 2025',              'Bosna Sunce',           1120.00),
  ('a1000000-0000-0000-0000-000000000003', current_date - 92,  'insurance',   'AO osiguranje 2025',                 'Bosna Sunce',            380.00),
  ('a1000000-0000-0000-0000-000000000003', current_date - 55,  'maintenance', 'Redovni servis 50.000 km',           'VW Auto BH Mostar',      210.00),
  ('a1000000-0000-0000-0000-000000000003', current_date - 20,  'tyre',        'Zimske gume 215/60 R16 4 kom',       'Michelin Mostar',        520.00),
  ('a1000000-0000-0000-0000-000000000003', current_date - 5,   'washing',     'Pranje eksterijera i interijera',    'Car Wash Mostar',         40.00),

  -- Passat Sedan (a04)
  ('a1000000-0000-0000-0000-000000000004', current_date - 95,  'insurance',   'Kasko osiguranje 2025',              'Generali BH',           1200.00),
  ('a1000000-0000-0000-0000-000000000004', current_date - 95,  'insurance',   'AO osiguranje 2025',                 'Generali BH',            400.00),
  ('a1000000-0000-0000-0000-000000000004', current_date - 14,  'maintenance', 'Zamjena remena razvoda + voda pumpa','VW Auto BH Mostar',      750.00),
  ('a1000000-0000-0000-0000-000000000004', current_date - 7,   'maintenance', 'Dijagnoza računara, reset grešaka',  'Auto Elektrika Mostar',  120.00),
  ('a1000000-0000-0000-0000-000000000004', current_date - 1,   'washing',     'Poliranje karoserije + voskiranje',  'Premium Wash Mostar',     80.00),

  -- Crafter (a05)
  ('a1000000-0000-0000-0000-000000000005', current_date - 100, 'insurance',   'Kasko osiguranje 2025 — kombaj',     'Euroherc Mostar',       1650.00),
  ('a1000000-0000-0000-0000-000000000005', current_date - 100, 'insurance',   'AO osiguranje 2025',                 'Euroherc Mostar',        580.00),
  ('a1000000-0000-0000-0000-000000000005', current_date - 70,  'maintenance', 'Servis 185.000 km — komplet',        'VW Komercijalni Servis',  890.00),
  ('a1000000-0000-0000-0000-000000000005', current_date - 40,  'tyre',        'Ljetne gume 235/65 R16C 4 kom',      'Guma Centar Mostar',     760.00),
  ('a1000000-0000-0000-0000-000000000005', current_date - 10,  'other',       'Zamjena žarulja i osigurača',        'Auto Dijelovi Mostar',    45.00),
  ('a1000000-0000-0000-0000-000000000005', current_date - 3,   'fuel',        'Dizel pred isporuku',                'NIS Petrol Mostar',       95.00);
