# TENZAI SUSHI Ordering Web

Next.js (App Router) + TypeScript + Tailwind CSS ordering system for TENZAI SUSHI.

## Features

- **Mobile-first design** with loft-modern TENZAI theme
- **Three customer screens**:
  - `/order/menu` - Browse menu with category tabs
  - `/order/menu/[id]` - Item details with options
  - `/order/cart` - Shopping cart
- **In-memory cart state** using React Context
- **Floating cart button** showing item count

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Project Structure

```
tenzai-ordering-web/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx
│   └── order/
│       ├── layout.tsx
│       ├── menu/
│       │   ├── page.tsx
│       │   └── [id]/
│       │       └── page.tsx
│       ├── cart/
│       │   └── page.tsx
│       └── checkout/
│           └── page.tsx
├── components/
│   └── FloatingCartButton.tsx
├── contexts/
│   └── CartContext.tsx
├── data/
│   └── menu.json
└── public/
    └── images/
```

## Theme

- Background: White
- Text: #111111 (near-black)
- Primary: #F47B20 (orange)
- Mobile container: max-width 420px
- Rounded corners: 8-10px
- Min button height: 48px

## Future Integration

Ready for Supabase backend integration:
- User authentication (LIFF)
- Order management
- Real-time updates
- Payment processing