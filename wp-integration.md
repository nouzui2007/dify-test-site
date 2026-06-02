# WordPress 組み込みガイド

Dify チャットウィジェットを WordPress ページに組み込むための技術仕様書。

---

## 組み込むファイル

| ファイル | 種別 | 用途 |
|---|---|---|
| `auth.js` | JS | Cookie操作・ログイン判定ユーティリティ |
| `chat-app.js` | JS | チャットUI・Dify APIとの通信 |
| `chat-style.css` | CSS | チャットウィジェットのスタイル |

### 使用しないファイル

| ファイル | 理由 |
|---|---|
| `auth.css` | グローバルリセット・ヘッダースタイルを含むためWordPressテーマと衝突する |
| `server.js` | ローカル開発専用のNode.jsサーバー |
| `index.html` | テストサイト専用。テンプレートとして流用しないこと |
| `api/chat.js` | Vercel Edge Function。WordPressでは使用しない |

---

## 前提条件

### 1. Dify API キーの保管

`wp-config.php` に定数として定義する。DBには保存しないこと。

```php
// wp-config.php
define( 'DIFY_API_KEY', getenv('DIFY_API_KEY') ?: 'app-xxxxxxxxxx' );
```

環境変数が使えるホスティング環境では `getenv()` で取得するのが望ましい。

### 2. PHP プロキシの実装（必須）

ブラウザから `api.dify.ai` を直接呼ぶと CORS でブロックされる。また、APIキーをJSに含めるとソースから漏洩する。`functions.php` にサーバーサイドのプロキシを実装すること。

**重要**: `wp_remote_post()` はSSE（Server-Sent Events）のストリーミングに非対応。生の cURL を使うこと。

```php
// functions.php

add_action( 'rest_api_init', function () {
    register_rest_route( 'dify/v1', '/chat', [
        'methods'             => 'POST',
        'callback'            => 'dify_chat_proxy',
        'permission_callback' => '__return_true',
    ] );
} );

function dify_chat_proxy( WP_REST_Request $request ) {
    $api_key = defined( 'DIFY_API_KEY' ) ? DIFY_API_KEY : getenv( 'DIFY_API_KEY' );
    $body    = json_encode( $request->get_json_params() );

    header( 'Content-Type: text/event-stream' );
    header( 'Cache-Control: no-cache' );
    header( 'X-Accel-Buffering: no' ); // Nginx のバッファリングを無効化

    $ch = curl_init( 'https://api.dify.ai/v1/chat-messages' );
    curl_setopt_array( $ch, [
        CURLOPT_POST          => true,
        CURLOPT_HTTPHEADER    => [
            'Authorization: Bearer ' . $api_key,
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS    => $body,
        CURLOPT_WRITEFUNCTION => function ( $ch, $data ) {
            echo $data;
            ob_flush();
            flush();
            return strlen( $data );
        },
        CURLOPT_TIMEOUT       => 120,
    ] );
    curl_exec( $ch );
    curl_close( $ch );
    exit;
}
```

プロキシエンドポイント: `/wp-json/dify/v1/chat`

### 3. スクリプト・スタイルの登録

`functions.php` に以下を追加する。**読み込み順序が重要**（auth.js → marked → hljs → chat-app.js）。

```php
// functions.php

function enqueue_dify_chat_assets() {
    // ① CSS
    wp_enqueue_style(
        'dify-chat-style',
        get_template_directory_uri() . '/dify/chat-style.css'
    );

    // ② auth.js（Cookie操作・ログイン判定）
    wp_enqueue_script(
        'dify-chat-auth',
        get_template_directory_uri() . '/dify/auth.js',
        [],
        '1.0',
        true  // フッターで読み込む
    );

    // ③ CDN: marked（Markdown）・highlight.js（コードハイライト）
    wp_enqueue_script( 'marked', 'https://cdn.jsdelivr.net/npm/marked@12/marked.min.js', [], null, true );
    wp_enqueue_script( 'hljs',   'https://cdn.jsdelivr.net/npm/highlight.js@11/highlight.min.js', [], null, true );
    wp_enqueue_style( 'hljs-style', 'https://cdn.jsdelivr.net/npm/highlight.js@11/styles/github.min.css' );

    // ④ chat-app.js（依存: auth.js, marked, hljs）
    wp_enqueue_script(
        'dify-chat',
        get_template_directory_uri() . '/dify/chat-app.js',
        [ 'dify-chat-auth', 'marked', 'hljs' ],
        '1.0',
        true
    );

    // ⑤ エンドポイントURLをJSに注入（APIキーは含めない）
    wp_add_inline_script(
        'dify-chat',
        sprintf( 'window.ChatConfig = %s;', json_encode( [
            'endpoint' => rest_url( 'dify/v1/chat' ),
        ] ) ),
        'before'
    );
}
add_action( 'wp_enqueue_scripts', 'enqueue_dify_chat_assets' );
```

