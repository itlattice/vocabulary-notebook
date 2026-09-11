const vscode = require('vscode');
const LLMService = require('./src/llmService');
const VocabularyStorage = require('./src/storage');
const VocabularyTreeDataProvider = require('./src/treeDataProvider');
const WordWebviewPanel = require('./src/webviewPanel');
const ImportExportService = require('./src/importExportService');
const fs = require('fs');

let storage;
let treeDataProvider;
let webviewPanel;
let importExportService;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	console.log('[Extension] vocabulary-notebook 插件开始激活...');

	// 初始化存储
	storage = new VocabularyStorage(context);
	console.log('[Extension] Storage initialized:', !!storage);

	// 初始化树视图
	treeDataProvider = new VocabularyTreeDataProvider(storage);
	vscode.window.registerTreeDataProvider('vocabularyNotebook', treeDataProvider);
	console.log('[Extension] TreeDataProvider registered');

	// 初始化webview（如果已存在则重新设置storage）
	if (!webviewPanel) {
		webviewPanel = new WordWebviewPanel();
		console.log('[Extension] New WordWebviewPanel created');
	} else {
		console.log('[Extension] WordWebviewPanel already exists, reusing');
	}

	// 直接将 storage 作为参数传递，而不是存储在实例中
	webviewPanel.setStorage(storage);
	console.log('[Extension] WebviewPanel storage set:', !!storage);

	// 同时在全局保存 storage 引用，供 webviewPanel 使用
	webviewPanel._globalStorage = storage;

	// 初始化导入导出服务
	importExportService = new ImportExportService(storage);
	console.log('[Extension] ImportExportService initialized');
	const translatorView = vscode.window.registerWebviewViewProvider(
		'vocabularyTranslator',
		{
			resolveWebviewView: (webviewView) => {
				webviewView.webview.options = {
					enableScripts: true
				};
				webviewView.webview.html = getTranslatorWebviewContent();

				// 处理webview消息
				webviewView.webview.onDidReceiveMessage(async message => {
					if (message.command === 'translate') {
						await handleTranslation(message.text, message.targetLanguage, webviewView.webview);
					} else if (message.command === 'copyResult') {
						await vscode.env.clipboard.writeText(message.text);
						vscode.window.showInformationMessage('已复制到剪贴板');
					}
				});
			}
		}
	);
	context.subscriptions.push(translatorView);

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
			console.log('[Extension] openNotebook command called for word:', word);
			console.log('[Extension] webviewPanel exists:', !!webviewPanel);
			console.log('[Extension] webviewPanel.storage exists:', webviewPanel ? !!webviewPanel.storage : 'N/A');

			if (word) {
				const wordData = storage.getWord(word);
				if (wordData) {
					// 获取所有单词用于导航
					const allWords = storage.getAllWords();
					const panel = webviewPanel.show(wordData, allWords);

					// 处理webview消息
					panel.webview.onDidReceiveMessage(
						message => {
							if (message.command === 'addToNotebook') {
								storage.addWord(message.data);
								treeDataProvider.refresh();
								// 刷新webview显示，传入所有单词以保持导航功能
								const allWords = storage.getAllWords();
								webviewPanel.updateWord(message.data, allWords);
								vscode.window.showInformationMessage(`已将 "${message.data.word}" 添加到单词本`);
							} else if (message.command === 'navigateWord') {
								const allWords = storage.getAllWords();
								const currentIndex = allWords.findIndex(w => w.word === wordData.word);

								let nextIndex = currentIndex;
								if (message.direction === 'prev') {
									nextIndex = currentIndex > 0 ? currentIndex - 1 : allWords.length - 1;
								} else if (message.direction === 'next') {
									nextIndex = currentIndex < allWords.length - 1 ? currentIndex + 1 : 0;
								}

								const nextWord = allWords[nextIndex];
								webviewPanel.show(nextWord, allWords);
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

	// 打开翻译器（废弃，现在使用侧边栏webview）
	context.subscriptions.push(
		vscode.commands.registerCommand('vocabulary-notebook.openTranslator', async () => {
			vscode.window.showInformationMessage('请使用左侧"翻译"视图进行翻译');
		})
	);

	// 导出单词本
	context.subscriptions.push(
		vscode.commands.registerCommand('vocabulary-notebook.exportData', async () => {
			await importExportService.exportData();
		})
	);

	// 导入单词本
	context.subscriptions.push(
		vscode.commands.registerCommand('vocabulary-notebook.importData', async () => {
			await importExportService.importData();
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

		// 显示webview（不传allWords，因为这不是从单词本打开的）
		const panel = webviewPanel.show(wordData);

		// 处理webview消息
		panel.webview.onDidReceiveMessage(
			message => {
				if (message.command === 'addToNotebook') {
					storage.addWord(message.data);
					treeDataProvider.refresh();
					// 刷新webview显示（不需要传 allWords，因为这是从学习单词打开的）
					webviewPanel.updateWord(message.data, []);
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

/**
 * 处理翻译请求
 */
async function handleTranslation(text, targetLanguage, webview) {
	try {
		const llmService = new LLMService();
		const config = vscode.workspace.getConfiguration('vocabularyNotebook.translator');

		// 判断是否为单个单词
		const isSingleWord = llmService.isSingleWord(text.trim());

		// 执行翻译
		const result = await llmService.translateText(text, targetLanguage);

		// 更新翻译结果显示
		webview.postMessage({
			command: 'updateTranslation',
			data: {
				originalText: text,
				translatedText: result.translatedText,
				sourceLanguage: result.sourceLanguage,
				targetLanguage: result.targetLanguage
			}
		});

		// 判断是否需要自动添加到单词本
		const autoAddWord = config.get('autoAddWord');
		const autoExtractKeywords = config.get('autoExtractKeywords');

		if (isSingleWord && autoAddWord && result.sourceLanguage === 'en') {
			// 单个英文单词，自动添加到单词本
			await addWordToNotebook(text.trim());
		} else if (!isSingleWord && autoExtractKeywords) {
			// 长文本，提取关键词
			const keywords = await llmService.extractKeywords(text, result.translatedText);
			if (keywords.length > 0) {
				await addKeywordsToNotebook(keywords);
			}
		}

	} catch (error) {
		vscode.window.showErrorMessage(`翻译失败: ${error.message}`);
	}
}

/**
 * 添加单词到单词本
 */
async function addWordToNotebook(word) {
	try {
		const llmService = new LLMService();
		const response = await llmService.translate(word, 'word');
		const wordData = await llmService.parseWordResponse(response);

		storage.addWord(wordData);
		treeDataProvider.refresh();
		vscode.window.showInformationMessage(`已将单词 "${wordData.word}" 自动添加到单词本`);
	} catch (error) {
		console.error('自动添加单词失败:', error);
	}
}

/**
 * 批量添加关键词到单词本
 */
async function addKeywordsToNotebook(keywords) {
	try {
		const llmService = new LLMService();
		let successCount = 0;

		for (const keyword of keywords) {
			try {
				const response = await llmService.translate(keyword, 'word');
				const wordData = await llmService.parseWordResponse(response);

				storage.addWord(wordData);
				successCount++;
			} catch (error) {
				console.error(`添加关键词 ${keyword} 失败:`, error);
			}
		}

		if (successCount > 0) {
			treeDataProvider.refresh();
			vscode.window.showInformationMessage(`已自动添加 ${successCount} 个关键词到单词本`);
		}
	} catch (error) {
		console.error('批量添加关键词失败:', error);
	}
}

function deactivate() {
	if (storage) {
		storage.close();
	}
}

/**
 * 获取侧边栏翻译器webview内容
 */
function getTranslatorWebviewContent() {
	return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>翻译器</title>
    <style>
        body {
            padding: 10px;
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-sideBar-background);
            margin: 0;
        }

        .container {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        textarea {
            width: 100%;
            min-height: 80px;
            padding: 8px;
            font-size: 13px;
            line-height: 1.5;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 3px;
            resize: vertical;
            box-sizing: border-box;
            font-family: var(--vscode-font-family);
        }

        textarea:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }

        select {
            width: 100%;
            padding: 6px 8px;
            background-color: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            border: 1px solid var(--vscode-dropdown-border);
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
        }

        .button-group {
            display: flex;
            gap: 6px;
        }

        button {
            flex: 1;
            padding: 6px 10px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
        }

        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .secondary-button {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .secondary-button:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }

        .result-section {
            padding: 10px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 4px;
            display: none;
            margin-top: 5px;
        }

        .result-section.show {
            display: block;
        }

        .result-label {
            font-size: 11px;
            opacity: 0.7;
            margin-bottom: 6px;
        }

        .result-text {
            font-size: 13px;
            line-height: 1.6;
            white-space: pre-wrap;
            word-break: break-word;
        }

        .hint {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            line-height: 1.4;
        }

        .loading {
            display: none;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            text-align: center;
            padding: 5px 0;
        }

        .loading.show {
            display: block;
        }
    </style>
</head>
<body>
    <div class="container">
        <textarea id="inputText" placeholder="输入要翻译的内容..."></textarea>

        <select id="targetLanguage">
            <option value="auto">自动→中文</option>
            <option value="en">翻译为英文</option>
            <option value="ja">翻译为日语</option>
        </select>

        <div class="button-group">
            <button id="translateBtn">翻译</button>
            <button id="clearBtn" class="secondary-button">清空</button>
        </div>

        <div class="hint">
            提示: 自动模式下，中文→英文，其他→中文
        </div>

        <div id="loading" class="loading">翻译中...</div>

        <div id="resultSection" class="result-section">
            <div class="result-label" id="resultLabel">翻译结果</div>
            <div class="result-text" id="resultText"></div>
            <div class="button-group" style="margin-top: 8px;">
                <button id="copyBtn" class="secondary-button">复制</button>
                <button id="swapBtn" class="secondary-button">反译</button>
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

                resultLabel.textContent = \`\${langMap[sourceLanguage] || sourceLanguage} → \${langMap[targetLanguage] || targetLanguage}\`;
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

module.exports = {
	activate,
	deactivate
}
