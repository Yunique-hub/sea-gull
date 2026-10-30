<p align="center">
  <img src="docs/banner.svg" alt="dsh-purge" width="720">
</p>

<h1 align="center">⚔️ DeepSeek Harness サイバーセキュリティ レッドチームツール (dsh-purge)</h1>

<p align="center"><strong>バージョン 1.1.81</strong></p>

<p align="center">
  <em>DeepSeek Harness のジェイルブレイク: すべてのモデルに対応し、モデルごとにプロンプトを切り替え。デフォルトプロンプトは 小码酱 用。ぜひ Star ⭐ を。これをベースに開発する場合は「要帰属表示」をご覧ください。</em>
</p>

<p align="center">
  <a href="https://github.com/YuJunZhiXue/dsh-purge/stargazers"><img src="https://img.shields.io/github/stars/YuJunZhiXue/dsh-purge?logo=github&label=Stars" alt="GitHub stars"></a>
  <a href="https://github.com/YuJunZhiXue/dsh-purge/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue?style=flat" alt="Apache-2.0"></a>
  <a href="https://awesome-dsh-plugin.com"><img src="https://awesome-dsh-plugin.com/badge.svg" alt="awesome · DSH plugin"></a>
  <a href="https://deepseek.stream/plugins/dsh-purge"><img src="https://img.shields.io/badge/Hub-dsh--purge-1a73e8" alt="DeepSeek Harness Hub"></a>
  <a href="https://www.deepseek.com/harness/"><img src="https://img.shields.io/badge/dsh-0.2.0--rc.2%20%2F%200.2.1--rc.2-blue" alt="DSH"></a>
  <br>
  <img src="https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=fff" alt="Node.js">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=000" alt="JavaScript">
</p>

<p align="center">
  <a href="https://dsh-plugin.org/plugins/yujunzhixue/dsh-purge"><img src="https://dsh-plugin.org/badges/listed.svg" alt="Listed on dsh-plugin.org"></a>
</p>

<p align="center">
  <a href="README.md">English</a> | <a href="README.zh-CN.md">中文</a> | <a href="README.ja.md">日本語</a>
</p>

## 作者より

このオープンソースの成果物を、公然と売りさばく人たちがいました。その後、作者は呼び出されて話をすることになりました。あとは言わずもがな。行間を読んでください。

今後、**公開インターネットは閉じます**。オープンソース版では **ローカルのラボ IP のみ** を許可します（ループバックと RFC1918）。ドメインは先に名前解決され（hosts も含む）、すべての応答がプライベートまたはループバックでなければなりません。`.lab` を公開 IP に向ける hosts トリック、名前解決の失敗、公開 IP が混じった応答はブロックされます。**ゲームチートは禁止です**（エイムボット、ウォールハック、メモリ改ざん、アンチチート回避）。プロンプトとセッションゲートの両方で阻止します。このビルドにはスキルライブラリやナレッジベースは同梱されません。

