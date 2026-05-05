create extension if not exists vector;

alter table canonical_records
    add column if not exists semantic_fingerprint_embedding vector(64);

alter table stream_items
    add column if not exists semantic_fingerprint_embedding vector(64);

create index if not exists idx_canonical_records_embedding
    on canonical_records using ivfflat (semantic_fingerprint_embedding vector_cosine_ops)
    with (lists = 100);

create or replace function match_canonical_records_by_embedding(
    p_record_kind text,
    p_embedding vector(64),
    p_limit integer default 8
)
returns table (
    id uuid,
    record_kind text,
    deal_type text,
    asset_class text,
    property_category text,
    canonical_title text,
    locality text,
    city text,
    building_name text,
    micro_location text,
    bhk text,
    area_sqft numeric,
    price_numeric numeric,
    price_label text,
    furnishing text,
    floor_number text,
    total_floors text,
    property_use text,
    confidence_score numeric,
    freshness_score numeric,
    source_count integer,
    unique_broker_count integer,
    unique_group_count integer,
    contradiction_count integer,
    status text,
    first_seen_at timestamptz,
    last_seen_at timestamptz,
    best_stream_item_id uuid,
    semantic_fingerprint_text text,
    similarity double precision
)
language sql
stable
as $$
    select
        c.id,
        c.record_kind,
        c.deal_type,
        c.asset_class,
        c.property_category,
        c.canonical_title,
        c.locality,
        c.city,
        c.building_name,
        c.micro_location,
        c.bhk,
        c.area_sqft,
        c.price_numeric,
        c.price_label,
        c.furnishing,
        c.floor_number,
        c.total_floors,
        c.property_use,
        c.confidence_score,
        c.freshness_score,
        c.source_count,
        c.unique_broker_count,
        c.unique_group_count,
        c.contradiction_count,
        c.status,
        c.first_seen_at,
        c.last_seen_at,
        c.best_stream_item_id,
        c.semantic_fingerprint_text,
        1 - (c.semantic_fingerprint_embedding <=> p_embedding) as similarity
    from canonical_records c
    where c.record_kind = p_record_kind
      and c.semantic_fingerprint_embedding is not null
    order by c.semantic_fingerprint_embedding <=> p_embedding
    limit greatest(coalesce(p_limit, 8), 1);
$$;

create table if not exists location_entities (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references profiles(id) on delete cascade,
    entity_kind text not null check (entity_kind in ('locality', 'micro_location', 'building')),
    canonical_name text not null,
    locality text not null,
    city text,
    parent_entity_id uuid references location_entities(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (tenant_id, entity_kind, canonical_name)
);

create index if not exists idx_location_entities_locality
    on location_entities (tenant_id, locality, city, entity_kind);

create table if not exists location_entity_aliases (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references profiles(id) on delete cascade,
    entity_id uuid not null references location_entities(id) on delete cascade,
    alias_text text not null,
    alias_normalized text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (tenant_id, alias_normalized)
);

create index if not exists idx_location_entity_aliases_lookup
    on location_entity_aliases (tenant_id, alias_normalized);

alter table location_entities enable row level security;
alter table location_entity_aliases enable row level security;

drop policy if exists location_entities_select_owner on location_entities;
create policy location_entities_select_owner
    on location_entities
    for select
    to authenticated
    using (tenant_id = auth.uid());

drop policy if exists location_entity_aliases_select_owner on location_entity_aliases;
create policy location_entity_aliases_select_owner
    on location_entity_aliases
    for select
    to authenticated
    using (tenant_id = auth.uid());
