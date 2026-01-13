# System Overview

## TL;DR
- **What**: Thai restaurant pre-order system via LINE LIFF
- **Flow**: Customer orders → uploads PromptPay slip → Admin approves → Staff fulfills → Customer picks up
- **Auth**: LIFF session (customer), admin/staff cookies
- **Data**: Supabase Postgres + Storage
- **Critical Path**: All orders/mutations server-side only (service_role), RLS locked

## When Confused → Do This
1. **Can't find where X happens?** → Check [01-api-surface-map.md](01-api-surface-map.md) for route/endpoint
2. **DB access pattern unclear?** → Check [02-supabase-usage-map.md](02-supabase-usage-map.md) for client usage
3. **Table schema question?** → Check [03-db-domain-map.md](03-db-domain-map.md)
4. **Order flow confused?** → See "Order Creation Flow" below or CLAUDE.md invariants
5. **Auth not working?** → Verify cookie (`tenzai_liff_user`, `tenzai_admin`, `tenzai_staff`)
6. **Migration issue?** → All DB changes require forward + rollback SQL
7. **"Who can do X?"** → See "Actors" table below
8. **Known issues?** → Check [04-cleanup-backlog.md](04-cleanup-backlog.md)

## Current Truth / Invariants
- **Order lifecycle**: `pending → approved → ready → picked_up` OR `pending → rejected` (NO shortcuts)
- **Approval authority**: Admin/Approver ONLY (never customer, never auto)
- **Payment proof**: Slip MUST exist BEFORE approval can happen
- **Mutations**: ALL writes to orders/order_items via service_role API routes (RLS=DENY)
- **VAT calc**: Authoritative decimal columns (`subtotal_amount_dec`, `vat_amount_dec`, `total_amount_dec`)
- **Customer access**: LINE LIFF ONLY (no guest ordering)
- **Deployment**: Pre-production (no live customers yet)
- **System NOT accepting orders**: Check `system_settings.order_accepting` key

## Purpose

TENZAI Ordering System is a Thai restaurant pre-order platform:
1. Browse menu via LINE LIFF
2. Place orders + upload PromptPay slips
3. Receive status notifications via LINE

Complete lifecycle: browse → order → pay → approve → prepare → pickup.

## Actors

| Actor | Access Method | Authentication | Capabilities |
|-------|--------------|----------------|--------------|
| **Customer** | LINE LIFF app | LIFF session (`tenzai_liff_user` cookie) | Browse menu, create orders, upload slips, view order status |
| **Admin/Approver** | Web browser `/admin/*` | Admin session (`tenzai_admin` cookie) | Approve/reject orders, manage menu, configure settings |
| **Staff** | Web browser `/staff/*` | Staff PIN (`tenzai_staff` cookie) | View approved orders, mark ready/picked-up |
| **LINE OA** | Webhooks | Channel access token | Receive notifications (slip, approval, ready) |
| **Public** | Direct URL | None | PromptPay QR endpoint |

## Entry Points

### Customer Entry
```
LINE App → LIFF URL → /liff (bootstrap) → /order/menu
```

### Admin Entry
```
Browser → /admin/login → /admin/orders (dashboard)
```

### Staff Entry
```
Browser → /staff/login → /staff (board)
```

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                    │
│   │  LINE App   │    │   Admin     │    │   Staff     │                    │
│   │  (Customer) │    │  (Browser)  │    │  (Browser)  │                    │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                    │
│          │                  │                  │                            │
│          │ LIFF             │ Session          │ PIN                        │
│          ▼                  ▼                  ▼                            │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NEXT.JS APP                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────┐      │
│   │                      APP ROUTER                                  │      │
│   ├─────────────┬─────────────┬─────────────┬─────────────┐         │      │
│   │  /order/*   │  /admin/*   │  /staff/*   │   /liff     │         │      │
│   │  (Customer) │   (Admin)   │   (Staff)   │ (Bootstrap) │         │      │
│   └──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┘         │      │
│          │             │             │             │                 │      │
│          ▼             ▼             ▼             ▼                 │      │
│   ┌─────────────────────────────────────────────────────────────────┐      │
│   │                      API ROUTES                                  │      │
│   │  /api/order/*  │  /api/admin/*  │  /api/staff/*  │  /api/liff/* │      │
│   │  /api/line/*   │  /api/public/* │                               │      │
│   └──────┬──────────────┬───────────────────────────────────────────┘      │
│          │              │                                                   │
│          │              │  ┌─────────────────────────────┐                 │
│          │              │  │        lib/line.ts          │                 │
│          │              │  │   (LINE Messaging API)      │                 │
│          │              │  └──────────────┬──────────────┘                 │
│          │              │                 │                                 │
└──────────┼──────────────┼─────────────────┼─────────────────────────────────┘
           │              │                 │
           ▼              ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL SERVICES                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────────────┐    ┌─────────────────────────┐               │
│   │       SUPABASE          │    │      LINE PLATFORM      │               │
│   ├─────────────────────────┤    ├─────────────────────────┤               │
│   │  ┌─────────────────┐    │    │  ┌─────────────────┐    │               │
│   │  │   PostgreSQL    │    │    │  │  Messaging API  │    │               │
│   │  │    Database     │    │    │  │  (Push/Flex)    │    │               │
│   │  └─────────────────┘    │    │  └─────────────────┘    │               │
│   │  ┌─────────────────┐    │    │  ┌─────────────────┐    │               │
│   │  │    Storage      │    │    │  │      LIFF       │    │               │
│   │  │  (Slip images)  │    │    │  │  (Frontend SDK) │    │               │
│   │  └─────────────────┘    │    │  └─────────────────┘    │               │
│   └─────────────────────────┘    └─────────────────────────┘               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow Summary

### Order Creation Flow
```
Customer (LIFF) → /api/order/create → orders + order_items tables
                                    → Response with order_number
```

### Payment Flow
```
Customer → /api/order/[id]/slip → Upload to Supabase Storage
                                → Update orders.slip_url
                                → /api/line/notify-slip → LINE to Approver
```

### Approval Flow
```
Admin → /api/admin/approve-order → Update orders.status
                                 → LINE to Staff (prepare)
                                 → LINE to Customer (confirmed)
```

### Fulfillment Flow
```
Staff → /api/staff/orders/update-status → Update orders.status
                                        → LINE to Customer (ready/picked_up)
```

## Key Technical Decisions

1. **LIFF-only customer access**: No guest ordering; requires LINE login
2. **Service-role DB access**: orders/order_items locked to service-role (RLS hardened)
3. **Cookie-based auth**: Session cookies for admin/staff/LIFF (no JWT)
4. **LINE notifications**: Flex messages for rich order cards
5. **Supabase Storage**: Slip images stored with signed URLs

---

## Glossary

| Term | Meaning |
|------|---------|
| **LIFF** | LINE Front-end Framework (customer web app inside LINE) |
| **RLS** | Row Level Security (Postgres access control) |
| **service-role** | Supabase admin client (bypasses RLS) |
| **anon client** | Supabase public client (subject to RLS) |
| **Slip** | PromptPay payment proof image |
| **CSRF** | Cross-Site Request Forgery protection |
