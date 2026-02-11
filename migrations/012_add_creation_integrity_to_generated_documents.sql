ALTER TABLE generated_documents
ADD COLUMN IF NOT EXISTS creation_integrity JSONB;
