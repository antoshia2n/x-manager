# X Manager セットアップガイド

## ファイル構成

GitHubにアップロードするファイルは以下の通り：

```
（リポジトリのルート）
├── app/
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   └── XManager.jsx
├── next.config.js
├── package.json
└── tsconfig.json
```

---

## STEP 1｜GitHubにリポジトリを作る

1. GitHub を開いて右上の **「+」→「New repository」** をクリック
2. Repository name に `x-manager` と入力
3. **Private** を選択
4. **「Create repository」** をクリック

---

## STEP 2｜ファイルをアップロードする

⚠️ **ここが一番ミスしやすいポイント**
ZIPを解凍したフォルダ「xmanager」ごとアップロードしないこと。
**中身だけ** をアップロードしてください。

### ルート直下のファイル（4つ）

1. GitHubの **「uploading an existing file」** をクリック
2. 以下の4ファイルをドラッグ＆ドロップ
   - `package.json`
   - `next.config.js`
   - `tsconfig.json`
3. **「Commit changes」** をクリック

### app/ フォルダ

1. リポジトリのトップで **「Add file → Create new file」**
2. ファイル名欄に `app/layout.tsx` と入力（`/` を入れると自動でフォルダが作られる）
3. `layout.tsx` の中身を貼り付けて **「Commit changes」**
4. 同様に `app/page.tsx` も作成

### components/ フォルダ

1. **「Add file → Create new file」**
2. ファイル名欄に `components/XManager.jsx` と入力
3. `XManager.jsx` の中身を貼り付けて **「Commit changes」**

### 完了後の確認

GitHubのルートを開いて以下が見えていればOK：

```
✅ app/
✅ components/
✅ next.config.js
✅ package.json
✅ tsconfig.json
```

---

## STEP 3｜Vercelにデプロイする

1. [vercel.com](https://vercel.com) にアクセスしてログイン
2. **「Add New → Project」** をクリック
3. GitHubリポジトリ一覧から **「x-manager」** を選択して **「Import」**
4. Framework Preset が **「Next.js」** になっていることを確認
5. 環境変数は **不要**（設定しなくてOK）
6. **「Deploy」** をクリック
7. 2〜3分待つ → デプロイ完了 🎉

---

## トラブルシューティング

| 症状 | 確認場所 | 対処 |
|---|---|---|
| `Failed to compile` | Vercel → Deployments → ログ | エラー内容をスクリーンショットしてシアニンに共有 |
| 画面が真っ白 | ブラウザの開発者ツール（F12）→ Console | エラー内容を共有 |
| GitHubの構造がおかしい | リポジトリのルートを確認 | `app/`・`components/`がルートにあるか確認 |

---

## 注意事項

- このアプリはデータをブラウザのメモリに保持します
- **リロードするとデータが消えます**（現時点での仕様）
- データを永続化したい場合は、次のフェーズでSupabase連携を追加します
