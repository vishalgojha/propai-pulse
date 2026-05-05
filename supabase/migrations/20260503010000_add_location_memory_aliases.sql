create table if not exists location_memory_aliases (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references profiles(id) on delete cascade,
    alias_text text not null,
    alias_normalized text not null,
    alias_kind text not null check (alias_kind in ('building', 'micro_location')),
    locality text not null,
    city text,
    confidence_score numeric not null default 0.7,
    source_count integer not null default 1,
    last_seen_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (tenant_id, alias_normalized)
);

create index if not exists idx_location_memory_aliases_lookup
    on location_memory_aliases (tenant_id, alias_normalized);

create index if not exists idx_location_memory_aliases_locality
    on location_memory_aliases (tenant_id, locality, city);

alter table location_memory_aliases enable row level security;

drop policy if exists location_memory_aliases_select_owner on location_memory_aliases;
create policy location_memory_aliases_select_owner
    on location_memory_aliases
    for select
    to authenticated
    using (tenant_id = auth.uid());
