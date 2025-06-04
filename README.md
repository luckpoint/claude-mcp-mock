# Claude MCP統合サンプル

Claude APIとMCP（Model Context Protocol）ツールを統合したシステムの学習用サンプル実装です。

## 概要

このプロジェクトは、Claude APIのTools機能を使ってMCPツールと連携する方法を学ぶためのサンプルコードです。
実際のMCPサーバーの代わりにMockを使用しているため、すぐに動作を確認できます。

## アーキテクチャ

```
ユーザークエリ
    ↓
1. MCPツール一覧取得
    ↓
2. Claude APIにツール定義付きでリクエスト
    ↓
3. Claudeがツール使用を判断
    ↓
4. MCPツール実行（必要に応じて）
    ↓
5. ツール結果をClaudeに送信
    ↓
6. 最終回答生成
```

## 処理フロー詳細

### 1. ツール定義の取得
MockMcpClientからツール一覧と各ツールのJSON Schema定義を取得

### 2. Claude API呼び出し
取得したツール定義をClaude APIに送信し、ユーザーのクエリを処理

### 3. ツール実行判定
Claudeがレスポンスでツール使用を指定した場合、該当するMCPツールを実行

### 4. 結果統合
ツール実行結果をClaudeに送り返し、最終的な回答を生成

## 技術仕様

### 使用API
- **Claude Messages API**: Anthropic社のClaude APIのメッセージエンドポイント

### 型定義
- **ClaudeMessage**: メッセージ形式
- **ClaudeContent**: メッセージ内容（テキスト、ツール使用、ツール結果）
- **ClaudeResponse**: APIレスポンス形式

## セットアップ

### 環境変数の設定
```bash
export ANTHROPIC_API_KEY="your-actual-api-key"
```

### 依存関係
- Node.js
- TypeScript
- fetch API（Node.js 18+または適切なpolyfill）

## サンプル出力

```
🚀 処理開始: "東京の天気を教えて"

📋 ステップ1: MCPツール情報取得
✅ 2個のツールを取得

🌐 ステップ2: Claude Messages API呼び出し

📨 Claude APIレスポンス受信

🔨 ステップ3: 1個のツール実行

⚙️ ツール実行: get_weather
📥 引数: {"city": "東京"}
📤 実行結果: 東京の現在の天気：晴れ、気温25°C、湿度60%、風速3m/s

🔄 ステップ4: ツール結果と共に再度Claude API呼び出し

🏁 最終結果: [Claude APIからの最終回答]
```

## ライセンス

MIT License
このサンプルコードは学習目的で作成されており、MITライセンスの下で自由に使用、修正、配布できます。

## 参考資料

- [Anthropic Claude API Documentation](https://docs.anthropic.com)
- [Model Context Protocol Specification](https://modelcontextprotocol.io)
- [Claude Tools API Beta Documentation](https://docs.anthropic.com/en/docs/build-with-claude/tool-use)
