-- Migration 010: Completed order status and inventory reconciliation

alter table order_requests
drop constraint if exists order_requests_status_check;

update order_requests
set status = 'completed'
where status = 'closed';

alter table order_requests
add constraint order_requests_status_check
check (status in ('new', 'contacted', 'pending_payment', 'completed', 'cancelled'));

create or replace function update_order_status_with_inventory(
  p_order_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order order_requests%rowtype;
  v_updated_order order_requests%rowtype;
  v_inventory listing_inventory%rowtype;
  v_remaining_quantity int;
  v_reserved_quantity int := 0;
  v_open_order record;
  v_auto_cancelled_orders jsonb := '[]'::jsonb;
begin
  if p_status not in ('new', 'contacted', 'pending_payment', 'completed', 'cancelled') then
    raise exception 'Invalid order status: %', p_status using errcode = '22023';
  end if;

  if not exists (
    select 1
    from profiles
    where id = auth.uid()
    and role in ('superadmin', 'admin', 'staff')
  ) then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  select *
  into v_order
  from order_requests
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order request not found' using errcode = 'P0002';
  end if;

  if v_order.status = p_status then
    return jsonb_build_object(
      'order', to_jsonb(v_order),
      'previous_status', v_order.status,
      'next_status', p_status,
      'inventory_delta', 0,
      'auto_cancelled_orders', v_auto_cancelled_orders,
      'auto_cancelled_count', 0
    );
  end if;

  if p_status = 'completed' and v_order.status <> 'completed' then
    if v_order.listing_id is null or v_order.size is null then
      raise exception 'Order cannot be completed because it is missing listing or size information'
        using errcode = '22023';
    end if;

    select *
    into v_inventory
    from listing_inventory
    where listing_id = v_order.listing_id
    and size = v_order.size
    for update;

    if not found then
      raise exception 'Inventory record not found for this order item and size'
        using errcode = 'P0002';
    end if;

    if v_inventory.quantity < v_order.quantity then
      raise exception 'Insufficient inventory. Only % available for size %.', v_inventory.quantity, v_order.size
        using errcode = '22003';
    end if;

    update listing_inventory
    set quantity = quantity - v_order.quantity
    where id = v_inventory.id
    returning * into v_inventory;

    v_remaining_quantity := v_inventory.quantity;

    update order_requests
    set status = p_status
    where id = p_order_id
    returning * into v_updated_order;

    for v_open_order in
      select id, request_code, quantity
      from order_requests
      where listing_id = v_order.listing_id
      and size = v_order.size
      and id <> p_order_id
      and status in ('new', 'contacted', 'pending_payment')
      order by created_at asc
      for update
    loop
      if v_reserved_quantity + v_open_order.quantity <= v_remaining_quantity then
        v_reserved_quantity := v_reserved_quantity + v_open_order.quantity;
      else
        update order_requests
        set status = 'cancelled'
        where id = v_open_order.id;

        v_auto_cancelled_orders := v_auto_cancelled_orders || jsonb_build_object(
          'id', v_open_order.id,
          'request_code', v_open_order.request_code,
          'quantity', v_open_order.quantity
        );
      end if;
    end loop;

    return jsonb_build_object(
      'order', to_jsonb(v_updated_order),
      'previous_status', v_order.status,
      'next_status', p_status,
      'inventory_delta', -v_order.quantity,
      'remaining_quantity', v_remaining_quantity,
      'auto_cancelled_orders', v_auto_cancelled_orders,
      'auto_cancelled_count', jsonb_array_length(v_auto_cancelled_orders)
    );
  end if;

  if v_order.status = 'completed' and p_status <> 'completed' then
    if v_order.listing_id is null or v_order.size is null then
      raise exception 'Completed order cannot restore inventory because it is missing listing or size information'
        using errcode = '22023';
    end if;

    update listing_inventory
    set quantity = quantity + v_order.quantity
    where listing_id = v_order.listing_id
    and size = v_order.size
    returning * into v_inventory;

    if not found then
      raise exception 'Inventory record not found for this order item and size'
        using errcode = 'P0002';
    end if;
  end if;

  update order_requests
  set status = p_status
  where id = p_order_id
  returning * into v_updated_order;

  return jsonb_build_object(
    'order', to_jsonb(v_updated_order),
    'previous_status', v_order.status,
    'next_status', p_status,
    'inventory_delta', case when v_order.status = 'completed' and p_status <> 'completed' then v_order.quantity else 0 end,
    'remaining_quantity', case when v_order.status = 'completed' and p_status <> 'completed' then v_inventory.quantity else null end,
    'auto_cancelled_orders', v_auto_cancelled_orders,
    'auto_cancelled_count', 0
  );
end;
$$;

grant execute on function update_order_status_with_inventory(uuid, text) to authenticated;
