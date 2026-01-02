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

-- Canonical Menu Data Tables (Phase 4.5)

-- Categories table
CREATE TABLE categories (
  category_code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Menu items table
CREATE TABLE menu_items (
  menu_code TEXT PRIMARY KEY,
  category_code TEXT NOT NULL REFERENCES categories(category_code) ON DELETE RESTRICT,
  name_th TEXT NOT NULL,
  name_en TEXT,
  barcode TEXT,
  description TEXT,
  price INTEGER NOT NULL,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Option groups table
CREATE TABLE option_groups (
  group_code TEXT PRIMARY KEY,
  group_name TEXT NOT NULL,
  is_required BOOLEAN DEFAULT false,
  max_select INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Options table
CREATE TABLE options (
  option_code TEXT PRIMARY KEY,
  group_code TEXT NOT NULL REFERENCES option_groups(group_code) ON DELETE CASCADE,
  option_name TEXT NOT NULL,
  price_delta INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Menu-to-option-groups mapping table
CREATE TABLE menu_option_groups (
  menu_code TEXT NOT NULL REFERENCES menu_items(menu_code) ON DELETE CASCADE,
  group_code TEXT NOT NULL REFERENCES option_groups(group_code) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (menu_code, group_code)
);

-- Indexes
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_system_settings_key ON system_settings(key);
CREATE INDEX idx_menu_items_category_code ON menu_items(category_code);
CREATE INDEX idx_menu_items_is_active ON menu_items(is_active);
CREATE INDEX idx_options_group_code ON options(group_code);
CREATE INDEX idx_options_sort_order ON options(sort_order);
CREATE INDEX idx_menu_option_groups_menu_code ON menu_option_groups(menu_code);
CREATE INDEX idx_menu_option_groups_group_code ON menu_option_groups(group_code);

-- Enable Row Level Security (RLS)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE option_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE options ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_option_groups ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Allow all for MVP - refine later with user auth)
CREATE POLICY "Allow all operations on orders" ON orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on order_items" ON order_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on system_settings" ON system_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on categories" ON categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on menu_items" ON menu_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on option_groups" ON option_groups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on options" ON options FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on menu_option_groups" ON menu_option_groups FOR ALL USING (true) WITH CHECK (true);
