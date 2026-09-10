const vscode = require('vscode');

class VocabularyTreeDataProvider {
    constructor(storage) {
        this.storage = storage;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element) {
        return element;
    }

    getChildren(element) {
        if (!element) {
            // 根节点，返回所有单词
            const words = this.storage.getAllWords();

            // 按a-z排序
            words.sort((a, b) => a.word.toLowerCase().localeCompare(b.word.toLowerCase()));

            return words.map(word => {
                const item = new vscode.TreeItem(
                    word.word,
                    vscode.TreeItemCollapsibleState.None
                );
                item.contextValue = 'word';

                // 提取第一个释义作为描述
                const firstMeaning = word.meanings && word.meanings.length > 0
                    ? word.meanings[0].definition
                    : '';

                item.tooltip = `${word.phonetic}\n${word.meanings.map(m => `${m.pos} ${m.definition}`).join('\n')}`;
                item.description = firstMeaning;
                item.command = {
                    command: 'vocabulary-notebook.openNotebook',
                    title: '查看单词详情',
                    arguments: [word.word]
                };
                return item;
            });
        }
        return [];
    }
}

module.exports = VocabularyTreeDataProvider;
