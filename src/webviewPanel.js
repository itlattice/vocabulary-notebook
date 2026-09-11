const vscode = require('vscode');

// 使用模块级变量存储 storage，避免实例属性丢失
let moduleStorage = null;

class WordWebviewPanel {
    constructor() {
        this.panel = null;
        this.currentWordData = null;
        this.allWords = [];
        this.currentIndex = -1;
        this.storage = null;
    }

    setStorage(storage) {
        console.log('[WebviewPanel] setStorage called, storage exists:', !!storage);
        this.storage = storage;
        moduleStorage = storage;  // 同时保存到模块级变量
        console.log('[WebviewPanel] this.storage set to:', !!this.storage);
        console.log('[WebviewPanel] moduleStorage set to:', !!moduleStorage);
    }

    show(wordData, allWords = []) {
        console.log('[WebviewPanel] show() called for word:', wordData.word);
        console.log('[WebviewPanel] show() - this.storage exists:', !!this.storage);

        this.currentWordData = wordData;
        this.allWords = allWords;

        // 找到当前单词在列表中的索引
        if (allWords.length > 0) {
            this.currentIndex = allWords.findIndex(w => w.word === wordData.word);
        } else {
            this.currentIndex = -1;
        }

        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Beside);
        } else {
            this.panel = vscode.window.createWebviewPanel(
                'wordDetail',
                '单词详情',
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            this.panel.onDidDispose(() => {
                this.panel = null;
            });
        }

        this.panel.webview.html = this._getHtmlContent(wordData);
        return this.panel;
    }

    updateWord(wordData, allWords = []) {
        this.currentWordData = wordData;
        this.allWords = allWords;

        // 重新计算当前索引
        if (allWords.length > 0) {
            this.currentIndex = allWords.findIndex(w => w.word === wordData.word);
        } else {
            this.currentIndex = -1;
        }

        if (this.panel) {
            this.panel.webview.html = this._getHtmlContent(wordData);
        }
    }

    _getHtmlContent(wordData) {
        const meanings = wordData.meanings.map(m =>
            `<div class="meaning-item">
                <span class="pos">${m.pos}</span>
                <span class="definition">${m.definition}</span>
            </div>`
        ).join('');

        const examples = wordData.examples.map(ex =>
            `<div class="example-item">
                <div class="example-en">${ex.en}</div>
                <div class="example-zh">${ex.zh}</div>
            </div>`
        ).join('');

        // 检查单词是否已在单词本中
        console.log('[WebviewPanel] Checking word:', wordData.word);
        console.log('[WebviewPanel] this.storage exists:', !!this.storage);
        console.log('[WebviewPanel] this._globalStorage exists:', !!this._globalStorage);
        console.log('[WebviewPanel] moduleStorage exists:', !!moduleStorage);

        // 优先使用 moduleStorage，其次 _globalStorage，最后 this.storage
        const storage = moduleStorage || this._globalStorage || this.storage;
        console.log('[WebviewPanel] Using storage:', !!storage);

        const isInNotebook = storage ? storage.hasWord(wordData.word) : false;
        console.log('[WebviewPanel] isInNotebook:', isInNotebook);

        const hasNavigation = this.allWords.length > 0;
        const hasPrev = this.currentIndex > 0;
        const hasNext = this.currentIndex >= 0 && this.currentIndex < this.allWords.length - 1;

        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${wordData.word}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            padding: 20px;
            line-height: 1.6;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        .word-container {
            max-width: 800px;
            margin: 0 auto;
        }
        .word-header {
            border-bottom: 2px solid var(--vscode-panel-border);
            padding-bottom: 15px;
            margin-bottom: 20px;
        }
        .word-title {
            font-size: 32px;
            font-weight: bold;
            margin-bottom: 8px;
            color: var(--vscode-textLink-foreground);
        }
        .word-phonetic {
            font-size: 18px;
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }
        .section {
            margin-bottom: 25px;
        }
        .section-title {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 12px;
            color: var(--vscode-textLink-foreground);
        }
        .meaning-item {
            padding: 8px 0;
            border-bottom: 1px solid var(--vscode-widget-border);
        }
        .meaning-item:last-child {
            border-bottom: none;
        }
        .pos {
            display: inline-block;
            padding: 2px 8px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border-radius: 4px;
            font-size: 12px;
            margin-right: 10px;
            font-weight: bold;
        }
        .definition {
            font-size: 16px;
        }
        .example-item {
            padding: 12px;
            margin-bottom: 10px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 6px;
        }
        .example-en {
            font-size: 15px;
            margin-bottom: 6px;
            color: var(--vscode-editor-foreground);
        }
        .example-zh {
            font-size: 14px;
            color: var(--vscode-descriptionForeground);
        }
        .btn-container {
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid var(--vscode-panel-border);
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 10px;
        }
        .nav-container {
            display: flex;
            gap: 5px;
        }
        .btn {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 10px 20px;
            font-size: 14px;
            border-radius: 4px;
            cursor: pointer;
        }
        .btn:hover:not(:disabled) {
            background-color: var(--vscode-button-hoverBackground);
        }
        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .btn-success {
            background-color: var(--vscode-testing-iconPassed);
        }
        .btn-secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .btn-secondary:hover:not(:disabled) {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .status-badge {
            display: inline-block;
            padding: 4px 10px;
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            border-radius: 12px;
            font-size: 12px;
            margin-left: 10px;
            border: none;
        }
        button.status-badge {
            cursor: pointer;
        }
        button.status-badge:hover {
            opacity: 0.9;
        }
    </style>
</head>
<body>
    <div class="word-container">
        <div class="word-header">
            <div class="word-title">
                ${wordData.word}
                ${isInNotebook ? '<button class="status-badge" onclick="removeFromNotebook()" title="点击取消收藏">✓ 已收藏</button>' : ''}
            </div>
            <div class="word-phonetic">${wordData.phonetic || ''}</div>
        </div>

        <div class="section">
            <div class="section-title">释义</div>
            ${meanings}
        </div>

        <div class="section">
            <div class="section-title">例句</div>
            ${examples}
        </div>

        <div class="btn-container">
            ${hasNavigation ? `
            <div class="nav-container">
                <button class="btn btn-secondary" onclick="previousWord()" ${!hasPrev ? 'disabled' : ''}>← 上一个</button>
                <button class="btn btn-secondary" onclick="nextWord()" ${!hasNext ? 'disabled' : ''}>下一个 →</button>
            </div>
            ` : ''}
            ${!isInNotebook ? '<button class="btn btn-success" onclick="addToNotebook()">记录到单词本</button>' : ''}
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function addToNotebook() {
            vscode.postMessage({
                command: 'addToNotebook',
                data: ${JSON.stringify(wordData)}
            });
        }

        function removeFromNotebook() {
            vscode.postMessage({
                command: 'removeFromNotebook',
                data: {
                    word: ${JSON.stringify(wordData.word)}
                }
            });
        }

        function previousWord() {
            vscode.postMessage({
                command: 'navigateWord',
                direction: 'prev'
            });
        }

        function nextWord() {
            vscode.postMessage({
                command: 'navigateWord',
                direction: 'next'
            });
        }
    </script>
</body>
</html>`;
    }
}

module.exports = WordWebviewPanel;
