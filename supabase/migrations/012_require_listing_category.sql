do $$
begin
  if exists (select 1 from listings where category_id is null) then
    raise exception 'Cannot require listing categories while uncategorized listings exist. Assign a category to every listing first.';
  end if;
end
$$;

alter table listings
  alter column category_id set not null;

alter table listings
  drop constraint if exists listings_category_id_fkey;

alter table listings
  add constraint listings_category_id_fkey
  foreign key (category_id) references categories(id) on delete restrict;
