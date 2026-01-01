-- TENZAI Ordering System - Database Schema
-- Run this in your Supabase SQL Editor

-- Orders table
CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_note TEXT,
  pickup_type TEXT NOT NULL CHECK (pickup_type IN ('ASAP', 'SCHEDULED')),
  pickup_time TIMESTAMPTZ,
  total_amount INTEGER NOT NULL,
  slip_url TEXT,
  slip_notified_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejected_reason TEXT,
  staff_notified_at TIMESTAMPTZ,
  adjustment_note TEXT,
  adjusted_at TIMESTAMPTZ,
  adjusted_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order items table
CREATE TABLE order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id TEXT NOT NULL,
  name_th TEXT NOT NULL,
  name_en TEXT NOT NULL,
  qty INTEGER NOT NULL,
  base_price INTEGER NOT NULL,
  final_price INTEGER NOT NULL,
  note TEXT,
  selected_options_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- System settings table
CREATE TABLE system_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default order_accepting setting
INSERT INTO system_settings (key, value)
VALUES ('order_accepting', '{"enabled": true, "message": ""}');

-- Indexes
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_system_settings_key ON system_settings(key);

-- Enable Row Level Security (RLS)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Allow all for MVP - refine later with user auth)
CREATE POLICY "Allow all operations on orders" ON orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on order_items" ON order_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on system_settings" ON system_settings FOR ALL USING (true) WITH CHECK (true);
