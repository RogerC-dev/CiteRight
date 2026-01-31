-- =============================================================================
-- Precedent LawData: Supabase PostgreSQL Schema
-- Migrated from MSSQL: 2026-01-31
-- Description: Legal data schema for judgments, laws, and interpretations
-- =============================================================================

-- Create the LawData schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS "LawData";

-- ============================================
-- TABLE 1: categories
-- ============================================

CREATE TABLE IF NOT EXISTS "LawData".categories (
    category_no VARCHAR(10) NOT NULL,
    category_name VARCHAR(255) NOT NULL,
    CONSTRAINT pk_categories PRIMARY KEY (category_no)
);

COMMENT ON TABLE "LawData".categories IS 'Resource categories for organizing legal data';

-- ============================================
-- TABLE 2: judgment (Composite PK)
-- ============================================

CREATE TABLE IF NOT EXISTS "LawData".judgment (
    judgment_id VARCHAR(75) NOT NULL,
    year INTEGER NOT NULL,
    judgment_case VARCHAR(30) NOT NULL,
    no VARCHAR(16) NOT NULL,
    date DATE NOT NULL,
    title VARCHAR(255) NOT NULL,
    full_text TEXT,
    pdf VARCHAR(255) NOT NULL,
    CONSTRAINT pk_judgment PRIMARY KEY (judgment_id, judgment_case)
);

CREATE INDEX idx_judgment_year ON "LawData".judgment(year);
CREATE INDEX idx_judgment_date ON "LawData".judgment(date);

COMMENT ON TABLE "LawData".judgment IS 'Court judgments and legal decisions';

-- ============================================
-- TABLE 3: law (Composite PK)
-- ============================================

CREATE TABLE IF NOT EXISTS "LawData".law (
    law_level VARCHAR(50) NOT NULL,
    law_name VARCHAR(255) NOT NULL,
    law_url VARCHAR(500) NOT NULL,
    law_category VARCHAR(100) NOT NULL,
    law_modified_date DATE,
    law_effective_date DATE,
    law_effective_note TEXT,
    law_abandon_note TEXT,
    law_histories TEXT,
    law_has_eng_version BOOLEAN,
    eng_law_name TEXT,
    law_foreword TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT pk_law PRIMARY KEY (law_level, law_name)
);

CREATE INDEX idx_law_category ON "LawData".law(law_category);
CREATE INDEX idx_law_modified_date ON "LawData".law(law_modified_date);

COMMENT ON TABLE "LawData".law IS 'Legal statutes and regulations';

-- ============================================
-- TABLE 4: interpretations
-- ============================================

CREATE TABLE IF NOT EXISTS "LawData".interpretations (
    interpretation_number VARCHAR(10) NOT NULL,
    interpretation_date TIMESTAMPTZ,
    source_url VARCHAR(512),
    "order" VARCHAR(255),
    order_title VARCHAR(255),
    order_change VARCHAR(255),
    number_change VARCHAR(255),
    announcement_order VARCHAR(255),
    amendment_order VARCHAR(255),
    CONSTRAINT pk_interpretations PRIMARY KEY (interpretation_number)
);

CREATE INDEX idx_interpretations_date ON "LawData".interpretations(interpretation_date);

COMMENT ON TABLE "LawData".interpretations IS 'Constitutional interpretations and judicial rulings';

-- ============================================
-- TABLE 5: law_attachment (FK to law)
-- ============================================

