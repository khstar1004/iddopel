create table if not exists scan_jobs (
  id text primary key,
  username text not null,
  purpose text not null check (purpose in ('SELF_CHECK', 'BRAND_CHECK', 'NICKNAME_CHECK')),
  mode text not null check (mode in ('QUICK', 'DEEP')),
  status text not null check (status in ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'DELETED')),
  progress integer not null check (progress >= 0 and progress <= 100),
  found_count integer not null check (found_count >= 0),
  checked_count integer not null check (checked_count >= 0),
  failed_rate integer not null check (failed_rate >= 0 and failed_rate <= 100),
  doppelganger_score integer not null check (doppelganger_score >= 0 and doppelganger_score <= 100),
  rarity_score integer not null check (rarity_score >= 0 and rarity_score <= 100),
  exposure_score integer not null check (exposure_score >= 0 and exposure_score <= 100),
  impersonation_score integer not null check (impersonation_score >= 0 and impersonation_score <= 100),
  cleanup_score integer not null check (cleanup_score >= 0 and cleanup_score <= 100),
  country_distribution jsonb not null,
  category_distribution jsonb not null,
  preview_results jsonb not null,
  free_preview_locked boolean not null default false,
  free_preview_lock_reason text,
  ticket_access_owner_token_hash text,
  results jsonb not null,
  maigret_report_html text,
  maigret_report_filename text,
  maigret_report_generated_at timestamptz,
  created_at timestamptz not null,
  finished_at timestamptz,
  expires_at timestamptz not null
);

alter table if exists scan_jobs
  add column if not exists maigret_report_html text,
  add column if not exists maigret_report_filename text,
  add column if not exists maigret_report_generated_at timestamptz,
  add column if not exists free_preview_locked boolean not null default false,
  add column if not exists free_preview_lock_reason text,
  add column if not exists ticket_access_owner_token_hash text;

create index if not exists scan_jobs_expires_at_idx on scan_jobs (expires_at);
create index if not exists scan_jobs_username_created_at_idx on scan_jobs (username, created_at desc);

create table if not exists report_orders (
  id text primary key,
  scan_id text not null references scan_jobs(id) on delete cascade,
  product_id text not null check (product_id in ('DETAILED_REPORT', 'MONTHLY_MONITORING')),
  amount integer not null check (amount > 0),
  currency text not null check (currency in ('KRW')),
  order_name text not null,
  provider text not null check (provider in ('MOCK', 'TOSS', 'APP_STORE', 'GOOGLE_PLAY')),
  status text not null check (status in ('READY', 'PAID', 'FAILED', 'CANCELED')),
  checkout_url text,
  payment_key text,
  report_token_hash text,
  created_at timestamptz not null,
  paid_at timestamptz
);

create index if not exists report_orders_scan_id_idx on report_orders (scan_id);
create index if not exists report_orders_report_token_hash_idx on report_orders (report_token_hash);
create index if not exists report_orders_payment_key_idx on report_orders (provider, payment_key);

alter table report_orders drop constraint if exists report_orders_provider_check;
alter table report_orders add constraint report_orders_provider_check
  check (provider in ('MOCK', 'TOSS', 'POLAR', 'PORTONE', 'APP_STORE', 'GOOGLE_PLAY'));

alter table report_orders drop constraint if exists report_orders_product_id_check;
alter table report_orders add constraint report_orders_product_id_check
  check (product_id in ('DETAILED_REPORT', 'MONTHLY_MONITORING'));

create table if not exists monitoring_subscriptions (
  id text primary key,
  owner_token_hash text not null,
  usernames jsonb not null,
  purpose text not null check (purpose in ('SELF_CHECK', 'BRAND_CHECK', 'NICKNAME_CHECK')),
  cadence text not null check (cadence in ('MONTHLY')),
  status text not null check (status in ('ACTIVE', 'PAUSED', 'DELETED')),
  latest_scan_ids jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  last_run_at timestamptz,
  next_run_at timestamptz not null
);

create unique index if not exists monitoring_subscriptions_active_owner_idx
  on monitoring_subscriptions (owner_token_hash)
  where status <> 'DELETED';
create index if not exists monitoring_subscriptions_next_run_idx
  on monitoring_subscriptions (next_run_at)
  where status = 'ACTIVE';

create table if not exists beta_scan_settings (
  id text primary key,
  public_scan_enabled boolean not null default true,
  free_scan_limit integer not null check (free_scan_limit >= 0 and free_scan_limit <= 1000),
  window_hours integer not null check (window_hours >= 1 and window_hours <= 720),
  max_concurrent_scans integer not null default 6 check (max_concurrent_scans >= 1 and max_concurrent_scans <= 50),
  busy_retry_after_seconds integer not null default 30 check (busy_retry_after_seconds >= 1 and busy_retry_after_seconds <= 3600),
  scan_lease_ttl_seconds integer not null default 90 check (scan_lease_ttl_seconds >= 10 and scan_lease_ttl_seconds <= 600),
  updated_at timestamptz not null
);

alter table beta_scan_settings
  add column if not exists public_scan_enabled boolean not null default true,
  add column if not exists max_concurrent_scans integer not null default 6,
  add column if not exists busy_retry_after_seconds integer not null default 30,
  add column if not exists scan_lease_ttl_seconds integer not null default 90;

create table if not exists beta_scan_usage (
  quota_key text primary key,
  count integer not null check (count >= 0),
  reset_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists beta_scan_usage_reset_at_idx on beta_scan_usage (reset_at);

create table if not exists beta_scan_leases (
  lease_id text primary key,
  created_at timestamptz not null,
  expires_at timestamptz not null
);

create index if not exists beta_scan_leases_expires_at_idx on beta_scan_leases (expires_at);

create table if not exists admin_audit_events (
  id text primary key,
  action text not null,
  actor text not null,
  request_key_hash text not null,
  changes jsonb not null,
  created_at timestamptz not null
);

create index if not exists admin_audit_events_created_at_idx on admin_audit_events (created_at desc);
