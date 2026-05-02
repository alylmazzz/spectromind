-- SpectroMind Database Schema
-- PostgreSQL with pgvector extension

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Analyses table (stores analysis history)
CREATE TABLE IF NOT EXISTS analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    smiles VARCHAR(1000),
    inchi_key VARCHAR(27),
    molecule_name VARCHAR(255),
    spectrum_type VARCHAR(10), -- '1H', '13C', 'FTIR', 'MS', 'all'
    peaks JSONB, -- Stored as JSON: {"h1": [...], "c13": [...]}
    predicted_structure JSONB, -- RDKit structure data
    confidence FLOAT,
    method_used VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced Library (verified molecules)
CREATE TABLE IF NOT EXISTS enhanced_library (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    smiles VARCHAR(1000) UNIQUE NOT NULL,
    inchi_key VARCHAR(27) UNIQUE,
    molecule_name VARCHAR(255),
    formula VARCHAR(100),
    molecular_weight FLOAT,
    spectrum_data JSONB, -- Complete spectrum data
    literature_references TEXT[],
    verified BOOLEAN DEFAULT FALSE,
    verification_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vector embeddings table (for RAG)
CREATE TABLE IF NOT EXISTS spectrum_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    molecule_id UUID REFERENCES enhanced_library(id) ON DELETE CASCADE,
    embedding_type VARCHAR(50), -- 'structural', 'spectral', 'text'
    embedding VECTOR(1536), -- OpenAI embedding dimension
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Literature embeddings (for RAG)
CREATE TABLE IF NOT EXISTS literature_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500),
    abstract TEXT,
    content TEXT,
    embedding VECTOR(1536),
    source_url VARCHAR(1000),
    doi VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- QM calculation jobs (for async DFT)
CREATE TABLE IF NOT EXISTS qm_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id VARCHAR(255) UNIQUE NOT NULL,
    smiles VARCHAR(1000),
    method VARCHAR(50), -- 'xtb', 'dft'
    level VARCHAR(100), -- 'GFN2-xTB', 'B3LYP/6-31G(d)'
    status VARCHAR(50) DEFAULT 'queued', -- 'queued', 'running', 'completed', 'failed'
    result JSONB,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_smiles ON analyses(smiles);
CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON analyses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enhanced_library_smiles ON enhanced_library(smiles);
CREATE INDEX IF NOT EXISTS idx_enhanced_library_inchi_key ON enhanced_library(inchi_key);
CREATE INDEX IF NOT EXISTS idx_spectrum_embeddings_molecule_id ON spectrum_embeddings(molecule_id);
CREATE INDEX IF NOT EXISTS idx_spectrum_embeddings_type ON spectrum_embeddings(embedding_type);
CREATE INDEX IF NOT EXISTS idx_qm_jobs_status ON qm_jobs(status);
CREATE INDEX IF NOT EXISTS idx_qm_jobs_job_id ON qm_jobs(job_id);

-- Vector similarity search index (HNSW)
CREATE INDEX IF NOT EXISTS idx_spectrum_embeddings_vector ON spectrum_embeddings 
    USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_literature_embeddings_vector ON literature_embeddings 
    USING hnsw (embedding vector_cosine_ops);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_literature_embeddings_fts ON literature_embeddings 
    USING gin(to_tsvector('english', title || ' ' || abstract || ' ' || content));

