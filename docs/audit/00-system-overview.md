# System Overview

## Purpose

TENZAI Ordering System is a Thai restaurant pre-order platform that enables customers to:
1. Browse menu items via LINE LIFF (LINE Front-end Framework)
2. Place orders and upload payment slips
3. Receive order status notifications via LINE messaging

The system supports a complete order lifecycle: browse → order → pay → approve → prepare → pickup.

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
│                         NEXT.JS APP (Vercel)                                │
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
2. **Service-role DB access**: orders/order_items locked to service_role (RLS hardened)
3. **Cookie-based auth**: Session cookies for admin/staff/LIFF (no JWT)
4. **LINE notifications**: Flex messages for rich order cards
5. **Supabase Storage**: Slip images stored with signed URLs
