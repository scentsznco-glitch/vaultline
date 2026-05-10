create table if not exists users (
  id text primary key,
  email text not null unique,
  role text not null check (role in ('creator', 'fan', 'admin')),
  email_verified boolean not null default false,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists email_verifications (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists creator_profiles (
  user_id text primary key references users(id) on delete cascade,
  handle text not null unique,
  bio text not null default '',
  avatar_path text,
  cover_path text,
  stripe_account_id text unique,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  identity_status text not null default 'not_started',
  policy_accepted_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists fan_profiles (
  user_id text primary key references users(id) on delete cascade,
  display_name text,
  default_payment_method text,
  updated_at timestamptz not null default now()
);

create table if not exists drops (
  id text primary key,
  creator_id text not null references creator_profiles(user_id) on delete cascade,
  title text not null,
  description text not null default '',
  price numeric(10,2) not null check (price >= 5),
  access text not null check (access in ('everyone', 'unlisted', 'svip')),
  download text not null check (download in ('allowed', 'extra', 'blocked')),
  download_extra_percent integer not null default 0 check (download_extra_percent between 0 and 100),
  status text not null default 'active' check (status in ('draft', 'active', 'expired', 'removed')),
  views integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists drop_media (
  id text primary key,
  drop_id text not null references drops(id) on delete cascade,
  storage_path text not null,
  file_type text not null,
  file_name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists purchases (
  id text primary key,
  buyer_id text not null references users(id) on delete cascade,
  drop_id text not null references drops(id) on delete restrict,
  stripe_session_id text not null unique,
  stripe_payment_intent_id text,
  amount numeric(10,2) not null,
  currency text not null default 'usd',
  application_fee_amount numeric(10,2) not null default 0,
  status text not null check (status in ('paid', 'refunded', 'disputed')),
  created_at timestamptz not null default now(),
  refunded_at timestamptz,
  disputed_at timestamptz
);

create table if not exists entitlements (
  id text primary key,
  buyer_id text not null references users(id) on delete cascade,
  drop_id text not null references drops(id) on delete restrict,
  purchase_id text not null references purchases(id) on delete cascade,
  revoked_at timestamptz,
  revoked_reason text,
  created_at timestamptz not null default now(),
  unique (buyer_id, drop_id)
);

create table if not exists operations (
  id text primary key,
  user_id text references users(id) on delete set null,
  purchase_id text references purchases(id) on delete set null,
  type text not null check (type in ('sale', 'refund', 'dispute', 'payout', 'download')),
  amount numeric(10,2) not null default 0,
  status text not null default 'complete',
  external_id text unique,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists payout_events (
  id text primary key,
  creator_id text not null references creator_profiles(user_id) on delete cascade,
  stripe_account_id text,
  amount numeric(10,2) not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists reports (
  id text primary key,
  reporter_id text references users(id) on delete set null,
  drop_id text references drops(id) on delete set null,
  reason text not null,
  details text not null default '',
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists support_tickets (
  id text primary key,
  user_id text references users(id) on delete set null,
  email text not null,
  subject text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'waiting', 'resolved')),
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id bigserial primary key,
  actor_id text references users(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists drops_creator_status_idx on drops(creator_id, status);
create index if not exists purchases_buyer_idx on purchases(buyer_id, created_at desc);
create index if not exists purchases_drop_idx on purchases(drop_id, created_at desc);
create index if not exists entitlements_buyer_drop_idx on entitlements(buyer_id, drop_id);
create index if not exists email_verifications_token_idx on email_verifications(token_hash);
create index if not exists operations_user_idx on operations(user_id, created_at desc);
create index if not exists reports_status_idx on reports(status, created_at desc);
create index if not exists support_tickets_status_idx on support_tickets(status, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'locked-media',
  'locked-media',
  false,
  524288000,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/quicktime',
    'audio/mpeg',
    'audio/mp4',
    'application/pdf',
    'application/zip',
    'text/plain'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