ファイルはテーマディレクトリの `dify/` フォルダにまとめて配置することを推奨。

---

## HTML テンプレートへの組み込み

チャットウィジェットを表示したいページのテンプレート（または固定ページのカスタムHTMLブロック）に以下を貼り付ける。

```html
<div id="chat-card">
  <div class="chat-header">
    <p class="card-title">Chat</p>
    <button class="btn-reset-icon" onclick="resetChat()" title="会話リセット">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" stroke-width="2.2"
           stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
        <path d="M3 3v5h5"/>
      </svg>
    </button>
  </div>
  <div id="chat-messages"></div>
  <div id="chat-thinking" class="chat-thinking" style="display:none">
    <span></span><span></span><span></span>
  </div>
  <div class="chat-input-row">
    <textarea id="chat-input" rows="1"
              placeholder="メッセージを入力… (Shift+Enter で改行)"
              oninput="autoResizeChatInput(this)"
              onkeydown="handleChatKey(event)"></textarea>
    <button class="btn-apply" id="chat-send-btn" onclick="sendMessage()">送信</button>
  </div>
  <div class="chat-footer">
    <span id="chat-conv-id" class="chat-conv-id"></span>
  </div>
</div>
```

**必須のID一覧**（JS がこれらを参照するため、すべて存在すること）

| ID | 要素 | 用途 |
|---|---|---|
| `chat-messages` | div | メッセージ一覧のコンテナ |
| `chat-thinking` | div | 思考中インジケーター |
| `chat-input` | textarea | 入力エリア |
| `chat-send-btn` | button | 送信ボタン |
| `chat-conv-id` | span | 会話IDの表示（非表示でも可） |

---

## ログイン状態の連携

`auth.js` の `isLoggedIn()` は **`ckan` という名前のCookieが存在するかどうか**でログイン判定する。CKANのセッションCookieをそのまま参照するため、CKAN側でログインしていれば自動的に `True` がDify APIに渡る。

```js
// chat-app.js 内部での使用箇所
const inputs = { is_logged_in: isLoggedIn() ? 'True' : 'False' };
```

WordPress側での追加実装は不要。

---

## 注意事項

### SSEストリーミングが動作しない場合

マネージドホスティング（WP Engine・Kinsta・さくらのレンタルサーバー等）では、リバースプロキシがSSEレスポンスをバッファリングしてしまい、ストリーミングが機能しないことがある。

その場合の代替策:
- **Vercelを外部プロキシとして使う**: リポジトリの `api/chat.js`（Vercel Edge Function）をデプロイし、`window.ChatConfig.endpoint` にVercelのURL（例: `https://your-project.vercel.app/api/chat`）を設定する
- PHPの `ob_start()` が有効になっている場合は `ob_end_clean()` で無効化する

### `.card-title` のCSSクラス衝突

`chat-style.css` 内のセレクター `.chat-header .card-title` は、チャットカード外には影響しない。ただし使用テーマがBootstrap等を採用していて `.card-title` に強いスタイルを当てている場合、チャットカードのタイトル行の見た目が変わることがある。

発生した場合はHTMLの `class="card-title"` を `class="chat-card-title"` に変更し、`chat-style.css` 内の `.card-title` も合わせて置換すること。

### jQuery との競合なし

`auth.js` / `chat-app.js` はどちらもjQueryを使用していない。WordPressの `jQuery.noConflict()` と競合しない。

### フッター読み込みを必ず指定

`wp_enqueue_script` の第5引数を `true`（フッター）にすること。ヘッダーで読み込むと、HTMLが存在しない状態でJSが実行されエラーになる。

---

## ファイル配置例

```
wp-content/themes/your-theme/
└── dify/
    ├── auth.js
    ├── chat-app.js
    └── chat-style.css
```
