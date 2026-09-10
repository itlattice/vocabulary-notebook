const vscode = require('vscode');
const axios = require('axios');

class LLMService {
    constructor() {
        this.config = vscode.workspace.getConfiguration('vocabularyNotebook.llm');
    }

    async translate(text, type = 'word') {
        const baseUrl = this.config.get('baseUrl');
        const apiKey = this.config.get('apiKey');
        const model = this.config.get('model');

        if (!apiKey) {
            throw new Error('请先配置API Key');
        }

        const prompts = {
            word: this._getWordPrompt(text),
            file: this._getFilePrompt(text)
        };

        try {
            const response = await axios.post(
                `${baseUrl}/chat/completions`,
                {
                    model: model,
                    messages: [
                        {
                            role: 'system',
                            content: '你是一个专业的英语翻译助手。'
                        },
                        {
                            role: 'user',
                            content: prompts[type]
                        }
                    ],
                    temperature: 0.3
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.data) {
                throw new Error('API返回数据为空');
            }

            if (!response.data.choices || response.data.choices.length === 0) {
                throw new Error(`API返回格式错误: ${JSON.stringify(response.data)}`);
            }

            return response.data.choices[0].message.content;
        } catch (error) {
            if (error.response) {
                throw new Error(`API请求失败 (${error.response.status}): ${JSON.stringify(error.response.data)}`);
            } else if (error.request) {
                throw new Error(`网络请求失败，请检查baseUrl配置: ${baseUrl}`);
            } else {
                throw new Error(`翻译失败: ${error.message}`);
            }
        }
    }

    _getWordPrompt(word) {
        return `请分析单词"${word}"，返回JSON格式：
{
  "word": "${word}",
  "phonetic": "音标",
  "meanings": [
    {
      "pos": "词性(n./v./adj.等)",
      "definition": "中文释义"
    }
  ],
  "examples": [
    {
      "en": "英文例句",
      "zh": "中文翻译"
    }
  ]
}

要求：
1. 提供完整音标
2. 列出所有常用词性和释义
3. 每个词性提供1-2个地道例句
4. 只返回JSON，不要其他文字`;
    }

    _getFilePrompt(content) {
        return `请将以下内容翻译为中文，保持原有格式：

${content}`;
    }

    async parseWordResponse(response) {
        try {
            // 尝试提取JSON
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            throw new Error('无法解析返回结果');
        } catch (error) {
            throw new Error(`解析失败: ${error.message}`);
        }
    }
}

module.exports = LLMService;
