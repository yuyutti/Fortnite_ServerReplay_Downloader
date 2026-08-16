## 🌐 Language

- [English](./README.md)
- [日本語](./README.ja.md)

# Fortnite Server Replay Downloader

Fortnite の **サーバーリプレイ（.replay）** を  
Epic Games のサーバーから直接ダウンロードする Node.js ライブラリ / CLI ツールです。

---

## 特徴

- ✅ Fortnite サーバーリプレイを直接ダウンロード
- ✅ Windows / Linux / macOS 対応
- ✅ CLI / ライブラリ 両対応
- ✅ .replay を **そのまま保存** or **Buffer として取得**
- ✅ 進捗コールバック対応

---

## インストール

### npm（ライブラリとして）

```bash  
npm install fortnite-serverreplay-downloader@latest  
```

### npx（CLIとして）

```bash  
npx fortnite-serverreplay-downloader <matchId>  
```

---

## 使い方（CLI）

### 基本

```bash  
npx fortnite-serverreplay-downloader <matchId>  
```

- デフォルト保存先  
  - ~/Downloads/replay-files/

### 保存先を指定

```bash  
npx fortnite-serverreplay-downloader <matchId> ./replays  
```

同時ダウンロード数のデフォルトは `16` です。回線やCDNの状態に応じて変更できます。

```bash
npx fortnite-serverreplay-downloader <matchId> ./replays --concurrency 6
```

チャンク取得にはデフォルトで `needle` を使用します。Node.js標準の`fetch`とも比較できます。

```bash
npx fortnite-serverreplay-downloader <matchId> ./replays --http-client fetch
```

### グローバルインストール

```bash  
npm install -g fortnite-serverreplay-downloader  
fortnite-serverreplay-downloader <matchId>  
```

---

## 使い方（ライブラリ）

### .replay を保存する（おすすめ）

```js  
const { saveReplay } = require("fortnite-serverreplay-downloader");

(async () => {
    const filePath = await saveReplay({
        matchId: "39610d978fe442ecb8729e24592f868a",
        outputDir: "./replays",
        maxConcurrentDownloads: 16,
    });

    console.log("Saved:", filePath);
})();
```

---

### 進捗を表示する

```js  
const { saveReplay } = require("fortnite-serverreplay-downloader");

await saveReplay({
    matchId: "39610d978fe442ecb8729e24592f868a",
    outputDir: "./replays",
    updateCallback: (data) => {
        process.stdout.write(
            `Data ${data.dataChunks.current}/${data.dataChunks.max}`
        );
    },
});

console.log("Download complete");
```

---

### .replay を Buffer として取得する（上級者向け）

```js  
const fs = require("fs");
const path = require("path");
const { downloadReplay } = require("fortnite-serverreplay-downloader");

(async () => {
    const buffer = await downloadReplay({
        matchId: "39610d978fe442ecb8729e24592f868a",
    });

    fs.mkdirSync("./replays", { recursive: true });

    const savePath = path.join(
        "./replays",
        "TournamentMatch.replay"
    );

    await fs.promises.writeFile(savePath, buffer);
})();
```

---

## API

### saveReplay(options)

```ts  
saveReplay({
    matchId: string,
    outputDir: string,
    maxConcurrentDownloads?: number,
    httpClient?: "needle" | "fetch",
    updateCallback?: (progress) => void,
    debugCallback?: (event) => void,
    fileName?: string,
    checkpointCount?: number,
    dataCount?: number,
    eventCount?: number,
}) => Promise<string>
```

- .replay をダウンロードして保存
- HTTPレスポンスを一時ファイルへ直接ストリーミングし、全チャンクをメモリに保持せずに保存
- `maxConcurrentDownloads` のデフォルトは `16`（1以上の整数）
- `httpClient` のデフォルトは `needle`。比較用に`fetch`も選択可能
- `debugCallback`でHTTPバージョン、所要時間、リトライ、エラーを取得可能
- 戻り値：保存されたファイルパス

---

### downloadReplay(options)

```ts  
downloadReplay({
    matchId: string,
    maxConcurrentDownloads?: number,
    httpClient?: "needle" | "fetch",
    updateCallback?: (progress) => void,
    debugCallback?: (event) => void,
}) => Promise<Buffer>
```

- .replay を **Buffer として取得**
- `maxConcurrentDownloads` のデフォルトは `16`（1以上の整数）
- 保存処理は行わない

HTTPデバッグイベントに含まれるURLからは、署名クエリなどの検索パラメータが除去されます。

---

## matchId について

- ハイフン付き / なし、どちらも使用可能
- 内部で正規化されます
- 正規化後は **32文字** 必須

例：

39610d97-8fe4-42ec-b872-9e24592f868a

---

## 注意事項（重要）

- 本ツールで取得できるのは **トーナメントモードのマッチID**、  
  もしくは **大会（イベント）のマッチID** に対応するサーバーリプレイのみです。
- 通常のスクワッド / デュオ / ソロ / ランクマッチは、  
  **マッチIDが存在していてもサーバーリプレイが保存されていないため取得できません。**
- **トーナメントモードのカスタムマッチ**は取得可能です。
- **それ以外のカスタムマッチ**は取得できません。

---

## リプレイ保存期間について

- Epic Games 側で **サーバーリプレイの保存期間**が設定されています。
- 目安として **1〜2週間以内のマッチ**でないと取得できない場合があります。
- Fortnite のアップデートやサーバー側の変更により、  
  保存期間内であっても **サーバーリプレイが予告なく削除（ワイプ）される可能性**があります。

---

## 免責事項

- Fortnite のアップデートにより、本ツールの挙動が変更・破損する可能性があります。
- 本ツールの利用により発生したいかなる問題についても、  
  **開発者は一切の責任を負いません。**
- 本ツールは Epic Games および Fortnite 公式とは無関係の非公式ツールです。

---

## フォーク関係について

本プロジェクトは、以下のフォークツリーを元に開発されています。

- 元リポジトリ  
  [https://github.com/xNocken/replay-downloader](https://github.com/xNocken/replay-downloader)
- フォーク  
  [https://github.com/qKuafn/replay-downloader](https://github.com/qKuafn/replay-downloader)
- さらにフォーク  
  [https://github.com/yuyutti/replay-downloader](https://github.com/yuyutti/replay-downloader)
- npm 向けとして再構成・公開  
  [https://github.com/yuyutti/Fortnite_ServerReplay_Downloader](https://github.com/yuyutti/Fortnite_ServerReplay_Downloader)

---

## ライセンス

MIT License

---

## 作者

- GitHub: [https://github.com/yuyutti](https://github.com/yuyutti)  
- Inspired by: [https://github.com/xNocken/replay-downloader](https://github.com/xNocken/replay-downloader)
