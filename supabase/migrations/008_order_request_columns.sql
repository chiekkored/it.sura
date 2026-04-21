-- Migration 008: Ensure order request columns used by app exist

alter table order_requests
add column if not exists size text,
add column if not exists buyer_messenger text,
add column if not exists buyer_instagram text;
