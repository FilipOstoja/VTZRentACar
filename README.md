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


