-- ============================================================
-- VTZ — Cleanup old vehicles + re-seed correct fleet
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Step 1: delete everything that references vehicles (cascade order)
delete from public.vehicle_expenses;
delete from public.rentals;
delete from public.vehicles;

-- Step 2: insert the correct VTZ fleet
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
   'Komercijalno vozilo, veliki teret, bez depozita');
