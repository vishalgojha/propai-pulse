alter table public.whatsapp_groups
    add column if not exists parse_enabled boolean default false,
    add column if not exists consent_updated_at timestamptz;

update public.whatsapp_groups
set parse_enabled = false
where parse_enabled is null;

create index if not exists idx_whatsapp_groups_workspace_parse
    on public.whatsapp_groups(workspace_id, parse_enabled, is_archived);

create table if not exists public.whatsapp_dm_permissions (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    tenant_id uuid references public.profiles(id) on delete cascade,
    session_label text,
    remote_jid text not null,
    display_name text,
    normalized_phone text,
    parse_enabled boolean not null default false,
    last_message_at timestamptz,
    consent_updated_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (workspace_id, remote_jid)
);

create index if not exists idx_whatsapp_dm_permissions_workspace_parse
    on public.whatsapp_dm_permissions(workspace_id, parse_enabled, updated_at desc);

create index if not exists idx_whatsapp_dm_permissions_workspace_phone
    on public.whatsapp_dm_permissions(workspace_id, normalized_phone);

alter table public.whatsapp_dm_permissions enable row level security;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'whatsapp_dm_permissions'
          and policyname = 'whatsapp_dm_permissions_select_workspace_members'
    ) then
        create policy whatsapp_dm_permissions_select_workspace_members
            on public.whatsapp_dm_permissions
            for select
            using (
                workspace_id = auth.uid()
                or exists (
                    select 1
                    from public.workspace_members wm
                    where wm.workspace_owner_id = public.whatsapp_dm_permissions.workspace_id
                      and wm.member_user_id = auth.uid()
                      and wm.status = 'active'
                )
            );
    end if;
end
$$;
