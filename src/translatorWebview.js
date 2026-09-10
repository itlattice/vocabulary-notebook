const vscode = require('vscode');

class TranslatorWebview {
    constructor() {
        this.panel = null;
    }

    show() {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.One);
            return this.panel;
        }

        this.panel = vscode.window.createWebviewPanel(
            'vocabularyTranslator',
            '翻译器',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.panel.webview.html = this._getHtmlContent();

        this.panel.onDidDispose(() => {
            this.panel = null;
        });

        return this.panel;
    }

    updateTranslation(originalText, translatedText, sourceLanguage, targetLanguage) {
        if (!this.panel) {
            return;
        }

        this.panel.webview.postMessage({
            command: 'updateTranslation',
            data: {
                originalText,
                translatedText,
                sourceLanguage,
                targetLanguage
            }
        });
    }

    _getHtmlContent() {
        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>翻译器</title>
    <style>
        body {
            padding: 20px;
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }

        .container {
            max-width: 800px;
            margin: 0 auto;
        }

        .input-section {
            margin-bottom: 20px;
        }

        .textarea-wrapper {
            position: relative;
            margin-bottom: 10px;
        }

        textarea {
            width: 100%;
            min-height: 120px;
            padding: 10px;
            font-size: 14px;
            line-height: 1.6;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            resize: vertical;
            box-sizing: border-box;
        }

        textarea:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }

        .controls {
            display: flex;
            gap: 10px;
            align-items: center;
            flex-wrap: wrap;
        }

        .language-select {
            display: flex;
            gap: 5px;
            align-items: center;
        }

        select {
            padding: 6px 10px;
            background-color: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            border: 1px solid var(--vscode-dropdown-border);
            border-radius: 4px;
            cursor: pointer;
        }

        button {
            padding: 8px 16px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
        }

        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .result-section {
            margin-top: 30px;
            padding: 20px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 6px;
            display: none;
        }

        .result-section.show {
            display: block;
        }

        .result-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .result-label {
            font-size: 13px;
            opacity: 0.7;
        }

        .result-text {
            font-size: 15px;
            line-height: 1.8;
            white-space: pre-wrap;
            word-break: break-word;
        }

        .action-buttons {
            display: flex;
            gap: 10px;
            margin-top: 15px;
        }

        .secondary-button {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .secondary-button:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }

        .hint {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 5px;
        }

        .loading {
            display: none;
            margin-top: 10px;
            font-size: 13px;
            color: var(--vscode-descriptionForeground);
        }

        .loading.show {
            display: block;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="input-section">
            <div class="textarea-wrapper">
                <textarea id="inputText" placeholder="输入要翻译的内容..."></textarea>
            </div>

            <div class="controls">
                <div class="language-select">
                    <span>目标语言:</span>
                    <select id="targetLanguage">
                        <option value="auto">自动识别→中文</option>
                        <option value="en">翻译为英文</option>
                        <option value="ja">翻译为日语</option>
                    </select>
                </div>

                <button id="translateBtn">翻译</button>
                <button id="clearBtn" class="secondary-button">清空</button>
            </div>

            <div class="hint">
                提示: 自动识别模式下，中文内容将翻译为英文，其他语言翻译为中文
            </div>

            <div id="loading" class="loading">正在翻译...</div>
        </div>

        <div id="resultSection" class="result-section">
            <div class="result-header">
                <span class="result-label" id="resultLabel">翻译结果</span>
            </div>
            <div class="result-text" id="resultText"></div>
            <div class="action-buttons">
                <button id="copyBtn" class="secondary-button">复制结果</button>
                <button id="swapBtn" class="secondary-button">结果反翻译</button>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        const inputText = document.getElementById('inputText');
        const targetLanguage = document.getElementById('targetLanguage');
        const translateBtn = document.getElementById('translateBtn');
        const clearBtn = document.getElementById('clearBtn');
        const loading = document.getElementById('loading');
        const resultSection = document.getElementById('resultSection');
        const resultLabel = document.getElementById('resultLabel');
        const resultText = document.getElementById('resultText');
        const copyBtn = document.getElementById('copyBtn');
        const swapBtn = document.getElementById('swapBtn');

        translateBtn.addEventListener('click', () => {
            const text = inputText.value.trim();
            if (!text) {
                return;
            }

            loading.classList.add('show');
            translateBtn.disabled = true;
            resultSection.classList.remove('show');

            vscode.postMessage({
                command: 'translate',
                text: text,
                targetLanguage: targetLanguage.value
            });
        });

        clearBtn.addEventListener('click', () => {
            inputText.value = '';
            resultSection.classList.remove('show');
            inputText.focus();
        });

        copyBtn.addEventListener('click', () => {
            vscode.postMessage({
                command: 'copyResult',
                text: resultText.textContent
            });
        });

        swapBtn.addEventListener('click', () => {
            inputText.value = resultText.textContent;
            resultSection.classList.remove('show');
            inputText.focus();
        });

        window.addEventListener('message', event => {
            const message = event.data;

            if (message.command === 'updateTranslation') {
                loading.classList.remove('show');
                translateBtn.disabled = false;
                resultSection.classList.add('show');

                const { translatedText, sourceLanguage, targetLanguage } = message.data;
                resultText.textContent = translatedText;

                const langMap = {
                    'zh': '中文',
                    'en': '英文',
                    'ja': '日语'
                };

                resultLabel.textContent = \`翻译结果 (\${langMap[sourceLanguage] || sourceLanguage} → \${langMap[targetLanguage] || targetLanguage})\`;
            }
        });

        inputText.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                translateBtn.click();
            }
        });
    </script>
</body>
</html>`;
    }
}

module.exports = TranslatorWebview;
