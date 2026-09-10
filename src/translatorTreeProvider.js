const vscode = require('vscode');

class TranslatorTreeProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this._view = null;
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    resolveTreeView(view) {
        this._view = view;
    }

    getTreeItem(element) {
        return element;
    }

    getChildren() {
        // 返回空数组，因为我们使用 webview
        return [];
    }
}

module.exports = TranslatorTreeProvider;