CREATE TABLE IF NOT EXISTS "LawData".law_attachment (
    id BIGSERIAL PRIMARY KEY,
    law_level VARCHAR(50) NOT NULL,
    law_name VARCHAR(255) NOT NULL,
    file_name VARCHAR(255),
    file_url VARCHAR(500) NOT NULL,
    CONSTRAINT fk_law_attachment_law 
        FOREIGN KEY (law_level, law_name) 
        REFERENCES "LawData".law(law_level, law_name) 
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX idx_law_attachment_law_level ON "LawData".law_attachment(law_level);
CREATE INDEX idx_law_attachment_law_name ON "LawData".law_attachment(law_name);

COMMENT ON TABLE "LawData".law_attachment IS 'File attachments associated with laws';

-- ============================================
-- TABLE 6: law_caption (FK to law)
-- ============================================

CREATE TABLE IF NOT EXISTS "LawData".law_caption (
    id BIGSERIAL PRIMARY KEY,
    law_level VARCHAR(50) NOT NULL,
    law_name VARCHAR(255) NOT NULL,
    caption_title VARCHAR(255) NOT NULL,
    CONSTRAINT fk_law_caption_law 
        FOREIGN KEY (law_level, law_name) 
        REFERENCES "LawData".law(law_level, law_name) 
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX idx_law_caption_law_level ON "LawData".law_caption(law_level);
CREATE INDEX idx_law_caption_law_name ON "LawData".law_caption(law_name);

COMMENT ON TABLE "LawData".law_caption IS 'Section headings/captions within laws';

-- ============================================
-- TABLE 7: resources (FK to categories)
-- ============================================

CREATE TABLE IF NOT EXISTS "LawData".resources (
    dataset_id BIGSERIAL PRIMARY KEY,
    category_no VARCHAR(10) NOT NULL,
    title VARCHAR(255) NOT NULL,
    CONSTRAINT fk_resources_category 
        FOREIGN KEY (category_no) 
        REFERENCES "LawData".categories(category_no)
);

CREATE INDEX idx_resources_category_no ON "LawData".resources(category_no);

COMMENT ON TABLE "LawData".resources IS 'Legal data resources/datasets';

-- ============================================
-- TABLE 8: interpretation_additions (FK to interpretations)
-- ============================================

CREATE TABLE IF NOT EXISTS "LawData".interpretation_additions (
    addition_id BIGSERIAL PRIMARY KEY,
    interpretation_number VARCHAR(10) NOT NULL,
    description VARCHAR(512) NOT NULL,
    url VARCHAR(512) NOT NULL,
    CONSTRAINT fk_interpretation_additions_interp 
        FOREIGN KEY (interpretation_number) 
        REFERENCES "LawData".interpretations(interpretation_number)
);

CREATE INDEX idx_interpretation_additions_number ON "LawData".interpretation_additions(interpretation_number);

COMMENT ON TABLE "LawData".interpretation_additions IS 'Additional documents for interpretations';

-- ============================================
-- TABLE 9: interpretations_en (FK to interpretations)
-- ============================================

CREATE TABLE IF NOT EXISTS "LawData".interpretations_en (
    id BIGSERIAL PRIMARY KEY,
    interpretation_number VARCHAR(10) NOT NULL,
    number_title VARCHAR(255),
    issue TEXT,
    description TEXT,
    reasoning TEXT,
    fact TEXT,
    other_opinion TEXT,
    constitutional_complaint TEXT,
    decision TEXT,
    regulations TEXT,
    appendix TEXT,
    CONSTRAINT fk_interpretations_en_interp 
        FOREIGN KEY (interpretation_number) 
        REFERENCES "LawData".interpretations(interpretation_number)
);

CREATE UNIQUE INDEX idx_interpretations_en_number ON "LawData".interpretations_en(interpretation_number);

COMMENT ON TABLE "LawData".interpretations_en IS 'English translations of interpretations';

-- ============================================
-- TABLE 10: interpretations_zh (FK to interpretations)
-- ============================================

CREATE TABLE IF NOT EXISTS "LawData".interpretations_zh (
    id BIGSERIAL PRIMARY KEY,
    interpretation_number VARCHAR(10) NOT NULL,
    number_title VARCHAR(255),
    issue TEXT,
    description TEXT,
    reasoning TEXT,
    other_documents TEXT,
    interpretation_kind_1 VARCHAR(10),
    interpretation_kind_2 VARCHAR(10),
    fact TEXT,
    CONSTRAINT fk_interpretations_zh_interp 
        FOREIGN KEY (interpretation_number) 
        REFERENCES "LawData".interpretations(interpretation_number)
);

CREATE UNIQUE INDEX idx_interpretations_zh_number ON "LawData".interpretations_zh(interpretation_number);

COMMENT ON TABLE "LawData".interpretations_zh IS 'Chinese content of interpretations';

-- ============================================
-- TABLE 11: law_article (FK to law_caption and law)
-- ============================================

CREATE TABLE IF NOT EXISTS "LawData".law_article (
    id BIGSERIAL PRIMARY KEY,
    caption_id BIGINT,
    article_no VARCHAR(50) NOT NULL,
    law_level VARCHAR(50) NOT NULL,
    law_name VARCHAR(255) NOT NULL,
    article_content TEXT,
    CONSTRAINT fk_law_article_caption 
        FOREIGN KEY (caption_id) 
        REFERENCES "LawData".law_caption(id),
    CONSTRAINT fk_law_article_law 
        FOREIGN KEY (law_level, law_name) 
        REFERENCES "LawData".law(law_level, law_name) 
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX idx_law_article_caption_id ON "LawData".law_article(caption_id);
CREATE INDEX idx_law_article_law_level ON "LawData".law_article(law_level);
CREATE INDEX idx_law_article_law_name ON "LawData".law_article(law_name);

COMMENT ON TABLE "LawData".law_article IS 'Individual articles/clauses within laws';

-- ============================================
-- TABLE 12: resource_files (FK to resources)
-- ============================================

CREATE TABLE IF NOT EXISTS "LawData".resource_files (
    file_set_id BIGSERIAL PRIMARY KEY,
    dataset_id BIGINT NOT NULL,
    resource_format VARCHAR(10) NOT NULL,
    resource_description VARCHAR(255) NOT NULL,
    CONSTRAINT fk_resource_files_dataset 
        FOREIGN KEY (dataset_id) 
        REFERENCES "LawData".resources(dataset_id)
);

CREATE INDEX idx_resource_files_dataset_id ON "LawData".resource_files(dataset_id);

COMMENT ON TABLE "LawData".resource_files IS 'Individual files within resource datasets';

-- ============================================
-- TRIGGER: Auto-update updated_at for law table
-- ============================================

CREATE OR REPLACE FUNCTION "LawData".handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_law_updated_at
    BEFORE UPDATE ON "LawData".law
    FOR EACH ROW EXECUTE FUNCTION "LawData".handle_updated_at();

-- ============================================
-- GRANTS (Supabase Standard)
-- ============================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA "LawData" TO postgres, anon, authenticated, service_role;

-- Grant access to sequences
GRANT ALL ON ALL SEQUENCES IN SCHEMA "LawData" TO postgres, anon, authenticated, service_role;

-- Grant access to tables
GRANT ALL ON ALL TABLES IN SCHEMA "LawData" TO postgres, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA "LawData" TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA "LawData" TO authenticated;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA "LawData" GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA "LawData" GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA "LawData" GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA "LawData" GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE "LawData".categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LawData".judgment ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LawData".law ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LawData".interpretations ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LawData".law_attachment ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LawData".law_caption ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LawData".resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LawData".interpretation_additions ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LawData".interpretations_en ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LawData".interpretations_zh ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LawData".law_article ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LawData".resource_files ENABLE ROW LEVEL SECURITY;

-- Public read access policies (anonymous users can read legal data)
CREATE POLICY "Public read access" ON "LawData".categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read access" ON "LawData".judgment FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read access" ON "LawData".law FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read access" ON "LawData".interpretations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read access" ON "LawData".law_attachment FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read access" ON "LawData".law_caption FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read access" ON "LawData".resources FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read access" ON "LawData".interpretation_additions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read access" ON "LawData".interpretations_en FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read access" ON "LawData".interpretations_zh FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read access" ON "LawData".law_article FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read access" ON "LawData".resource_files FOR SELECT TO anon, authenticated USING (true);

-- Service role full access (for admin operations)
CREATE POLICY "Service role full access" ON "LawData".categories FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON "LawData".judgment FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON "LawData".law FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON "LawData".interpretations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON "LawData".law_attachment FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON "LawData".law_caption FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON "LawData".resources FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON "LawData".interpretation_additions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON "LawData".interpretations_en FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON "LawData".interpretations_zh FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON "LawData".law_article FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON "LawData".resource_files FOR ALL TO service_role USING (true) WITH CHECK (true);
