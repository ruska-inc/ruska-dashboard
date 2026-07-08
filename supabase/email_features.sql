-- =============================================
-- 営業メール送信機能
-- =============================================

-- 1. sales_leads にメールアドレス列を追加
alter table public.sales_leads add column if not exists email text;
alter table public.sales_leads add column if not exists contact_person_name text;

-- 2. メールテンプレート
create table if not exists public.email_templates (
  id uuid default gen_random_uuid() primary key,
  name text not null,           -- 例: 初回アプローチ
  subject text not null,        -- 件名(変数使用可)
  body text not null,           -- 本文(変数使用可 {{company_name}} など)
  is_default boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

drop trigger if exists email_templates_updated_at on public.email_templates;
create trigger email_templates_updated_at
  before update on public.email_templates
  for each row execute procedure public.handle_updated_at();

-- 3. 送信履歴
create table if not exists public.sent_emails (
  id uuid default gen_random_uuid() primary key,
  lead_id uuid references public.sales_leads(id) on delete cascade not null,
  template_id uuid references public.email_templates(id) on delete set null,
  to_email text not null,
  from_email text not null,
  subject text not null,
  body text not null,
  status text not null default 'sent'
    check (status in ('sent','failed','bounced','opened','replied')),
  error_message text,
  resend_id text,  -- Resend 側の識別子
  sent_by uuid references public.profiles(id),
  sent_at timestamptz default now()
);

create index if not exists sent_emails_lead_idx on public.sent_emails (lead_id, sent_at desc);
create index if not exists sent_emails_sent_at_idx on public.sent_emails (sent_at desc);

-- =============================================
-- RLS
-- =============================================

alter table public.email_templates enable row level security;
alter table public.sent_emails enable row level security;

-- email_templates policies
drop policy if exists "email_templates_select" on public.email_templates;
drop policy if exists "email_templates_insert" on public.email_templates;
drop policy if exists "email_templates_update" on public.email_templates;
drop policy if exists "email_templates_delete" on public.email_templates;
create policy "email_templates_select" on public.email_templates for select using (
  get_my_role() in ('admin','management','accounting','internal')
);
create policy "email_templates_insert" on public.email_templates for insert with check (
  get_my_role() in ('admin','management','accounting','internal')
);
create policy "email_templates_update" on public.email_templates for update using (
  get_my_role() in ('admin','management','accounting','internal')
);
create policy "email_templates_delete" on public.email_templates for delete using (
  get_my_role() in ('admin','management')
);

-- sent_emails policies
drop policy if exists "sent_emails_select" on public.sent_emails;
drop policy if exists "sent_emails_insert" on public.sent_emails;
drop policy if exists "sent_emails_delete" on public.sent_emails;
create policy "sent_emails_select" on public.sent_emails for select using (
  get_my_role() in ('admin','management','accounting','internal')
);
create policy "sent_emails_insert" on public.sent_emails for insert with check (
  get_my_role() in ('admin','management','accounting','internal')
);
create policy "sent_emails_delete" on public.sent_emails for delete using (
  get_my_role() in ('admin','management')
);

-- =============================================
-- 初期テンプレート(サンプル)
-- =============================================
insert into public.email_templates (name, subject, body, is_default, sort_order) values
  (
    '初回アプローチ',
    '{{company_name}}様 - サービスのご紹介',
$${{contact_person_name}}様

突然のご連絡失礼いたします。
株式会社Ruska(https://ruska.co.jp)の中川と申します。

{{company_name}}様の事業内容を拝見し、弊社のWeb・EC制作サービスがお役に立てるのではと思い、ご連絡させていただきました。

ご興味がございましたら、簡単な資料をお送りさせていただきます。
お忙しいところ恐縮ですが、ご返信お待ちしております。

---
株式会社Ruska
中川達貴
Web: https://ruska.co.jp
Email: t.nakagawa@ruska.co.jp$$,
    true,
    0
  )
on conflict do nothing;
