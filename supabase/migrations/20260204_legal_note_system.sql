-- =============================================================================
-- Legal Note System for Precedent Extension
-- Created: 2026-02-04
-- Description: User notes captured from Chrome extension while browsing
--              Taiwan law content (laws, judgments, interpretations)
-- =============================================================================

-- ============================================
-- TABLE 1: legal_note
-- ============================================

CREATE TABLE IF NOT EXISTS public.legal_note (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Content
    title VARCHAR(255),
    content TEXT NOT NULL,
    content_html TEXT,  -- Optional rich text

    -- Source context (what the user was viewing in extension)
    source_type VARCHAR(50),  -- 'law_article', 'judgment', 'interpretation', 'webpage', 'pdf'
    source_id VARCHAR(255),   -- law_name, judgment_id, interpretation_number
    source_url TEXT,          -- Original URL where note was captured
    source_metadata JSONB,    -- { "law_level": "法律", "law_name": "憲法", "article_no": "第7條" }

    -- Highlighted text (if user selected text before creating note)
    highlighted_text TEXT,

    -- Organization
    tags TEXT[],
    is_pinned BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
DO $$ BEGIN IF NOT EXISTS ( SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'i' AND c.relname = 'idx_legal_note_user' AND n.nspname = 'public' ) THEN CREATE INDEX idx_legal_note_user ON public.legal_note(user_id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS ( SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'i' AND c.relname = 'idx_legal_note_source' AND n.nspname = 'public' ) THEN CREATE INDEX idx_legal_note_source ON public.legal_note(source_type, source_id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS ( SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'i' AND c.relname = 'idx_legal_note_tags' AND n.nspname = 'public' ) THEN CREATE INDEX idx_legal_note_tags ON public.legal_note USING GIN(tags); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS ( SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'i' AND c.relname = 'idx_legal_note_url' AND n.nspname = 'public' ) THEN CREATE INDEX idx_legal_note_url ON public.legal_note(source_url) WHERE source_url IS NOT NULL; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS ( SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'i' AND c.relname = 'idx_legal_note_created' AND n.nspname = 'public' ) THEN CREATE INDEX idx_legal_note_created ON public.legal_note(user_id, created_at DESC); END IF; END $$;

-- Full-text search for Chinese content (includes highlighted text)
DO $$ BEGIN IF NOT EXISTS ( SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'i' AND c.relname = 'idx_legal_note_fts' AND n.nspname = 'public' ) THEN CREATE INDEX idx_legal_note_fts ON public.legal_note USING GIN(to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(highlighted_text, '') || ' ' || content)); END IF; END $$;

-- Row Level Security
ALTER TABLE public.legal_note ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own legal notes" ON public.legal_note
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.legal_note TO service_role;
GRANT ALL ON public.legal_note TO authenticated;

-- ============================================
-- TABLE 2: legal_note_embedding (pgvector)
-- ============================================

CREATE TABLE IF NOT EXISTS public.legal_note_embedding (
    note_id UUID PRIMARY KEY REFERENCES public.legal_note(id) ON DELETE CASCADE,
    embedding vector(1536),
    model VARCHAR(50) DEFAULT 'text-embedding-3-small' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- HNSW index for fast similarity search
DO $$ BEGIN IF NOT EXISTS ( SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'i' AND c.relname = 'idx_legal_note_embedding_vector' AND n.nspname = 'public' ) THEN CREATE INDEX idx_legal_note_embedding_vector ON public.legal_note_embedding USING hnsw (embedding vector_cosine_ops); END IF; END $$;

-- Row Level Security
ALTER TABLE public.legal_note_embedding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own legal note embeddings" ON public.legal_note_embedding
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.legal_note
        WHERE id = note_id AND user_id = auth.uid()
    ));

CREATE POLICY "Service role manages embeddings" ON public.legal_note_embedding
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.legal_note_embedding TO service_role;
GRANT SELECT ON public.legal_note_embedding TO authenticated;

-- ============================================
-- TABLE 3: legal_note_flashcard (SM2 Algorithm)
-- ============================================

CREATE TABLE IF NOT EXISTS public.legal_note_flashcard (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    note_id UUID NOT NULL REFERENCES public.legal_note(id) ON DELETE CASCADE,

    -- Flashcard content (AI-generated from note)
    front TEXT NOT NULL,  -- Question/prompt
    back TEXT NOT NULL,   -- Answer

    -- SM2 Algorithm fields
    ease_factor REAL DEFAULT 2.5 NOT NULL,
    interval_days SMALLINT DEFAULT 1 NOT NULL,
    repetition SMALLINT DEFAULT 0 NOT NULL,
    status VARCHAR(20) DEFAULT 'new' NOT NULL,
    next_review_date DATE DEFAULT CURRENT_DATE NOT NULL,
    last_reviewed_at TIMESTAMPTZ,
    review_count SMALLINT DEFAULT 0 NOT NULL,

    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,

    CONSTRAINT legal_note_flashcard_status_check CHECK (status IN ('new', 'learning', 'review', 'mastered'))
);

-- Indexes
DO $$ BEGIN IF NOT EXISTS ( SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'i' AND c.relname = 'idx_legal_note_flashcard_user' AND n.nspname = 'public' ) THEN CREATE INDEX idx_legal_note_flashcard_user ON public.legal_note_flashcard(user_id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS ( SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'i' AND c.relname = 'idx_legal_note_flashcard_note' AND n.nspname = 'public' ) THEN CREATE INDEX idx_legal_note_flashcard_note ON public.legal_note_flashcard(note_id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS ( SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'i' AND c.relname = 'idx_legal_note_flashcard_due' AND n.nspname = 'public' ) THEN CREATE INDEX idx_legal_note_flashcard_due ON public.legal_note_flashcard(user_id, next_review_date); END IF; END $$;

-- Row Level Security
ALTER TABLE public.legal_note_flashcard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own legal note flashcards" ON public.legal_note_flashcard
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.legal_note_flashcard TO service_role;
GRANT ALL ON public.legal_note_flashcard TO authenticated;

-- ============================================
-- TRIGGER: Auto-update updated_at
-- ============================================

CREATE TRIGGER set_legal_note_updated_at
    BEFORE UPDATE ON public.legal_note
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- RPC: Match notes by semantic similarity
-- ============================================

CREATE OR REPLACE FUNCTION public.match_legal_notes(
    p_user_id UUID,
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    title VARCHAR,
    content TEXT,
    highlighted_text TEXT,
    source_type VARCHAR,
    source_url TEXT,
    source_metadata JSONB,
    tags TEXT[],
    similarity float,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        n.id,
        n.title,
        n.content,
        n.highlighted_text,
        n.source_type,
        n.source_url,
        n.source_metadata,
        n.tags,
        1 - (ne.embedding <=> query_embedding) as similarity,
        n.created_at
    FROM public.legal_note n
    JOIN public.legal_note_embedding ne ON ne.note_id = n.id
    WHERE
        n.user_id = p_user_id
        AND n.is_archived = false
        AND 1 - (ne.embedding <=> query_embedding) > match_threshold
    ORDER BY ne.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_legal_notes TO authenticated;

-- ============================================
-- RPC: Get notes by source (law, judgment, etc.)
-- ============================================

CREATE OR REPLACE FUNCTION public.get_legal_notes_by_source(
    p_user_id UUID,
    p_source_type VARCHAR,
    p_source_id VARCHAR DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN COALESCE((
        SELECT json_agg(json_build_object(
            'id', n.id,
            'title', n.title,
            'content', n.content,
            'highlighted_text', n.highlighted_text,
            'tags', n.tags,
            'is_pinned', n.is_pinned,
            'source_url', n.source_url,
            'source_metadata', n.source_metadata,
            'created_at', n.created_at
        ) ORDER BY n.is_pinned DESC, n.created_at DESC)
        FROM public.legal_note n
        WHERE n.user_id = p_user_id
        AND n.source_type = p_source_type
        AND (p_source_id IS NULL OR n.source_id = p_source_id)
        AND n.is_archived = false
    ), '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_legal_notes_by_source TO authenticated;

-- ============================================
-- RPC: Upsert note embedding
-- ============================================

CREATE OR REPLACE FUNCTION public.upsert_legal_note_embedding(
    p_note_id UUID,
    p_embedding vector(1536),
    p_model VARCHAR DEFAULT 'text-embedding-3-small'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.legal_note_embedding (note_id, embedding, model)
    VALUES (p_note_id, p_embedding, p_model)
    ON CONFLICT (note_id)
    DO UPDATE SET
        embedding = EXCLUDED.embedding,
        model = EXCLUDED.model,
        created_at = now();

    RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_legal_note_embedding TO service_role;

-- ============================================
-- COMMENTS (Documentation)
-- ============================================

COMMENT ON TABLE public.legal_note IS 'User notes captured from Precedent Chrome extension while browsing legal content';
COMMENT ON COLUMN public.legal_note.source_type IS 'Type: law_article, judgment, interpretation, webpage, pdf';
COMMENT ON COLUMN public.legal_note.source_id IS 'Reference to law_name, judgment_id, interpretation_number';
COMMENT ON COLUMN public.legal_note.highlighted_text IS 'Original text selected by user before note creation';
COMMENT ON COLUMN public.legal_note.source_metadata IS 'Rich context: law_level, law_name, article_no, court, case_no';
COMMENT ON TABLE public.legal_note_embedding IS 'OpenAI embeddings for semantic search';
COMMENT ON TABLE public.legal_note_flashcard IS 'AI-generated flashcards from legal notes using SM2 algorithm';
