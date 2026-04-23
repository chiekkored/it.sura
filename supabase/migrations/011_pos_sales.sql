-- Migration 011: POS sales

create sequence if not exists sales_sale_number_seq;

create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  sale_number text not null unique,
  cashier_id uuid references profiles(id) on delete set null,
  status text not null default 'completed' check (status in ('completed', 'voided')),
  subtotal numeric not null default 0,
  total numeric not null default 0,
  payment_method text not null check (payment_method in ('cash', 'gcash', 'bank_transfer', 'card', 'other')),
  amount_paid numeric not null default 0,
  change_due numeric not null default 0,
  voided_at timestamptz,
  voided_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id) on delete cascade,
  listing_id uuid references listings(id) on delete set null,
  listing_title text not null,
  size text not null,
  quantity int not null check (quantity > 0),
  unit_price numeric not null,
  line_total numeric not null,
  created_at timestamptz default now()
);

drop trigger if exists set_updated_at_sales on sales;
create trigger set_updated_at_sales
  before update on sales
  for each row execute function handle_updated_at();

alter table sales enable row level security;
alter table sale_items enable row level security;

create policy "sales: admin read"
  on sales for select
  using (is_admin_or_staff());

create policy "sales: admin insert"
  on sales for insert
  with check (is_admin_or_staff());

create policy "sales: admin update"
  on sales for update
  using (is_admin_or_staff());

create policy "sale_items: admin read"
  on sale_items for select
  using (is_admin_or_staff());

create policy "sale_items: admin insert"
  on sale_items for insert
  with check (is_admin_or_staff());

create or replace function create_pos_sale(
  p_items jsonb,
  p_payment_method text,
  p_amount_paid numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_item jsonb;
  v_listing listings%rowtype;
  v_inventory listing_inventory%rowtype;
  v_listing_id uuid;
  v_size text;
  v_quantity int;
  v_subtotal numeric := 0;
  v_line_total numeric;
  v_sale sales%rowtype;
  v_items jsonb := '[]'::jsonb;
begin
  if not exists (
    select 1
    from profiles
    where id = v_actor_id
    and role in ('superadmin', 'admin', 'staff')
  ) then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Sale must include at least one item' using errcode = '22023';
  end if;

  if p_payment_method not in ('cash', 'gcash', 'bank_transfer', 'card', 'other') then
    raise exception 'Invalid payment method' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_listing_id := (v_item->>'listing_id')::uuid;
    v_size := nullif(trim(v_item->>'size'), '');
    v_quantity := (v_item->>'quantity')::int;

    if v_listing_id is null or v_size is null or v_quantity < 1 then
      raise exception 'Invalid sale item' using errcode = '22023';
    end if;

    select *
    into v_listing
    from listings
    where id = v_listing_id
    and is_active = true;

    if not found then
      raise exception 'Listing is not available' using errcode = 'P0002';
    end if;

    select *
    into v_inventory
    from listing_inventory
    where listing_id = v_listing_id
    and size = v_size
    for update;

    if not found then
      raise exception 'Inventory record not found for % size %', v_listing.title, v_size using errcode = 'P0002';
    end if;

    if v_inventory.quantity < v_quantity then
      raise exception 'Insufficient inventory for % size %. Only % available.', v_listing.title, v_size, v_inventory.quantity
        using errcode = '22003';
    end if;

    update listing_inventory
    set quantity = quantity - v_quantity
    where id = v_inventory.id;

    v_line_total := v_listing.price * v_quantity;
    v_subtotal := v_subtotal + v_line_total;
    v_items := v_items || jsonb_build_object(
      'listing_id', v_listing.id,
      'listing_title', v_listing.title,
      'size', v_size,
      'quantity', v_quantity,
      'unit_price', v_listing.price,
      'line_total', v_line_total
    );
  end loop;

  if p_amount_paid < v_subtotal then
    raise exception 'Amount paid is less than the sale total' using errcode = '22003';
  end if;

  insert into sales (
    sale_number,
    cashier_id,
    status,
    subtotal,
    total,
    payment_method,
    amount_paid,
    change_due
  )
  values (
    'POS-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('sales_sale_number_seq')::text, 6, '0'),
    v_actor_id,
    'completed',
    v_subtotal,
    v_subtotal,
    p_payment_method,
    p_amount_paid,
    p_amount_paid - v_subtotal
  )
  returning * into v_sale;

  insert into sale_items (sale_id, listing_id, listing_title, size, quantity, unit_price, line_total)
  select
    v_sale.id,
    (item.value->>'listing_id')::uuid,
    item.value->>'listing_title',
    item.value->>'size',
    (item.value->>'quantity')::int,
    (item.value->>'unit_price')::numeric,
    (item.value->>'line_total')::numeric
  from jsonb_array_elements(v_items) as item(value);

  return jsonb_build_object(
    'sale', to_jsonb(v_sale),
    'items', v_items
  );
end;
$$;

create or replace function void_pos_sale(p_sale_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_sale sales%rowtype;
  v_item record;
begin
  if not exists (
    select 1
    from profiles
    where id = v_actor_id
    and role in ('superadmin', 'admin', 'staff')
  ) then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  select *
  into v_sale
  from sales
  where id = p_sale_id
  for update;

  if not found then
    raise exception 'Sale not found' using errcode = 'P0002';
  end if;

  if v_sale.status = 'voided' then
    raise exception 'Sale is already voided' using errcode = '22023';
  end if;

  for v_item in
    select listing_id, size, quantity
    from sale_items
    where sale_id = p_sale_id
    and listing_id is not null
  loop
    update listing_inventory
    set quantity = quantity + v_item.quantity
    where listing_id = v_item.listing_id
    and size = v_item.size;

    if not found then
      insert into listing_inventory (listing_id, size, quantity)
      values (v_item.listing_id, v_item.size, v_item.quantity);
    end if;
  end loop;

  update sales
  set status = 'voided',
      voided_at = now(),
      voided_by = v_actor_id
  where id = p_sale_id
  returning * into v_sale;

  return jsonb_build_object('sale', to_jsonb(v_sale));
end;
$$;

grant execute on function create_pos_sale(jsonb, text, numeric) to authenticated;
grant execute on function void_pos_sale(uuid) to authenticated;
