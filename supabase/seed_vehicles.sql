-- VTZ Rent-a-Car - Vehicle Seed Data
-- Source: vtz-car.com offers
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- After inserting, update the registration column with real plate numbers.

INSERT INTO vehicles (make, model, year, registration, color, status, daily_rate, notes)
VALUES
  (
    'Volkswagen', 'Golf 8', 2020,
    'UPDATE-PLATE-1',
    'Grey',
    'free',
    60.00,
    'Manual transmission | Air conditioning | Full insurance included'
  ),
  (
    'Volkswagen', 'Golf 8', 2022,
    'UPDATE-PLATE-2',
    'Black',
    'free',
    65.00,
    'Automatic transmission | Air conditioning | Full insurance included | Most popular'
  ),
  (
    'Volkswagen', 'Passat Estate', 2022,
    'UPDATE-PLATE-3',
    'Black',
    'free',
    70.00,
    'Automatic transmission | Large luggage space | Full insurance included'
  ),
  (
    'Volkswagen', 'Passat Sedan', 2022,
    'UPDATE-PLATE-4',
    'Black',
    'free',
    80.00,
    'Automatic transmission | Full equipment | Premium comfort | Full insurance included'
  ),
  (
    'Volkswagen', 'Crafter', 2017,
    'UPDATE-PLATE-5',
    'White',
    'free',
    100.00,
    'Commercial van | Large cargo capacity | Full insurance included'
  );

-- After running, update registration plates:
-- UPDATE vehicles SET registration = 'YOUR-REAL-PLATE' WHERE notes LIKE '%Golf 8%Manual%';
-- UPDATE vehicles SET registration = 'YOUR-REAL-PLATE' WHERE notes LIKE '%Most popular%';
-- UPDATE vehicles SET registration = 'YOUR-REAL-PLATE' WHERE notes LIKE '%Passat Estate%';
-- UPDATE vehicles SET registration = 'YOUR-REAL-PLATE' WHERE notes LIKE '%Passat Sedan%';
-- UPDATE vehicles SET registration = 'YOUR-REAL-PLATE' WHERE notes LIKE '%Commercial van%';
