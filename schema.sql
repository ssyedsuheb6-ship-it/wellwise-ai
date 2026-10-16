-- Run in your own Supabase SQL Editor after review. No personal research data is included.
create extension if not exists pgcrypto;
create table if not exists public.product_guidance (
 id uuid primary key default gen_random_uuid(), name text not null, variant text, intended_use text, directions text, precautions text, expected_results text, source_url text, verified_at date,
 review_status text not null default 'needs_review' check (review_status in ('verified','needs_review','unavailable')), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.product_guidance enable row level security;
drop policy if exists "Public can read verified guidance" on public.product_guidance;
create policy "Public can read verified guidance" on public.product_guidance for select to anon, authenticated using (review_status='verified');
-- No public write policy: catalogue publishing must be done through a trusted admin process.
create table if not exists public.usage_checkins (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, product_name text not null,
 used_product text not null check (used_product in ('yes','no','prefer_not_to_say')), instructions_clear text not null check (instructions_clear in ('yes','partly','no')), question text, checkin_date date not null default current_date, created_at timestamptz not null default now()
);
alter table public.usage_checkins enable row level security;
drop policy if exists "Users can read their own checkins" on public.usage_checkins;
create policy "Users can read their own checkins" on public.usage_checkins for select to authenticated using (auth.uid()=user_id);
drop policy if exists "Users can add their own checkins" on public.usage_checkins;
create policy "Users can add their own checkins" on public.usage_checkins for insert to authenticated with check (auth.uid()=user_id);
drop policy if exists "Users can delete their own checkins" on public.usage_checkins;
create policy "Users can delete their own checkins" on public.usage_checkins for delete to authenticated using (auth.uid()=user_id);
-- Deliberately no fake product rows or sample analytics are inserted.
