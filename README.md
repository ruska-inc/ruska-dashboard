This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

---

## マネーフォワード クラウド請求書 連携

見積書を「見込み」、請求書を「請求済み（入金済みなら着金済み）」としてプロジェクト一覧に取り込みます。
連携は **読み取りのみ**（スコープ `mfc/invoice/data.read`）で、マネーフォワード側のデータは変更しません。

### 1. DBマイグレーション

Supabase の SQL Editor で以下を実行します。

```
supabase/moneyforward.sql
```

`projects` に `mf_quote_id` / `mf_billing_id` / `mf_synced_at` が追加され、
OAuthトークン保管用の `mf_oauth_tokens` と同期ログ用の `mf_sync_logs` が作成されます。

### 2. アプリ登録

マネーフォワード クラウドの「アプリポータル」でアプリを作成します。

| 項目 | 値 |
|---|---|
| リダイレクトURI | `<サイトのURL>/api/moneyforward/callback` |
| クライアント認証方式 | `CLIENT_SECRET_BASIC`（既定のまま） |
| スコープ | `mfc/invoice/data.read`（認可時に指定するため登録画面には項目なし） |

### 3. 環境変数

`.env.local`（本番は Vercel の環境変数）に設定します。

```
MF_CLIENT_ID=...
MF_CLIENT_SECRET=...
MF_REDIRECT_URI=http://localhost:3000/api/moneyforward/callback
```

`MF_REDIRECT_URI` はアプリポータルに登録した値と完全に一致させてください。

クライアント認証方式で `CLIENT_SECRET_POST` を選んだ場合のみ、あわせて以下を設定します。

```
MF_CLIENT_AUTH_METHOD=client_secret_post
```

### 4. 連携と取り込み

1. **設定** 画面の「マネーフォワード クラウド請求書 連携」から連携する
2. **プロジェクト** 画面の **MFから取り込み** で期間を指定して取得
3. 差分プレビューで対象を確認し、チェックしたものだけを取り込む

### 取り込みルール

| マネーフォワード | ダッシュボード |
|---|---|
| 見積書（未設定・未受注） | ステータス `見積もり中` / 確度 `確度（中）` |
| 見積書（受注済み） | ステータス `進行中` / 確度 `確度（高）` |
| 見積書（失注） | ステータス `失注` / 確度 `失注` |
| 請求書 | ステータス `請求済み` / 確度 `確定` / 請求月 = 請求日の月 |
| 請求書（入金済み・振込済み） | ステータス `着金済み` |
| 税抜小計 / 消費税額 | `amount` / `tax_amount` |
| PDFのURL | `estimate_url` / `invoice_url` |

- **見積書と請求書の紐付け**: マネーフォワードのAPIには見積→請求の参照フィールドが無いため、
  **取引先名＋件名** が一致するものを1案件にまとめます。
  同一件名で請求書が複数ある場合（分割請求）は、2件目以降を別案件として扱います。
- **売上の二重計上防止**: 見積書は受注済みでも確度を `確度（高）` までに留め、
  確度 `確定`（＝ダッシュボードの売上集計対象）になるのは **請求書がある場合のみ** です。
  これにより、MF側で見積書と請求書の件名が違って2案件に分かれても売上は重複しません。
- **手入力の保護**: 再同期しても **案件名・メモ・入金月** は上書きしません。
  入金月は銀行CSVの照合（キャッシュフロー画面）側で管理します。
- **期**: 請求書があれば請求日、無ければ見積日をもとに、設定画面の「期の管理」から自動判定します。
