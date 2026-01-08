-- Add VAT and invoice columns to orders table
-- VAT is 7% calculated only at checkout, never recomputed
-- subtotal_amount = NET (before VAT)
-- total_amount = GROSS (after VAT) - existing column, semantics updated
-- vat_amount = subtotal * vat_rate / 100

-- Add subtotal_amount (NET price before VAT)
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS subtotal_amount INTEGER NULL;

-- Add vat_rate (stored as percentage, e.g., 7 for 7%)
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS vat_rate DECIMAL(5,2) NULL;

-- Add vat_amount (VAT amount in THB, 2 decimal precision stored as integer satang or as decimal)
-- Using DECIMAL for precision in accounting
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(10,2) NULL;

-- Invoice request fields (optional, per order)
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS invoice_requested BOOLEAN DEFAULT FALSE;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS invoice_company_name TEXT NULL;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS invoice_tax_id VARCHAR(20) NULL;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS invoice_address TEXT NULL;

-- Add constraint for vat_rate (must be 0-100 or NULL)
ALTER TABLE orders
ADD CONSTRAINT check_vat_rate_range
CHECK (vat_rate IS NULL OR (vat_rate >= 0 AND vat_rate <= 100));

-- Comments for documentation
COMMENT ON COLUMN orders.subtotal_amount IS 'NET total before VAT (sum of all order items)';
COMMENT ON COLUMN orders.vat_rate IS 'VAT percentage applied (e.g., 7 for 7%)';
COMMENT ON COLUMN orders.vat_amount IS 'VAT amount in THB (subtotal * vat_rate / 100)';
COMMENT ON COLUMN orders.invoice_requested IS 'Customer requested VAT invoice';
COMMENT ON COLUMN orders.invoice_company_name IS 'Company name for VAT invoice';
COMMENT ON COLUMN orders.invoice_tax_id IS 'Tax ID for VAT invoice';
COMMENT ON COLUMN orders.invoice_address IS 'Address for VAT invoice';
