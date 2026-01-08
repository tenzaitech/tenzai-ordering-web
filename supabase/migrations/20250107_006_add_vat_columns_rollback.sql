-- Rollback: Remove VAT and invoice columns from orders table

-- Remove constraint first
ALTER TABLE orders
DROP CONSTRAINT IF EXISTS check_vat_rate_range;

-- Remove invoice columns
ALTER TABLE orders
DROP COLUMN IF EXISTS invoice_address;

ALTER TABLE orders
DROP COLUMN IF EXISTS invoice_tax_id;

ALTER TABLE orders
DROP COLUMN IF EXISTS invoice_company_name;

ALTER TABLE orders
DROP COLUMN IF EXISTS invoice_requested;

-- Remove VAT columns
ALTER TABLE orders
DROP COLUMN IF EXISTS vat_amount;

ALTER TABLE orders
DROP COLUMN IF EXISTS vat_rate;

ALTER TABLE orders
DROP COLUMN IF EXISTS subtotal_amount;
