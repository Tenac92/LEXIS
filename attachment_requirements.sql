-- Create attachment_requirements table
CREATE TABLE IF NOT EXISTS public.attachment_requirements (
  id SERIAL PRIMARY KEY,
  expenditure_type TEXT NOT NULL,
  installment INTEGER NOT NULL DEFAULT 1,
  attachments TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default attachment requirements for common expenditure types
INSERT INTO public.attachment_requirements (expenditure_type, installment, attachments)
VALUES 
  ('default', 1, ARRAY['Διαβιβαστικό', 'ΔΚΑ']),
  ('Υποτροφίες', 1, ARRAY['Διαβιβαστικό', 'ΔΚΑ', 'Πρακτικό επιλογής', 'Σύμβαση']),
  ('Αποζημιώσεις', 1, ARRAY['Διαβιβαστικό', 'ΔΚΑ', 'Πρακτικό παραλαβής', 'Τιμολόγιο']),
  ('Μετακινήσεις', 1, ARRAY['Διαβιβαστικό', 'ΔΚΑ', 'Εντολή μετακίνησης', 'Αποδείξεις']),
  ('Μισθοδοσία', 1, ARRAY['Διαβιβαστικό', 'ΔΚΑ', 'Σύμβαση', 'Φύλλο χρονοχρέωσης']);