# 問診票の受付確認メール（患者さん宛）

問診票が送信されたとき、患者さん本人に「受け付けました」というメールを
**staff@klcs.jp から**送るための仕組みです。

回答内容はメールに一切含めません。メールは暗号化されないため、
患者さんがアドレスを打ち間違えた場合に第三者へ既往歴が届くのを防ぐためです。

構成は2つだけです。

- **Resend** — メールを実際に送るサービス（無料枠：月3,000通・1日100通）
- **Cloudflare Workers** — APIキーを隠すための中継。ブラウザに直接APIキーを
  置くと誰でも盗んで使えるため、必ずサーバー側を経由させます（無料）

---

## 事前調査の結果（2026-07-30 時点、公開DNSより）

作業前に klcs.jp の現状を確認しました。以下は実際の値です。

| 項目 | 現状 |
|---|---|
| SPF (klcs.jp) | `v=spf1 include:_spf.google.com include:amazonses.com +ip4:153.123.7.44 ~all` |
| MX (klcs.jp) | Google Workspace |
| DMARC | `v=DMARC1; p=quarantine; adkim=s; aspf=s` |
| send.klcs.jp | **未使用**（レコードなし。そのまま使えます） |
| DNS管理元 | wadax-sv.jp（SOA の連絡先は postmaster@global-pharma.co.jp） |

これで確定した注意点が2つあります。

### ルートドメインには絶対に触らないこと

klcs.jp には**すでにSPFレコードが存在します**（Google Workspace と Amazon SES を
併用中）。SPFは1ドメインに1レコードしか置けないため、ここに Resend 用のSPFを
追加すると**既存の staff@klcs.jp のメールが送信できなくなります。**
`send.klcs.jp` を使えばこのレコードには一切触りません。

### 差出人アドレスは `@send.klcs.jp` から変えられない

DMARC が `adkim=s; aspf=s`（**strict アライメント**）で設定されています。
これは「差出人アドレスのドメインと、署名したドメインが完全一致していなければ
ならない」という厳しい設定です。しかも `p=quarantine` なので、
不一致のメールは**迷惑メールフォルダに入ります**。

`send.klcs.jp` を認証した状態で差出人を `staff@klcs.jp` にすると不一致になり、
患者さんに届かなくなります。手順4の `FROM_ADDRESS` は
**`noreply@send.klcs.jp` のまま**にしてください。

受信箱には差出人名が `K Ladies Clinic Shinjuku` と表示され、返信は
staff@klcs.jp に届くので、患者さんから見た体裁は問題ありません。

---

## 手順

アカウント作成、APIキーの入力、DNS設定の変更は、私（Claude）が実行しない作業です。
以下はご自身で操作をお願いします。

### 1. Resend でドメインを認証する

1. https://resend.com でアカウントを作成
2. **Domains → Add Domain** で `send.klcs.jp` を追加
3. 表示される DNS レコード（MX 1件、TXT 2件）を klcs.jp の DNS に追加
4. 数分〜数十分で `Verified` になります

> **重要：ルートドメイン（klcs.jp）ではなく、サブドメイン（send.klcs.jp）を
> 登録してください。** ルートに SPF レコードを追加すると、既存の
> staff@klcs.jp のメール認証が壊れる恐れがあります。SPF は1ドメインに1件しか
> 置けないため、既存のものと**統合**が必要になり事故りやすい箇所です。
> サブドメインなら既存のメール設定に一切触りません。

### 2. Resend の API キーを取得

**API Keys → Create API Key**。権限は `Sending access` のみで十分です。
`re_` で始まる文字列をコピーしておきます（一度しか表示されません）。

### 3. Cloudflare Worker を作る

1. https://dash.cloudflare.com → **Workers & Pages → Create → Worker**
2. 名前は `klcs-intake-confirmation` など
3. **Deploy** → **Edit code** を開き、中身をすべて消して
   このフォルダの [`send-confirmation.js`](send-confirmation.js) を貼り付け → **Deploy**

### 4. Worker に3つの変数を設定

**Settings → Variables and Secrets** で追加します。

| 名前 | 種類 | 値 |
|---|---|---|
| `RESEND_API_KEY` | **Secret** | 手順2でコピーした `re_...` |
| `FROM_ADDRESS` | Text | `K Ladies Clinic Shinjuku <noreply@send.klcs.jp>` ← 変更不可、上記DMARCの項参照 |
| `REPLY_TO` | Text | `staff@klcs.jp` |

`RESEND_API_KEY` は必ず **Secret**（Encrypt）にしてください。Text にすると
ダッシュボード上で誰でも読めてしまいます。

差出人の表示は `K Ladies Clinic Shinjuku` になり、患者さんが返信すると
staff@klcs.jp に届きます。

### 5. URL を問診票に登録

Worker の URL（`https://klcs-intake-confirmation.〜.workers.dev`）をコピーし、
`intake.html` の以下の行に貼り付けます。

```js
var CONFIRM_ENDPOINT = "";
```

↓

```js
var CONFIRM_ENDPOINT = "https://klcs-intake-confirmation.xxxx.workers.dev";
```

**この行が空のままなら、メールは送信されず、問診票は今までどおり動きます。**
手順1〜4が終わるまで空欄で問題ありません。

---

## 送られるメール

```
From:    K Ladies Clinic Shinjuku <noreply@send.klcs.jp>
Reply-To: staff@klcs.jp
Subject: We've received your questionnaire, K Ladies Clinic Shinjuku

Dear (お名前),

Thank you, we have received your pre-consultation questionnaire.

The doctor will read through your answers before your appointment, so your
consultation time can go to your questions rather than paperwork.

If you need to change or cancel your appointment, please use the reschedule
link in your booking confirmation email. For anything else, just reply to
this message and our English speaking staff will get back to you.

K Ladies Clinic Shinjuku
Gynecology Clinic, Shinjuku, Tokyo
```

## 安全対策

- **回答内容を含めない** — 本文は Worker 内に固定。リクエストから本文を
  受け取らないので、この URL を悪用してクリニック名義の任意のメールを
  送ることはできません
- **送信先は1件のみ** — カンマ区切りや表示名を使った宛先の水増しを拒否します
- **呼び出し元を制限** — `https://kladiesclinic.github.io` 以外からのリクエストは
  403 で拒否します
- **失敗しても患者さんには見せない** — このメールが送れなくても、問診票自体は
  すでにクリニックに届いています。エラーを表示して不安にさせないため、
  失敗は画面に出さず Worker のログにだけ残します

### 残っているリスク

Origin ヘッダーはブラウザが付けるものなので、ブラウザ以外（curl など）からは
偽装できます。悪用されると当院名義の受付確認メールが第三者に送られる可能性が
あります。本文は固定なので被害は限定的ですが、気になる場合は Cloudflare の
**Security → WAF → Rate limiting rules** で、この Worker の URL に
「1つの IP から10分間に5リクエストまで」などの制限を追加してください（無料枠で可）。
