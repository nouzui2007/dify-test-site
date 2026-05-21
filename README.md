# Dify Tester

Dify の埋め込みチャットボットを、ログイン／未ログイン状態を切り替えながらテストするための 1 ページツール。

## 機能

- **擬似ログイン** — アカウント不要。ボタン 1 つでログイン状態を切り替え
- **Cookie 永続化** — ログイン状態はブラウザ Cookie に 7 日間保存
- **Dify へのユーザー情報送信** — ログイン時は `window.difyChatbotConfig.user` に User ID をセット、未ログイン時は送信しない
- **埋め込みコード即時反映** — Dify の埋め込みコードをそのまま貼り付けて適用するだけ

## 使い方

1. ヘッダーの **ログイン** ボタンを押してログイン状態を切り替える
2. ログイン済みの場合は User ID 入力欄が表示されるので、必要に応じて変更する
3. Dify 管理画面の「概要 → 埋め込む」から取得したコードをテキストエリアに貼り付ける
4. **適用する** を押すとチャットボットが起動する

```html
<!-- 貼り付けるコードの例 -->
<script>
  window.difyChatbotConfig = { token: 'YOUR_TOKEN' }
</script>
<script src="https://udify.app/embed.min.js" id="YOUR_TOKEN" defer></script>
```

## デプロイ（Vercel）

### CLI

```bash
npm i -g vercel
vercel
```

### GitHub 連携

1. このリポジトリを GitHub にプッシュ
2. [vercel.com](https://vercel.com) でリポジトリをインポート
3. 設定はデフォルトのままデプロイ

## ファイル構成

```
dify-tester/
├── index.html    # メインページ（全機能を含む単一ファイル）
├── vercel.json   # Vercel ルーティング設定
└── README.md
```
