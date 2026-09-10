const vscode = require('vscode');
const LLMService = require('./src/llmService');
const VocabularyStorage = require('./src/storage');
const VocabularyTreeDataProvider = require('./src/treeDataProvider');
const WordWebviewPanel = require('./src/webviewPanel');
const fs = require('fs');

let storage;
let treeDataProvider;
let webviewPanel;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	console.log('vocabulary-notebook 插件已激活');

	// 初始化存储
	storage = new VocabularyStorage(context);

	// 初始化树视图
	treeDataProvider = new VocabularyTreeDataProvider(storage);
	vscode.window.registerTreeDataProvider('vocabularyNotebook', treeDataProvider);

	// 初始化webview
	webviewPanel = new WordWebviewPanel();

	// 学习单词命令
	context.subscriptions.push(
		vscode.commands.registerCommand('vocabulary-notebook.learnWord', async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				return;
			}

			const selection = editor.selection;
			const word = editor.document.getText(selection).trim();

			if (!word) {
				vscode.window.showWarningMessage('请先选中一个单词');
				return;
			}

			await learnWord(word);
		})
	);

	// 翻译文件命令
	context.subscriptions.push(
		vscode.commands.registerCommand('vocabulary-notebook.translateFile', async (uri) => {
			if (!uri) {
				const editor = vscode.window.activeTextEditor;
				if (!editor) {
					return;
				}
				uri = editor.document.uri;
			}

			await translateFile(uri);
		})
	);

	// 打开单词详情
	context.subscriptions.push(
		vscode.commands.registerCommand('vocabulary-notebook.openNotebook', async (word) => {
			if (word) {
				const wordData = storage.getWord(word);
				if (wordData) {
					const panel = webviewPanel.show(wordData);

					// 处理webview消息
					panel.webview.onDidReceiveMessage(
						message => {
							if (message.command === 'addToNotebook') {
								storage.addWord(message.data);
								treeDataProvider.refresh();
								vscode.window.showInformationMessage(`已将 "${message.data.word}" 添加到单词本`);
							}
						}
					);
				}
			}
		})
	);

	// 手动添加单词
	context.subscriptions.push(
		vscode.commands.registerCommand('vocabulary-notebook.addWord', async () => {
			const word = await vscode.window.showInputBox({
				prompt: '请输入要添加的单词',
				placeHolder: 'example'
			});

			if (word) {
				await learnWord(word);
			}
		})
	);

	// 删除单词
	context.subscriptions.push(
		vscode.commands.registerCommand('vocabulary-notebook.deleteWord', async (item) => {
			const word = item.label;
			const confirm = await vscode.window.showWarningMessage(
				`确定要删除单词 "${word}" 吗？`,
				'确定', '取消'
			);

			if (confirm === '确定') {
				storage.deleteWord(word);
				treeDataProvider.refresh();
				vscode.window.showInformationMessage(`已删除单词 "${word}"`);
			}
		})
	);

	// 刷新单词本
	context.subscriptions.push(
		vscode.commands.registerCommand('vocabulary-notebook.refreshNotebook', () => {
			treeDataProvider.refresh();
		})
	);
}

async function learnWord(word) {
	try {
		vscode.window.showInformationMessage(`正在查询单词 "${word}"...`);

		const llmService = new LLMService();
		const response = await llmService.translate(word, 'word');
		const wordData = await llmService.parseWordResponse(response);

		// 显示webview
		const panel = webviewPanel.show(wordData);

		// 处理webview消息
		panel.webview.onDidReceiveMessage(
			message => {
				if (message.command === 'addToNotebook') {
					storage.addWord(message.data);
					treeDataProvider.refresh();
					vscode.window.showInformationMessage(`已将 "${message.data.word}" 添加到单词本`);
				}
			}
		);

	} catch (error) {
		vscode.window.showErrorMessage(`查询失败: ${error.message}`);
	}
}

async function translateFile(uri) {
	try {
		const ext = uri.fsPath.split('.').pop().toLowerCase();
		if (!['txt', 'md'].includes(ext)) {
			vscode.window.showWarningMessage('仅支持翻译 .txt 和 .md 文件');
			return;
		}

		vscode.window.showInformationMessage('正在翻译文件...');

		const content = fs.readFileSync(uri.fsPath, 'utf-8');

		const llmService = new LLMService();
		const translated = await llmService.translate(content, 'file');

		// 创建新文档显示翻译结果
		const doc = await vscode.workspace.openTextDocument({
			content: translated,
			language: 'markdown'
		});

		await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
		vscode.window.showInformationMessage('翻译完成');

	} catch (error) {
		vscode.window.showErrorMessage(`翻译失败: ${error.message}`);
	}
}

function deactivate() {
	if (storage) {
		storage.close();
	}
}

module.exports = {
	activate,
	deactivate
}