**オリジナルビルドの転売は禁止です。** 課金、スキン変更、グループでの売り込みは許可されません。フォークは自由ですが、**帰属表示が必須** で、出所を明記してください: [YuJunZhiXue/dsh-purge](https://github.com/YuJunZhiXue/dsh-purge)。出所を隠したり、自分のものとして偽ったりすれば、あなたは向こう側です。

作者の個人チャンネル: [t.me/LLM_PoJia](https://t.me/LLM_PoJia)。メモや更新情報はそこに出ます。

## 目次

- [作者より](#作者より)
- [これは何か](#これは何か)
- [要帰属表示](#要帰属表示)
- [ライセンス](#ライセンス)
- [対応ホスト](#対応ホスト)
- [インストール](#インストール)
- [プレビュー](#プレビュー)
- [使い方](#使い方)
- [仕組み](#仕組み)
- [復元](#復元)
- [リリース](#リリース)

---

## これは何か

**dsh-purge** は、お使いのマシンにすでにインストールされている公式 [DeepSeek Harness](https://www.deepseek.com/harness/) 向けのサイバーセキュリティ レッドチームプラグインです。**1.1.81** は **DSH 0.2.1-rc.2** を対象とします（0.2.0 も動作します）。**DSH 0.2.1-rc.3 以降の新しい RC は非対応です。** 公式 **Web**（`dsh web`）と公式 **デスクトップ EXE** の両方に対応します。インストールと Apply はそれぞれ別々に行います。

Harness は単にプロンプトを転送するだけではありません。プロンプトの書き換え、承認ゲート、サンドボックスポリシー、セッション移行を実行時に行います。「モデルは答えるか」だけを問うと、ホスト層のブロックをモデルの拒否と取り違えてしまいます。このプラグインは、あなた自身のインストール環境でこの 2 つの層を分離し、制御された評価や、どのデフォルトポリシーが過度に厳しいかを確認するために使います。

| 得られるもの | 内容 |
|---|---|
| **dsh-purge ドック** | セッションタイトルの横のボタンで右ドックを開く。2 ページ: Clean と Drill |
| **Clean** | グループ化されたパッチ状況、Apply / Restore / Uninstall、プロンプトエディタ、複数のルールセット |
| **Drill** | 安定版に内蔵。認可後: アセットとローカル環境。このビルドはスキルやナレッジベースを同梱しません。ローカルラボ専用 |
| **ホストポリシー** | デフォルトのコピー、権限ポリシー、ツール制限。公式の機能はそのまま。2 つ目の架空アイデンティティは作らない |
| **起動時** | チェックして再適用。npm が `node_modules` を上書きした後も、ファイルを手編集しなくてよい |

ドライブレターのハードコードはありません。`$DSH_HOME`、dsh ランチャー横の `.dsh`、次に `~/.dsh` を参照します。Harness のソースツリーにはパッチしません。変更を書き込むのは **dsh-purge** の **Clean** ページの **Apply** です。アイデンティティはプラグインに同梱された暗号化プロンプト、つまりプロンプトボックスがデフォルトで表示するテキストから来ます。ホストのプロンプトファイルは読みません。

触れるのはユーザーのマシン上の公式 `@deepseek-ai` パッケージとローカル設定だけです。公開スキャナーでもなく、第三者サイトへの攻撃キットでもありません。リポジトリにマルウェア、未認可のエクスプロイトスクリプト、公開インターネットを狙うペイロードは同梱されていません。

---

## オリジナルの転売は禁止。フォークは帰属表示が必須。

## 要帰属表示

**オリジナルビルドの転売は禁止です。** 有料での転売、スキン変更したストア掲載、グループでの売り込みは禁止です。

**フォークは帰属表示が必須** で、出所のリポジトリを明記してください: [YuJunZhiXue/dsh-purge](https://github.com/YuJunZhiXue/dsh-purge)。名前、アイデア、コード、プロンプトを借用する場合も同様です。

出所を隠す、自分のものとして偽る、オリジナルを転売する行為は追及します。

## ライセンス

本リポジトリは [Apache License 2.0](./LICENSE) です。フォークおよび再配布では著作権表示と [NOTICE](./NOTICE) を保持し、[YuJunZhiXue/dsh-purge](https://github.com/YuJunZhiXue/dsh-purge) を明記してください。オリジナルの転売は禁止です。

---

<a id="strict-legal--compliance-disclaimer"></a>

<div>

### ⚠️ <font color="red">厳格な法的・コンプライアンス免責事項</font>

<font color="red">

**免責事項:** 本プロジェクトは非営利のオープンソースプロジェクトです。適用される法律および利用するプラットフォームの規則に従い、学習と研究のみを目的としています。違法または非準拠の目的に使用しないでください。生じた結果は利用者が負います。

**ゼロトレランス声明:** 本プロジェクトはいかなる違法行為にも反対し、禁止します。作者は、未認可のネットワーク攻撃、エクスプロイトの使用、データの窃取、コンピュータ情報システムへの不正侵入、違法または禁止されたコンテンツの生成を支援、奨励、幇助しません。**本プロジェクトを犯罪に使用した者は、法律上すべての責任を単独で負います。作者は一切の責任を負いません。**

1. **本リポジトリに違法な素材は含まれません。** 公開されているコード、ドキュメント、パッチ、デフォルトプロンプトは、マルウェア、バックドア、未認可のペンテストキット、ランサムウェア、クレデンシャルスタッフィングスクリプト、公開インターネットや第三者システムを狙う攻撃ペイロードでは **ありません**。本プロジェクトは違法コンテンツを提供せず、犯罪を扇動・組織・幇助しません。
2. **ローカルの公式 Harness のみ。** セキュリティ評価用パッチとプロンプトインジェクションは、**ユーザーのマシンにすでにインストールされた公式 DeepSeek Harness**（`@deepseek-ai` パッケージ、ローカルプロファイル / `$DSH_HOME`）に対してのみ動作します。対象はユーザー自身の公式ローカルソフトウェアであり、**他人のウェブサイト、サーバー、アカウント、情報システムではありません**。
3. **評価用パッチは公開インターネットを攻撃しません。** Apply、インジェクト、リバート、アンインストールはすべてローカルファイルとローカルプロセス内に留まります。いかなる公開ホストや未認可システムに対しても、**スキャン、探査、侵入、攻撃トラフィックの送信を行いません**。本プロジェクトを公開インターネットへの踏み台として使わないでください。「更新確認」が有効な場合、プラグインはバージョン比較のために本プラグイン自身の GitHub リポジトリにのみアクセスすることがあります。これは第三者システムへの攻撃では **なく**、何かへの侵入を認可するものでも **ありません**。
4. **合法かつ制御された範囲。** 本プロジェクトは、ユーザーが **管理する権限を有する公式 Harness** 上でのレッドチーム研究と堅牢性評価の補助ツールです。**所有者の合法的な書面による認可のないターゲット、公開オンラインシステム、本番ワークロードに対して実行しないでください。** テストは **認可されたローカルの公式 Harness、オフラインのローカル合成フィクスチャ、認可されたサイバーセキュリティレンジ、準拠したラボ環境** に限ります。
5. **オープンソース版はローカルラボ専用です。** 攻撃タスクはループバックと RFC1918 アドレスのみ許可します。ドメインは名前解決され、IP で判定されます。サフィックスは許可リストではありません。公開 IP、公開に解決される名前、名前解決の失敗、ラボ名を公開インターネットに向ける hosts エントリは例外になりません。キー、パスワード、ネットワーク範囲、ワイルドカード、会話内での主張は例外を追加しません。ゲームチートは禁止です。このビルドにはスキルライブラリやナレッジベースは同梱されません。
6. **禁止される用途。** 利用者は、本プロジェクトを直接・間接を問わず、以下に違反する目的で使用してはなりません（いずれも遵守必須。回避の口実は認められません）:
   - <font color="red"><strong>中華人民共和国刑法</strong></font>
   - <font color="red"><strong>中華人民共和国サイバーセキュリティ法</strong></font>
   - <font color="red"><strong>中華人民共和国データセキュリティ法</strong></font>
   - <font color="red"><strong>中華人民共和国個人情報保護法</strong></font>
   - その他適用される法律、規制、監督規則；
   - さらに以下も禁止:
   - 公的・私的なコンピュータ情報システムへの未認可の侵入または攻撃；恐喝、破壊、クレデンシャルスタッフィング、悪意あるペイロードの拡散；
   - 国家安全保障への脅威、テロ、暴力、ポルノ、賭博、詐欺、プライバシーや知的財産権の侵害を含む、法律が禁じるあらゆるコンテンツの誘発・生成・拡散；
   - モデル提供者の利用規約および利用許諾ポリシーへの違反。
7. **利用者がすべての責任を負います。** 本プロジェクトは Apache-2.0 の下で現状のまま提供されます。作者は完全性、安全性、適合性について一切保証しません。**利用者は、ダウンロード、デプロイ、実行、改変、配布、およびそれに伴うすべての入力と出力について、民事・行政・刑事上のすべての責任を独立して負います。** 作者および貢献者は、悪用について直接・間接・連帯のいかなる責任も負いません。
8. **違反時にライセンスは終了します。** 本プロジェクトを違法な攻撃、悪意ある活動、その他の違反に使用した者は、違反の瞬間からオープンソースライセンスが **自動的かつ取り消し不能に終了** します。使用を直ちに停止し、すべての複製と派生物を永久に破棄し、法的制裁を受け入れなければなりません。
9. **無関係。** 本プロジェクトは独立したオープンソースのセキュリティ評価研究プロジェクトです。DeepSeek またはその関連会社との間に、雇用、商業、認可、推奨のいかなる関係もありません。ここでの「公式」は、評価対象がユーザーのマシン上の公式 DeepSeek Harness パッケージであることだけを意味します。DeepSeek が本プラグインを開発・承認・保証したことを **意味しません**。
10. **帰属表示は必須です。** 本プロジェクトの名前、アイデア、コード、プロンプトを借用する場合は、作者をクレジットし本リポジトリを明記しなければなりません。帰属表示の不履行は追及します。[要帰属表示](#要帰属表示) を参照してください。

</font>

</div>

---

## 対応ホスト

**1.1.81 は DSH 0.2.1-rc.2 を対象とします。** 0.2.0 も動作します。0.1.x には適用しないでください。

- **dsh 0.2.1-rc.2**（公式デスクトップ / 公式 `dsh web`）: **1.1.81** を使用。`{{cwd}}` / `[cwd]` クラッシュ、patch #40 のマッチ、削除された `toolFilter`、ホスト `dsh-tools` の解決、hostFs の fd、デスクトップヘルパーの自己終了、`file:` アーカイブ更新、Ctrl+Enter ステアを修正。
- **dsh 0.2.0-rc.2**: **1.1.40** 以降を使用。このラインもインストールできます。
- **dsh 0.1.7**（rc.1 / rc.2 を含む）: **1.1.39** 以前を使用 — [Releases](https://github.com/YuJunZhiXue/dsh-purge/releases) で該当タグを選択。
- **dsh 0.2.1-rc.3 / rc.4 以降は非対応です。** マッチしないパッチは pending または skipped のままで、盲目的な書き換えはしません。**0.2.1-rc.2** に留まってください。

マッチしないパッチは pending または skipped のままで、盲目的な書き換えはしません。

---

## インストール

**プラグインマーケットプレイスは使わないでください。** [dsh-plugin.org](https://dsh-plugin.org) や 設定 → プラグインマーケット でのワンクリックインストールは `already queued: dsh-purge` で失敗し、コマンドを実行しません。`dsh-purge` という名前は npm レジストリにないので、`pnpm add dsh-purge` はしないでください。

### クイックスタート

PATH に `dsh` があれば、コマンド 1 つ、再起動 1 回、クリック 1 回。自分が開いているホストのコマンドをそのまま実行します（デスクトップ EXE は `web` の代わりに `desktop`）:

```sh
# 公式 `dsh web`
dsh plugin --profile web add https://codeload.github.com/YuJunZhiXue/dsh-purge/tar.gz/refs/heads/master

# 公式デスクトップ EXE
dsh plugin --profile desktop add https://codeload.github.com/YuJunZhiXue/dsh-purge/tar.gz/refs/heads/master
```

1. インストールしたホストを **完全に終了して再起動** します。Web: `dsh web` を停止して起動し直す。デスクトップ: トレイアイコンも終了してから exe を開く。
2. そのホストで、セッションタイトルの横の **dsh-purge** → **Clean** → **Apply** をクリック。成功した Apply は 1 回だけ再起動します。

完了 — チャットで `/purge status` を実行して確認します。pnpm がビルド許可を尋ねてきた場合や、下記の何かが現れない場合は、この後のステップ別の手順に進んでください。

### ステップバイステップ

**ステップ 1 — 使うホストを選ぶ。** 公式 `dsh web` と公式デスクトップ EXE は **別々に** インストール・パッチされます。実際に開くホストにのみインストールしてください。

| 実行するもの | プロファイル | インストールコマンド |
|---|---|---|
| 公式 `dsh web` | `web` | クイックスタートの `web` の行 |
| 公式デスクトップ EXE | `desktop` | クイックスタートの `desktop` の行 |

**ステップ 2 — プラグインを入れる。** 圧縮パッケージの URL は `codeload.github.com` の書き方そのままにしてください。`github.com/.../archive` は使わないでください。その 302 により pnpm が `fetch failed` で失敗します。

`dsh` がある場合: クイックスタートの自分のプロファイルの行を実行します。このディレクトリがすでにクローンなら、URL の代わりに `.` を使います。

pnpm のみ（`dsh` 不要）: リポジトリのルートではなく、実際に使うプロファイル内で実行してください。

```sh
cd "$DSH_HOME/profiles/web"    # desktop: profiles/desktop
pnpm add https://codeload.github.com/YuJunZhiXue/dsh-purge/tar.gz/refs/heads/master
```

Windows PowerShell:

```powershell
cd "$env:USERPROFILE\.dsh\profiles\web"   # desktop: profiles\desktop
pnpm add https://codeload.github.com/YuJunZhiXue/dsh-purge/tar.gz/refs/heads/master
```

`pnpm add` と `dsh plugin add` はパッケージを取得します。`postinstall` が `dsh-purge` を `dsh.profile.bundles` に書き込み、プロファイルの `cordis.patch.yml` に body `insert` を追加します。その insert がないとホストはプラグインを読み込まず、ボタンも現れません。

**完了の目安:** `node_modules/dsh-purge/package.json` が存在し、そのプロファイルの `bundles` に `"dsh-purge"` があり、`cordis.patch.yml` に `id: dsh-purge` の insert があること。

- pnpm 11/12 はビルドを許可しないとインストールスクリプトをスキップします（`ERR_PNPM_IGNORED_BUILDS`）:

```sh
pnpm add --allow-build=dsh-purge --allow-build=dsh-purge@https://codeload.github.com/YuJunZhiXue/dsh-purge/tar.gz/refs/heads/master https://codeload.github.com/YuJunZhiXue/dsh-purge/tar.gz/refs/heads/master
# すでにインストール済みで警告のみの場合 — 完全な指定子が必要です（名前だけだと "set this to true or false" が残ります）:
pnpm approve-builds dsh-purge@https://codeload.github.com/YuJunZhiXue/dsh-purge/tar.gz/refs/heads/master
# bundles / insert がまだ無い場合:
node node_modules/dsh-purge/scripts/ensure-profile-bundle.mjs
```

- `dsh` も pnpm も使えない場合は [手動インストール](#手動) に進んでください。
- デスクトップクライアントではボタンをクリックすることもできます（`dsh://` ディープリンク。同じ tarball をダウンロードします）。

<p align="center">
  <a href="dsh://plugin/install?id=dsh-purge&name=dsh-purge&version=1.1.81&repo=YuJunZhiXue%2Fdsh-purge&permissions=%E7%B3%BB%E7%BB%9F%E6%8F%90%E7%A4%BA%E8%AF%8D%E6%B3%A8%E5%85%A5%2C%E6%9C%AC%E6%9C%BA%E8%A1%A5%E4%B8%81%2C%E8%AE%BE%E7%BD%AE%E9%A1%B5&downloadUrl=https%3A%2F%2Fcodeload.github.com%2FYuJunZhiXue%2Fdsh-purge%2Ftar.gz%2Frefs%2Fheads%2Fmaster"><strong>デスクトップクライアントでインストール</strong></a>
</p>

**ステップ 3 — ホストを再起動する。** プラグインをプロファイルに追加しただけでは、`@deepseek-ai` にパッチは当たりません。インストールしたホストを完全に終了して再起動します（Web: `dsh web` を停止して起動し直す。デスクトップ: トレイアイコンも終了してから exe を開く）。

**完了の目安:** セッションタイトルの横に **dsh-purge** がある。見当たらない場合はステップ 5 へ。

**ステップ 4 — Apply して確認。** **そのホスト** で、セッションタイトルの横の **dsh-purge** をクリックし、**Clean** を開いて **Apply** をクリック。ホストの設定ページにはありません。成功した **Apply** は 1 回だけ再起動します。完了しなかった場合は再起動しません。Web のコントロールは Web のみに、デスクトップのコントロールはデスクトップアプリのみに作用します。片方のホストからもう片方を Apply しないでください。

**完了の目安:** チャットで `/purge status` を打つと `DSH_HOME` とパッチ一覧が表示され、パスは実際に実行しているホームであること。インストールされていないオプションパッケージ（liangshen）は skipped と表示され、Apply を妨げません。

**ステップ 5 — トラブルシューティング。** 上のステップが「完了の目安」で終わらなかったときだけ読むセクションです。

- **セッションタイトルの横にボタンが無い。** `dsh --dump-config`（または `dsh --profile desktop --dump-config`）を実行し、body 行に `id: dsh-purge`（`dsh-purge-redteam` ではない）があるか確認します。無ければステップ 2 の `ensure-profile-bundle.mjs` を実行し、ホストを完全に終了して再起動します。このバージョン以降は、起動時にライブのレッドチーム子エントリが欠けている insert も書き込みます — もう一度終了・再起動してください。先頭の `entry "redteam-store" not found` は古いレッドチームパッケージの名残で、無視して構いません。
- **マーケットが `already queued: dsh-purge` と言う。** マーケットのクリックをやめてください。ステップ 2 の `dsh plugin add` か pnpm を再度使います。CLI もすでにあると言う場合は、先に削除してから入れ直し、ステップ 3 をやり直します:

```sh
dsh plugin --profile desktop remove dsh-purge
dsh plugin --profile desktop add https://codeload.github.com/YuJunZhiXue/dsh-purge/tar.gz/refs/heads/master
```

pnpm のみ:

```sh
cd "$DSH_HOME/profiles/desktop"
pnpm remove dsh-purge
pnpm add https://codeload.github.com/YuJunZhiXue/dsh-purge/tar.gz/refs/heads/master
```

Web では `desktop` を `web` に置き換えます。

### その他

**アシスタントに任せる。** 以下のブロックをローカルアシスタントに貼ってください。実行すべきはインストールコマンドのみです — ディスクスキャン、ほかの編集、Apply、再起動はしません。

<details>
<summary><strong>AI アシスタント向け（インストールのみ）</strong></summary>

<!-- AI-AGENT-START -->

DeepSeek Harness プラグイン `dsh-purge` を Web プロファイルのみにインストールしてください。ディスク全体をスキャンしない、ほかのファイルを読み書きしない、設定を適用しない、アプリを再起動しない。desktop プロファイルにはインストールしない。プラグインマーケットプレイスは使わない。この名前は npm レジストリにないので `pnpm add dsh-purge` はしない。

**Web（公式 `dsh web`）**

`dsh` が PATH にある場合:

```sh
dsh plugin --profile web add https://codeload.github.com/YuJunZhiXue/dsh-purge/tar.gz/refs/heads/master
```

`dsh` が無く pnpm がある場合は、`$DSH_HOME/profiles/web`（多くは `~/.dsh/profiles/web`）に `cd` して実行:

```sh
pnpm add https://codeload.github.com/YuJunZhiXue/dsh-purge/tar.gz/refs/heads/master
```

このディレクトリがすでにクローンで `dsh` がある場合は `dsh plugin --profile web add .` を使う。`dsh` も pnpm も無ければ、ユーザーに伝えて停止する。

コマンドが完了したら、`dsh web` を完全に終了して再起動し、セッションタイトル横の **dsh-purge** を開いて **Clean** の **Apply** を押すようユーザーに伝える。その後停止する。

<!-- AI-AGENT-END -->

</details>

<a id="手動"></a>

**手動インストール。** コマンドが失敗する場合、または `dsh` が PATH に無い場合に使います。**実行するホストのプロファイルだけ** を編集してください — もう片方には触れず、既存の bundles を削除しないでください。

<details>
<summary><strong>完全な手動手順</strong></summary>

**1. このホストが使う `$DSH_HOME` を見つける。** 本物のホームは `.dsh`（公式 EXE では `dsh-home` のこともある）という名前で、`profiles` を含み、少なくとも 1 つの `profiles/<name>/package.json` を持ちます。順に確認: `DSH_HOME` 環境変数 → インストールルート横の `.dsh`（ポータブル）→ `%USERPROFILE%\.dsh` または `~/.dsh` → `%APPDATA%` / `%LOCALAPPDATA%\DeepSeek Harness\dsh-home`。確認: `profiles/web/package.json` の `"name"` が `"dsh-profile-web"`（または `dsh-profile-desktop`）であること。マシンにはホームが 2 つあることが多いので、実際に起動するホストのものを使ってください。

候補を一覧する PowerShell:

```powershell
$cands = @()
if ($env:DSH_HOME) { $cands += $env:DSH_HOME }
$cands += "$env:USERPROFILE\.dsh"
$dsh = Get-Command dsh -ErrorAction SilentlyContinue
if ($dsh) {
  $dir = Split-Path $dsh.Source
  $cands += @((Join-Path $dir ".dsh"), (Join-Path (Split-Path $dir) ".dsh"), (Join-Path (Split-Path (Split-Path $dir)) ".dsh"))
}
$cands += @("$env:APPDATA\DeepSeek Harness\dsh-home", "$env:LOCALAPPDATA\DeepSeek Harness\dsh-home")
$cands | Select-Object -Unique | Where-Object { $_ -and (Test-Path (Join-Path $_ "profiles")) }
```

**2. プラグインを `$DSH_HOME/plugins/dsh-purge` に置く**（フォルダ名は `dsh-purge`、`package.json` の `"name"` も `dsh-purge`）。

```sh
git clone https://github.com/YuJunZhiXue/dsh-purge.git "$DSH_HOME/plugins/dsh-purge"
```

git が無い場合: [master.tar.gz](https://github.com/YuJunZhiXue/dsh-purge/archive/refs/heads/master.tar.gz) をダウンロードし、展開して `dsh-purge-master` → `dsh-purge` にリネームし、`plugins` 以下に置きます。すでにクローンがある場合は、いくつかの `.js` ファイルではなくツリー全体をコピーしてください。

**3. そのプロファイルの `package.json` だけを編集する — まずバックアップ。** Web → `$DSH_HOME/profiles/web/package.json`; desktop → `$DSH_HOME/profiles/desktop/package.json`。既存の依存関係と bundle をすべて残したまま、**2 つだけ** 追加します:

1. `dependencies` に `"dsh-purge": "file:../../plugins/dsh-purge"` を追加
2. `dsh.profile.bundles` の **末尾** に `"dsh-purge"` を追加（すでにあればスキップ）

```json
{
  "name": "dsh-profile-web",
  "private": true,
  "dependencies": {
    "dsh-purge": "file:../../plugins/dsh-purge"
  },
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "dsh-purge"
      ],
      "patchReload": "live"
    }
  }
}
```

JSON を有効に保ってください（新しい項目の前にカンマ、最後の項目の後ろには無し）。`file:../../plugins/dsh-purge` を絶対パスに変えない、`patchReload` やほかのプラグインに触れない、`"dsh-purge"` を 2 回並べないこと。desktop に `dsh-web-app` 行が無い場合は追加しないでください。

**4. そのプロファイルだけで `pnpm install` を実行**（リポジトリルートや `$DSH_HOME` ではなくプロファイルディレクトリに `cd`）:

```sh
cd "$DSH_HOME/profiles/web"   # または profiles/desktop
pnpm install
```

成功: `profiles/<web|desktop>/node_modules/dsh-purge/package.json` が存在すること。`pnpm` が無い場合は公式 `dsh` に同梱の Node / pnpm を使います。`Could not resolve` の場合は `file:` パスを再確認、JSON エラーの場合はカンマを直すかバックアップを復元します。

**5. そのホストを完全に終了して再起動し、Apply** — 上のステップ 3 とステップ 4 です。カードはセッションタイトルの横に現れます。そのホストでのみ **Apply**（または `/purge apply`）をクリック。カードが無ければ、おそらく別の `.dsh` を編集しています — 手順 1 に戻ってください。

</details>

**アンインストール。** セッションタイトル横の **dsh-purge** → **Clean** → **Uninstall**。ダイアログを確認: 適用済みパッチを元に戻し、元の Harness を復元し、現在のホストを再起動します。無効化やアンインストールは、まだ `redteam` を指しているエージェントプリセットのデフォルトも `standard` に戻すので、プリセットが消えた後もホストはセッションを作成できます。

<details>
<summary><strong>アンインストールのコマンドと設定</strong></summary>

```sh
# またはターミナル / チャットから
dsh-purge --uninstall
# /purge uninstall
```

プラグイン設定は `cordis.patch.yml` にあります（`postPrompt` はデフォルトで空）:

```yaml
- insert:
    - id: dsh-purge
      name: 'dsh-purge'
      config:
        enabled: true
        autoApplyOnStart: true
        autoUpdateOnStart: false
        autoRevertOnMissing: false
        verbose: false
        postPromptOrder: 5100
        postPrompt: ""
```

</details>

---

## プレビュー

**dsh-purge** はセッションタイトルの横にあります。右ドックを開き、**Clean** と **Drill** の 2 ページがあります。**Light / Ink** を切り替えられます。パッチはグループ化され、カウントには実際に適用された項目のみが含まれます。ルールセットはエディタの上の一覧にあり、各行に Enable と Delete があります。

Drill を初めて開くときは、通知を読み、カウントダウンを待ち、末尾までスクロールして 3 つのチェックボックスにチェックします。Clean にこのステップは不要です。Drill は、あなたが管理するホスト、オフラインターゲット、またはすでに書面による認可のある演習にのみ使えます。

**Clean**

![Clean](docs/preview/dock-clean.png)

**Drill 認可**

![Drill authorization](docs/preview/dock-auth.png)

**Drill**

![Drill](docs/preview/dock-drill.png)

**パッチ**

![Patches](docs/preview/settings.png)

**ローカルラボ**

オープンソース版は localhost / プライベートネットのみ許可します。Clean ページにそう書かれています。公開ホストは登録できません。

| エリア | 表示内容 |
|---|---|
| dsh-purge | セッションタイトル横のボタン。ドックを開閉する |
| Clean | パッチ、プロンプト、ルールセット |
| Drill | 認可後のアセットと環境。このビルドはスキルやナレッジベースを同梱しません。認可までタブは Unauthorized と表示 |
| Patches | グループ化された状況、Apply、Restore、Uninstall |
| Prompt | `prompt-inject.md` をセッションのオーバーライドとして編集 |
| Local lab | ループバック / RFC1918 のみ。名前は解決され、すべてのアドレスがプライベートでなければならない |
| Rule sets | 複数の `AGENTS.md` / `CLAUDE.md`。Enable は `$DSH_HOME` 以下に書き込み、Delete は行を削除 |

---

## レイアウト

`bin/` は CLI、`lib/` はパッチと drill コンソール、`presets/redteam/` はレッドチームプリセット、`client.js` はドックです。このビルドは `skills/` やナレッジベースを同梱しません。

ランタイムファイルは `$DSH_HOME` 以下にあります: `prompt-inject.md`、`rules/`、`redteam/`。`DSH_HOME` が未設定の場合、ランチャー横の `.dsh` が `~/.dsh` より優先されます。Web とデスクトップアプリはそれぞれ独自のホームを使います。

---

## 使い方

```sh
dsh-purge --status
dsh-purge --apply
dsh-purge --revert
dsh-purge --uninstall
dsh-purge --edit

/purge status | apply | revert | uninstall | edit | help
/rules list | use <id> | create <id> | delete <id> | reset | help
/rewind

# 別のプラグインがすでに /rewind（または /purge, /rules, /skills）を
# 所有している場合、その名前はスキップされるか /purge-rewind として
# 再マウントされます。ほかのコマンド、ツール、/dsh-purge/* ルートは動作し続けます。

purge_status   purge_apply   purge_revert
```

Apply が成功すると、パッチ済みパッケージを読み込むためホストが再起動します。手動で **Restart** をクリックすることもできます。パッチタイトルの下に安定版とテスト版があります。テスト版は `beta` ブランチに追従します。**Switch to stable** は `master` をインストールしてピンを解除します。古い安定版を選ぶとそれがピン留めされます。最新に戻すには **Update** をクリック。古いテストタグは一覧されません。

コンポーザの **Undo once** と **Undo last round** は現在の会話内に留まり、ブランチを開きません。送信した行が入力に戻り、そのカットですでに送信されたメッセージと完了したタスクは現在の会話から外れます。編集して **再送信** します。**1.1.61** から、rewind の範囲は最初のユーザーメッセージではなく **現在のターン** に従います。`/rewind` も同じ動作です。

**同じタスクが standard では動くのに minimal や PTC で失敗する** 場合、プリセットの `run_code`、サンドボックス、またはプラン傍受テキストがまだクリアされていないことが多く、あるいは組み込み minimal に `agent-instructions` が欠けています。**1.1.61 以降** を使い、**ホストを完全に終了 → Clean で Apply → 再起動 → 新しいチャットを開始** してください。プリセットを切り替えるだけでは、実行中のプロセスのパッチは再読み込みされません。

### 応答速度

DSH はツールバッチ内の Bash 呼び出しを 1 つずつ実行します。古い dsh-purge リリースはデフォルトのフォアグラウンド待機を 60 秒から 10 分に引き上げていたため、1 つの遅いコマンドが後続の呼び出しをその間ブロックしていました。patch #21 は、マークされたプラグインの値を公式の 60 秒デフォルトに戻します。マークされていないタイムアウトやその他のカスタム値は保持されます。マークのない 10 分の値はユーザー設定と確実に区別できません。

`dsh web`（macOS/Linux）で待機を短くするには、`$DSH_HOME/profiles/web/cordis.patch.yml`（通常 `~/.dsh/profiles/web/cordis.patch.yml`）に次のエントリを追加します。重複を追加せず、同じ id の既存エントリを編集してください。このプロファイル層は同梱設定の後に適用されるので、今後のプラグイン Apply でもオーバーライドが維持されます。

```yaml
- id: bash-sandbox
  config:
    timeoutMs: 10000
```

標準のジョブサービスと `promoteOnTimeout: true` では、未完了のコマンドは 10 秒後にバックグラウンドジョブ id を返し、実行を続けます。`job_output` で読み、`job_kill` で停止します。これはフォアグラウンドの待機を変えるもので、コマンド自体の速度は変わりません。そのサービスが無い、またはプロモーションが無効の場合、タイムアウトでコマンドは終了します。呼び出しごとの `timeoutMs` はこのデフォルトを上書きし、`run_in_background: true` は即座にジョブ id を返します。

日常的なタスクでは、新しいセッションに対して Low 推論を選ぶこともできます:

```yaml
- id: agent-default-model
  config:
    provider: deepseek-official
    model: deepseek-flash
    reasoningEffort: low
```

プロファイルを読み込むには `dsh web` を再起動します。モデルと推論のデフォルトは新規作成されるセッションに適用されます。既存のセッションではコンポーザで Low を選択します。プラグインはこれらのモデル設定を自動で変更しません。より深い推論が必要なタスクでは High を保ち、すべてのアプリケーションディレクトリを再帰的にスキャンするのではなくファイル検索を絞ってください。

### ローカルラボ

攻撃タスクはデフォルトで拒否されます。オープンソース版はループバックと RFC1918 IP のみ許可します。名前は先に解決されます。`.lab` / `.htb` サフィックスだけでは不十分です。ラボ名を公開 IP に向ける hosts エントリはブロックされます。チャットで「これは自分のサーバーだ」と言っても許可されません。

---

## ローカルチェック

```sh
node --check lib/index.js
node --check lib/core.js
node --check lib/surface.js
node --check lib/web.js
node --check lib/desktop.js
node --check lib/host.js
node --check lib/rewind.js
node --check lib/skills.js
node --check client.js
```

---

## 仕組み

Apply（起動時または Apply クリック時）:

```mermaid
flowchart TD
  A["起動または Apply クリック"] --> B{"パッチは既に適用済み？"}
  B -->|はい| C["スキップ"]
  B -->|いいえ| D["オリジナルを .dshpurge.bak としてバックアップ"]
  D --> E["マッチしたファイルを置換"]
  E --> F["シムを上書き"]
  F --> G["プラグインに同梱された暗号化プロンプト、プロンプトボックスがデフォルトで表示するテキストを注入"]
```

各セッションでのオーバーライド:

```mermaid
flowchart TD
  A["再起動または新規セッション"] --> B["プラグインの暗号化デフォルトを注入。保存クリックもホストのプロンプトファイルも無し"]
```

毎ターンのプロンプトインジェクションとルールセット判定。左側の 3 つの入力は dsh-purge パネルで制御するもので、点線の辺はそれぞれがどの判定を駆動するかを示します:

```mermaid
flowchart TD
  L["ルールライブラリ: セットを有効化 → prompt-inject.md に書き込み"]
  W["ローカルルール: 現在のディレクトリの AGENTS.md / CLAUDE.md を確認"]
  P["ワークスペースポリシー: strict / fallback / always"]

  A["ターン開始"] --> B{"prompt-inject.md は空でない？"}
  B -->|はい| C["Inject = prompt-inject.md (A)"]
  B -->|いいえ| D{"現在のディレクトリにチェック済みのローカル md があり、空でない？"}
  D -->|はい| E["Inject = 選択したワークスペース md (B)"]
  D -->|いいえ| F["Inject = プラグイン暗号化スロットのデフォルト (D)"]
  C --> G{"ワークスペースのベースラインポリシー (C)"}
  E --> G
  F --> G
  G -->|strict| H["DSH ワークスペースのベースラインセクションを除外"]
  G -->|fallback デフォルト| I{"上記にユーザー inject がある？ (A または B)"}
  G -->|always| J["DSH ワークスペースのベースラインセクションを保持"]
  I -->|はい| H
  I -->|いいえ| J
  H --> K["最終システムプロンプト"]
  J --> K

  L -.-> B
  W -.-> D
  P -.-> G
```

---

## 復元

- 各ターゲットは最初の apply 前に `<file>.dshpurge.bak` にコピーされます。
- **Restore** または `/purge revert` はバックアップを戻して削除します。バックアップが無い場合は、このプラグインが書いたシム行を取り除きます。
- `prompt-inject.md` はユーザーファイルなので保持されます。
- **Uninstall** はパッチが適用されていればまず復元し、その後 inject ファイル、ルールライブラリ、プラグイン本体を削除します。
- Apply は冪等です。

---

## パス検出

まずホストのサーフェスを検出します: `web` / `desktop`（`gui` / `tui` は予約済みで、なお web にフォールバックします）。

**Web:**

1. `DSH_HOME` / `DSH_BASE`
2. dsh ランチャー横の `.dsh`（ポータブルインストール、任意のドライブ）
3. `npm prefix -g` / `npm root -g`
4. ネストした `@deepseek-ai/dsh/node_modules/@deepseek-ai`
5. `~/.dsh`

**公式デスクトップ EXE:** 実行中の公式 Harness インストール（`resources/app` または展開されたパッケージ）。ドライブレターはハードコードされません。成功した Apply は 1 回再起動します。

Community Desktop はメンテナンスされていません。

公式の npm グローバルはパッチされません。封印された `host-commands` / `runtime-commands` はスクラブされ、注入されることはありません。

何も見つからない場合は `DSH_BASE` / `DSH_DESKTOP_INSTALL` を設定してください。ファイルは変更されません。

---

## リリース

作者の個人チャンネル: [t.me/LLM_PoJia](https://t.me/LLM_PoJia)。メモや更新情報はそこに出ます。GitHub [Releases](https://github.com/YuJunZhiXue/dsh-purge/releases) には古いパッケージもあります。オリジナルの転売は禁止、フォークは帰属表示が必須です。

## 備考

- 対象範囲は、ローカルの `@deepseek-ai/*` パッケージ内のレンダリング済みコピー、デフォルト、ランタイムロジック、および harness ホーム以下のオーバーライドファイルとルールセットです。
- アップグレード後、マッチしないオリジナルは skipped と表示されます。Apply はなお完了し、それらのファイルは変更されません。
- `@deepseek-ai` 外のサードパーティプラグインの *ソースリポジトリ* には手を付けません（CMD サイレンスは、インストール済みの doctor / market / liangshen / mnemon を実行時に **ベストエフォートで** パッチすることがあります）。
- GitHub tarball からインストールしてください（名前は npm にありません。プラグインマーケットはスキップ）。`dsh` あり: `dsh plugin --profile web add https://codeload.github.com/YuJunZhiXue/dsh-purge/tar.gz/refs/heads/master`。pnpm のみ: `$DSH_HOME/profiles/web` 内でその URL を `pnpm add`。EXE には `desktop` を使用。このリポジトリからは `add .`。

---

[LINUX DO](https://linux.do) コミュニティに感謝します
