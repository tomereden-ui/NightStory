-- Run in Supabase SQL Editor before seeding the avatar bank
-- Dashboard → SQL Editor → New query → paste → Run

-- 1. Enable pgvector
create extension if not exists vector;

-- 2. Avatar bank table
create table if not exists public.avatar_bank (
  id           uuid      primary key default gen_random_uuid(),
  description  text      not null,                        -- plain-English description used for embedding + image gen
  prompt_embedding vector(768),                            -- text-embedding-004 output
  image_url    text      not null,                        -- public Supabase Storage URL
  type         text      not null check (type in ('child', 'adult', 'animal')),
  gender       text      check (gender in ('boy', 'girl', 'male', 'female', 'neutral')),
  traits       text[]    not null default '{}',
  created_at   timestamptz default now()
);

-- 3. If avatar_bank already existed (e.g. data copied from another project),
-- the CREATE TABLE above no-ops and the copy may have dropped the
-- vector(768) dimension modifier. The HNSW index below needs a fixed
-- dimension to build — this restores it (no-op if already vector(768)).
alter table public.avatar_bank alter column prompt_embedding type vector(768);

-- HNSW index for fast cosine similarity (better than IVFFlat at <100k rows, no training required)
create index if not exists idx_avatar_bank_embedding
  on public.avatar_bank
  using hnsw (prompt_embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- 4. RPC function used by avatarBankService to find the closest match
create or replace function match_avatar(
  query_embedding vector(768),
  match_threshold float default 0.65
)
returns table (
  id          uuid,
  image_url   text,
  description text,
  type        text,
  gender      text,
  similarity  float
)
language plpgsql
as $$
begin
  return query
  select
    ab.id,
    ab.image_url,
    ab.description,
    ab.type,
    ab.gender,
    (1 - (ab.prompt_embedding <=> query_embedding))::float as similarity
  from public.avatar_bank ab
  where (1 - (ab.prompt_embedding <=> query_embedding)) > match_threshold
  order by ab.prompt_embedding <=> query_embedding
  limit 1;
end;
$$;

-- 5. Add avatar_url column to child_profiles so bank URLs persist (skip if exists)
alter table public.child_profiles
  add column if not exists avatar_url text;
