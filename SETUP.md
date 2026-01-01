# Setup Instructions - Phase B1

## 1. Install Dependencies

```bash
npm install @supabase/supabase-js
```

## 2. Set up Supabase

1. Create a free account at https://supabase.com
2. Create a new project
3. Go to Project Settings → API
4. Copy your Project URL and anon/public key

## 3. Configure Environment Variables

Create `.env.local` file in the root directory:

```bash
cp .env.local.example .env.local
```

Then edit `.env.local` and add your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 4. Create Database Tables

1. Go to your Supabase project dashboard
2. Click "SQL Editor" in the left sidebar
3. Click "New query"
4. Copy and paste the contents of `supabase-schema.sql`
5. Click "Run" to execute the SQL

## 5. Create Storage Bucket

1. Go to Storage in your Supabase dashboard
2. Create a new public bucket called `slips`
3. Set the following policies:
   - Allow public read access
   - Allow public insert access (for MVP - refine later with auth)

## 6. Run Development Server

```bash
npm run dev
```

Your app should now be running at http://localhost:3000

## Notes

- The PromptPay number in checkout is hardcoded as `0812345678` - update it in `/app/order/checkout/page.tsx`
- Order numbers are generated in format: `YYMMDD-####` (e.g., `260101-1234`)
- Pickup times are available from 11:00 to 21:30 in 30-minute intervals
