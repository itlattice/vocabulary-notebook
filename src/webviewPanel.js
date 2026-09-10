const vscode = require('vscode');

class WordWebviewPanel {
    constructor() {
        this.panel = null;
    }

    show(wordData) {
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
            text-align: center;
        }
        .btn {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 10px 20px;
            font-size: 14px;
            border-radius: 4px;
            cursor: pointer;
            margin: 0 5px;
        }
        .btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .btn-success {
            background-color: var(--vscode-testing-iconPassed);
        }
    </style>
</head>
<body>
    <div class="word-container">
        <div class="word-header">
            <div class="word-title">${wordData.word}</div>
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
            <button class="btn btn-success" onclick="addToNotebook()">记录到单词本</button>
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
    </script>
</body>
</html>`;
    }
}

module.exports = WordWebviewPanel;
