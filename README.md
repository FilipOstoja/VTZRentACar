# VTZ Rent-a-Car — Admin Dashboard

## Tech Stack
- **Frontend**: Next.js 16 (App Router)
- **Database**: Supabase (PostgreSQL) — schema/migrations managed in the Supabase Dashboard
- **3D**: react-three-fiber 9 + drei 10 + three.js
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

### 3. Start dev server
```bash
npm run dev
```
