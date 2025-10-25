-- Create suppliers table for level 1 users to manage their suppliers
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL, -- The company that owns this supplier list
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_name, name) -- Each company can have unique supplier names
);

-- Enable RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Suppliers are company-specific
CREATE POLICY "Users can view suppliers from their company" ON public.suppliers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.company = suppliers.company_name
    )
  );

CREATE POLICY "Users can manage suppliers from their company" ON public.suppliers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.company = suppliers.company_name
    )
  );

-- Create index for better performance
CREATE INDEX idx_suppliers_company_name ON public.suppliers(company_name);

-- Insert sample suppliers for demonstration
INSERT INTO public.suppliers (company_name, name, contact_person, email, phone, created_by) VALUES
  ('VEIDEKKE ENTREPRENØR AS', 'ByggPartner AS', 'Ole Hansen', 'ole@byggpartner.no', '12345678', (SELECT id FROM profiles WHERE email = 'daniel.ekman@veidekke.no' LIMIT 1)),
  ('VEIDEKKE ENTREPRENØR AS', 'ElektroPro', 'Anna Larsen', 'anna@elektropro.no', '87654321', (SELECT id FROM profiles WHERE email = 'daniel.ekman@veidekke.no' LIMIT 1)),
  ('VEIDEKKE ENTREPRENØR AS', 'RørleggerService', 'Per Olsen', 'per@rorlegger.no', '11223344', (SELECT id FROM profiles WHERE email = 'daniel.ekman@veidekke.no' LIMIT 1));