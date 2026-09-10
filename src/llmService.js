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
  "word": "单词的标准小写形式（专有名词除外）",
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
1. word字段必须是标准形式：普通单词用小写，专有名词（人名、地名等）保持首字母大写，缩写词保持全大写
2. 提供完整音标
3. 列出所有常用词性和释义
4. 每个词性提供1-2个地道例句
5. 只返回JSON，不要其他文字`;
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
                const wordData = JSON.parse(jsonMatch[0]);

                // 后处理：确保普通单词是小写的
                if (wordData.word && /^[A-Z][a-z]+(-[a-z]+)?$/.test(wordData.word)) {
                    // 首字母大写的单词，检查是否是常见专有名词
                    const properNouns = ['api', 'http', 'html', 'css', 'javascript', 'python', 'java'];
                    const lowerWord = wordData.word.toLowerCase();

                    // 如果不在专有名词列表中，转为小写
                    if (!properNouns.includes(lowerWord)) {
                        // 简单判断：如果单词长度 > 8 或者不像人名，转为小写
                        if (wordData.word.length > 8 || !this._isLikelyProperNoun(wordData.word)) {
                            wordData.word = lowerWord;
                        }
                    }
                }

                return wordData;
            }
            throw new Error('无法解析返回结果');
        } catch (error) {
            throw new Error(`解析失败: ${error.message}`);
        }
    }

    /**
     * 简单判断是否可能是专有名词
     * @private
     */
    _isLikelyProperNoun(word) {
        // 常见人名特征：首字母大写，3-10个字母，且不是常见的普通单词
        const commonWords = ['logistics', 'management', 'business', 'development', 'marketing',
                           'service', 'quality', 'customer', 'product', 'process'];
        return word.length >= 3 && word.length <= 10 && !commonWords.includes(word.toLowerCase());
    }

    /**
     * 通用翻译方法，支持自动语言检测
     * @param {string} text - 要翻译的文本
     * @param {string} targetLang - 目标语言: 'auto'(自动), 'en', 'ja'
     * @returns {Promise<{translatedText: string, sourceLanguage: string, targetLanguage: string}>}
     */
    async translateText(text, targetLang = 'auto') {
        const baseUrl = this.config.get('baseUrl');
        const apiKey = this.config.get('apiKey');
        const model = this.config.get('model');

        if (!apiKey) {
            throw new Error('请先配置API Key');
        }

        // 检测源语言
        const sourceLanguage = this._detectLanguage(text);

        // 根据自动模式确定目标语言
        let actualTargetLang = targetLang;
        if (targetLang === 'auto') {
            actualTargetLang = sourceLanguage === 'zh' ? 'en' : 'zh';
        }

        const prompt = this._getTranslationPrompt(text, sourceLanguage, actualTargetLang);

        try {
            const response = await axios.post(
                `${baseUrl}/chat/completions`,
                {
                    model: model,
                    messages: [
                        {
                            role: 'system',
                            content: '你是一个专业的多语言翻译助手，擅长中文、英文和日语的翻译。'
                        },
                        {
                            role: 'user',
                            content: prompt
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

            if (!response.data || !response.data.choices || response.data.choices.length === 0) {
                throw new Error('API返回格式错误');
            }

            const translatedText = response.data.choices[0].message.content.trim();

            return {
                translatedText,
                sourceLanguage,
                targetLanguage: actualTargetLang
            };

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

    /**
     * 提取文本中的关键词
     * @param {string} text - 原文本
     * @param {string} translatedText - 翻译后文本
     * @returns {Promise<Array<string>>} - 关键词列表
     */
    async extractKeywords(text, translatedText) {
        const baseUrl = this.config.get('baseUrl');
        const apiKey = this.config.get('apiKey');
        const model = this.config.get('model');

        const prompt = `请从以下文本中提取3-5个最重要的英文关键词（单词），只返回单词列表，用逗号分隔，不要其他内容。

原文: ${text}
翻译: ${translatedText}

只返回英文单词，格式如: word1, word2, word3`;

        try {
            const response = await axios.post(
                `${baseUrl}/chat/completions`,
                {
                    model: model,
                    messages: [
                        {
                            role: 'user',
                            content: prompt
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

            if (!response.data || !response.data.choices || response.data.choices.length === 0) {
                throw new Error('API返回格式错误');
            }

            const result = response.data.choices[0].message.content.trim();
            // 解析关键词列表
            const keywords = result.split(',').map(w => w.trim()).filter(w => w && /^[a-zA-Z]+$/.test(w));

            return keywords;

        } catch (error) {
            console.error('提取关键词失败:', error);
            return [];
        }
    }

    /**
     * 检测文本语言
     * @param {string} text
     * @returns {string} 'zh', 'en', 'ja', 'other'
     */
    _detectLanguage(text) {
        const chineseChars = text.match(/[一-龥]/g);
        const japaneseChars = text.match(/[぀-ゟ゠-ヿ]/g);
        const englishChars = text.match(/[a-zA-Z]/g);

        const chineseRatio = chineseChars ? chineseChars.length / text.length : 0;
        const japaneseRatio = japaneseChars ? japaneseChars.length / text.length : 0;
        const englishRatio = englishChars ? englishChars.length / text.length : 0;

        if (chineseRatio > 0.3) return 'zh';
        if (japaneseRatio > 0.2) return 'ja';
        if (englishRatio > 0.5) return 'en';

        return 'other';
    }

    /**
     * 生成翻译prompt
     */
    _getTranslationPrompt(text, sourceLang, targetLang) {
        const langNames = {
            'zh': '中文',
            'en': '英文',
            'ja': '日语'
        };

        let instruction = `请将以下${langNames[sourceLang] || sourceLang}内容翻译为${langNames[targetLang] || targetLang}，要求：
1. 翻译准确、流畅、自然
2. 保持原文的语气和风格
3. 只返回翻译结果，不要添加任何解释`;

        // 如果翻译为英文且原文是单个词，要求返回小写
        if (targetLang === 'en' && this.isSingleWord(text)) {
            instruction += `\n4. 如果翻译结果是普通单词，必须全部小写（专有名词、缩写除外）`;
        }

        return `${instruction}

原文：
${text}`;
    }

    /**
     * 判断文本是否为单个单词
     * @param {string} text
     * @returns {boolean}
     */
    isSingleWord(text) {
        const trimmed = text.trim();
        // 判断是否为单个英文单词（可能包含连字符）
        return /^[a-zA-Z]+(-[a-zA-Z]+)?$/.test(trimmed) && !trimmed.includes(' ');
    }
}

module.exports = LLMService;
