-- Migration 007: Listing inventory RLS policies

alter table listing_inventory enable row level security;

create policy "listing_inventory: public read"
  on listing_inventory for select
  using (true);

create policy "listing_inventory: admin insert"
  on listing_inventory for insert
  with check (is_admin_or_staff());

create policy "listing_inventory: admin update"
  on listing_inventory for update
  using (is_admin_or_staff());

create policy "listing_inventory: admin delete"
  on listing_inventory for delete
  using (is_admin_or_staff());
