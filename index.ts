// 型定義
interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string | ClaudeContent[];
}

interface ClaudeContent {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: any;
  tool_use_id?: string;
  content?: string;
}

interface ClaudeResponse {
  content: ClaudeContent[];
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

// MCPツールのMock定義
const mockMcpTools = {
  tools: [
    {
      name: "get_weather",
      description: "指定された都市の現在の天気情報を取得します",
      inputSchema: {
        type: "object",
        properties: {
          city: {
            type: "string",
            description: "天気を調べたい都市名（例：東京、大阪）"
          },
          unit: {
            type: "string",
            enum: ["celsius", "fahrenheit"],
            description: "温度の単位",
            default: "celsius"
          }
        },
        required: ["city"]
      }
    },
    {
      name: "search_database",
      description: "顧客データベースを検索して情報を取得します",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "検索クエリ"
          },
          table: {
            type: "string",
            enum: ["customers", "orders", "products"],
            description: "検索対象のテーブル"
          },
          limit: {
            type: "number",
            description: "取得する最大件数",
            default: 10
          }
        },
        required: ["query", "table"]
      }
    }
  ]
};

// MCPツール実行結果のMock
const mockToolResults = {
  "get_weather": (args: any) => ({
    content: [{
      type: "text",
      text: `${args.city}の現在の天気：晴れ、気温25°C、湿度60%、風速3m/s`
    }],
    isError: false
  }),
  "search_database": (args: any) => ({
    content: [{
      type: "text", 
      text: `${args.table}テーブルから"${args.query}"で検索した結果：3件見つかりました。\n1. 田中太郎 (ID: 001)\n2. 佐藤花子 (ID: 002)\n3. 山田次郎 (ID: 003)`
    }],
    isError: false
  })
};

// Mock MCPクライアント
class MockMcpClient {
  async listTools() {
    console.log('🔧 Mock: MCPツール一覧を取得中...');
    return mockMcpTools;
  }

  async callTool(params: { name: string; arguments: any }) {
    console.log(`🛠️ Mock: ツール "${params.name}" を実行中...`);
    console.log('📥 引数:', JSON.stringify(params.arguments, null, 2));
    
    const result = mockToolResults[params.name as keyof typeof mockToolResults]?.(params.arguments);
    console.log('📤 実行結果:', result);
    return result;
  }
}

// Claude API統合クラス
class ClaudeAppWithMcp {
  private mcpClient: MockMcpClient;
  private apiKey: string;

  constructor(apiKey: string) {
    this.mcpClient = new MockMcpClient();
    this.apiKey = apiKey;
  }

  async processWithTools(query: string) {
    console.log(`\n🚀 処理開始: "${query}"`);
    
    try {
      // 1. MCPツール情報取得（Mock）
      console.log('\n📋 ステップ1: MCPツール情報取得');
      const mcpTools = await this.mcpClient.listTools();
      console.log(`✅ ${mcpTools.tools.length}個のツールを取得`);

      const opt = {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-beta': 'tools-2024-04-04'  // ツール使用のためのベータ機能
        },
        body: JSON.stringify({
          model: "claude-3-7-sonnet-20250219",
          max_tokens: 1024,
          messages: [{ 
            role: "user", 
            content: query 
          }],
          tools: mcpTools.tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.inputSchema
          }))
        }, null, 2)
      };

      // 2. Messages APIにツール定義と共に送信
      console.log('\n🌐 ステップ2: Claude Messages API呼び出し', opt.body);

      const initialResponse = await fetch('https://api.anthropic.com/v1/messages', opt);

      if (!initialResponse.ok) {
        throw new Error(`Claude API Error: ${initialResponse.status} ${initialResponse.statusText}`);
      }

      const result = await initialResponse.json() as ClaudeResponse;
      console.log('📨 Claude APIレスポンス受信');
      console.log('🎯 レスポンス内容:', JSON.stringify(result, null, 2));

      // 3. ツール使用の確認と実行
      const toolUseBlocks = result.content.filter((c: ClaudeContent) => c.type === 'tool_use');
      
      if (toolUseBlocks.length > 0) {
        console.log(`\n🔨 ステップ3: ${toolUseBlocks.length}個のツール実行`);
        
        // MCPツール実行
        const toolResults = await Promise.all(
          toolUseBlocks.map(async (toolUse: ClaudeContent) => {
            console.log(`\n⚙️ ツール実行: ${toolUse.name}`);
            const mcpResult = await this.mcpClient.callTool({
              name: toolUse.name!,
              arguments: toolUse.input
            });
            
            return {
              type: "tool_result" as const,
              tool_use_id: toolUse.id!,
              content: mcpResult.content[0].text
            };
          })
        );

        // 4. 再度Messages APIを呼び出し（ツール結果と共に）
        console.log('\n🔄 ステップ4: ツール結果と共に再度Claude API呼び出し');
        const finalResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
            'anthropic-beta': 'tools-2024-04-04'
          },
          body: JSON.stringify({
            model: "claude-3-7-sonnet-20250219",
            max_tokens: 1024,
            messages: [
              { role: "user", content: query },
              { role: "assistant", content: result.content },
              { role: "user", content: toolResults }
            ] as ClaudeMessage[]
          })
        });

        if (!finalResponse.ok) {
          throw new Error(`Claude API Error: ${finalResponse.status} ${finalResponse.statusText}`);
        }

        const finalResult = await finalResponse.json() as ClaudeResponse;
        console.log('\n🏁 最終結果:');
        console.log(JSON.stringify(finalResult, null, 2));
        
        return finalResult;
      } else {
        console.log('\n❌ ツール使用なし - 通常の回答');
        return result;
      }

    } catch (error) {
      console.error('❌ エラーが発生しました:', error);
      throw error;
    }
  }
}

// 使用例とテスト
async function testMcpWithClaude() {
  const apiKey = process.env.ANTHROPIC_API_KEY || 'your-api-key-here';
  
  if (apiKey === 'your-api-key-here') {
    console.log('⚠️ 注意: ANTHROPIC_API_KEYを設定してください');
    console.log('💡 テスト用にMockモードで実行します\n');
  }

  const app = new ClaudeAppWithMcp(apiKey);

  // テストケース
  const testQueries = [
    "東京の天気を教えて",
    "顧客データベースで「田中」を検索して"
  ];

  for (const query of testQueries) {
    console.log('\n' + '='.repeat(60));
    try {
      await app.processWithTools(query);
    } catch (error) {
      console.error(`クエリ "${query}" でエラー:`, error);
    }
    console.log('='.repeat(60));
    
    // 次のテストまで少し待機
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// 直接実行用の関数
function isMainModule(): boolean {
  // CommonJS環境での直接実行チェック
  return require.main === module;
}

// エクスポート
export { 
  ClaudeAppWithMcp, 
  MockMcpClient, 
  mockMcpTools, 
  mockToolResults,
  testMcpWithClaude 
};

// 直接実行された場合のテスト
if (isMainModule()) {
  testMcpWithClaude().catch(console.error);
}
