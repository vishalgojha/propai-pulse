create table if not exists public.pitch_logs (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid references public.profiles(id) on delete cascade not null,
  client_phone text not null,
  listing_ids uuid[] not null,
  note text,
  sent_at timestamptz default now()
);

alter table public.pitch_logs enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'pitch_logs'
      and policyname = 'Tenants can manage their own pitch logs'
  ) then
    create policy "Tenants can manage their own pitch logs"
      on public.pitch_logs
      for all
      using (auth.uid() = tenant_id)
      with check (auth.uid() = tenant_id);
  end if;
end $$;
