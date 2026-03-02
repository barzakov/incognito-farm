-- Create the products storage bucket
INSERT INTO storage.buckets (id, name, owner, public)
VALUES ('products', 'products', NULL, true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for products bucket
CREATE POLICY "Public access to product images" ON storage.objects
  FOR SELECT USING (bucket_id = 'products');

CREATE POLICY "Authenticated users can upload product images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'products' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update their product images" ON storage.objects
  FOR UPDATE USING (bucket_id = 'products' AND auth.role() = 'authenticated')
  WITH CHECK (bucket_id = 'products' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete their product images" ON storage.objects
  FOR DELETE USING (bucket_id = 'products' AND auth.role() = 'authenticated');
