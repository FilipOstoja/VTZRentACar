# VTZ Rent-a-Car — Admin Dashboard

## Tech Stack
- **Frontend**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS
- **Auth**: Supabase Auth

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
Copy `.env.local.example` to `.env.local` and fill in your Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Run Supabase SQL schema
Go to your Supabase dashboard → SQL Editor and run the contents of `supabase/schema.sql`.

### 4. Start dev server
```bash
npm run dev
```

## Leasing Calculator Logic (from Excel)

**Inputs:**
- Cijena auta (vehicle price)
- Učešće % (down payment %)
- Kamata godišnja % (annual interest rate)
- Period u mjesecima (months)
- Kasko (yearly)
- AO Kasko (yearly)
- Gume ukupno (total tyres cost)
- Servis ukupno (total service cost)
- Administracija i neplanirano (admin/unexpected)
- Marža posto (margin %)
- PDV % (VAT)
- Vrijednost vozila nakon najma (residual value)

**Calculation:**
1. Leasing glavnica = Cijena - Učešće
2. Mjesečna rata = PMT(kamata/12, period, -glavnica)  [standard annuity formula]
3. Ukupno otplata = rata × period
4. Ukupna kamata = ukupno otplata - glavnica
5. Ukupno financiranje = cijena + ukupna kamata
6. Ukupno kasko = kasko × (period/12)
7. Ukupno AO = AO × (period/12)
8. Ukupan trošak = ukupno financiranje + kasko + AO + gume + servis + admin
9. Mjesečni trošak = ukupan trošak / period
10. Marža iznos = mjesečni trošak × marža posto
11. Najamnina = mjesečni trošak + marža iznos
12. Ukupno s PDV = najamnina × (1 + PDV)
13. VTZ Profit (najam) = (najamnina - rata) × period
14. Mogući profit = VTZ profit + vrijednost vozila
