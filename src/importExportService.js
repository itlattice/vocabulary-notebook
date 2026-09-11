const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const unzipper = require('unzipper');

class ImportExportService {
    constructor(storage) {
        this.storage = storage;
    }

    /**
     * 导出单词本和配置
     */
    async exportData() {
        try {
            // 让用户选择保存位置
            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(path.join(require('os').homedir(), 'vocabulary-backup.zip')),
                filters: {
                    'Zip文件': ['zip']
                }
            });

            if (!uri) {
                return; // 用户取消
            }

            const outputPath = uri.fsPath;

            // 获取数据库文件路径
            const dbPath = this.storage.getDbPath();

            // 获取配置
            const config = vscode.workspace.getConfiguration('vocabularyNotebook');
            const configData = {
                llm: {
                    baseUrl: config.get('llm.baseUrl'),
                    model: config.get('llm.model'),
                    // 不导出 API Key，保护隐私
                },
                translator: {
                    autoAddWord: config.get('translator.autoAddWord'),
                    autoExtractKeywords: config.get('translator.autoExtractKeywords')
                },
                exportDate: new Date().toISOString(),
                version: '0.0.2'
            };

            // 创建 ZIP 文件
            await this._createZip(outputPath, dbPath, configData);

            const wordCount = this.storage.getAllWords().length;
            vscode.window.showInformationMessage(
                `导出成功！已导出 ${wordCount} 个单词到: ${path.basename(outputPath)}`
            );

        } catch (error) {
            vscode.window.showErrorMessage(`导出失败: ${error.message}`);
        }
    }

    /**
     * 导入单词本和配置
     */
    async importData() {
        try {
            // 让用户选择导入文件
            const uris = await vscode.window.showOpenDialog({
                canSelectMany: false,
                filters: {
                    'Zip文件': ['zip']
                },
                openLabel: '选择备份文件'
            });

            if (!uris || uris.length === 0) {
                return; // 用户取消
            }

            const zipPath = uris[0].fsPath;

            // 确认导入
            const choice = await vscode.window.showWarningMessage(
                '导入将覆盖现有数据（会合并单词，不会删除现有单词）。是否继续？',
                '继续', '取消'
            );

            if (choice !== '继续') {
                return;
            }

            // 提取 ZIP 文件
            const extractedData = await this._extractZip(zipPath);

            // 导入配置
            if (extractedData.config) {
                await this._importConfig(extractedData.config);
            }

            // 导入数据库
            if (extractedData.dbPath) {
                const importCount = await this._importDatabase(extractedData.dbPath);
                vscode.window.showInformationMessage(
                    `导入成功！已导入 ${importCount} 个单词`
                );
            } else {
                vscode.window.showErrorMessage('备份文件中未找到数据库文件');
            }

        } catch (error) {
            vscode.window.showErrorMessage(`导入失败: ${error.message}`);
        }
    }

    /**
     * 创建 ZIP 文件
     */
    async _createZip(outputPath, dbPath, configData) {
        return new Promise((resolve, reject) => {
            const output = fs.createWriteStream(outputPath);
            const archive = archiver('zip', { zlib: { level: 9 } });

            output.on('close', () => resolve());
            archive.on('error', (err) => reject(err));

            archive.pipe(output);

            // 添加数据库文件
            if (fs.existsSync(dbPath)) {
                archive.file(dbPath, { name: 'vocabulary.db' });
            }

            // 添加配置文件
            archive.append(JSON.stringify(configData, null, 2), { name: 'config.json' });

            archive.finalize();
        });
    }

    /**
     * 解压 ZIP 文件
     */
    async _extractZip(zipPath) {
        const tempDir = path.join(require('os').tmpdir(), 'vocabulary-import-' + Date.now());
        fs.mkdirSync(tempDir, { recursive: true });

        return new Promise((resolve, reject) => {
            fs.createReadStream(zipPath)
                .pipe(unzipper.Extract({ path: tempDir }))
                .on('close', () => {
                    const dbPath = path.join(tempDir, 'vocabulary.db');
                    const configPath = path.join(tempDir, 'config.json');

                    let config = null;
                    if (fs.existsSync(configPath)) {
                        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                    }

                    resolve({
                        dbPath: fs.existsSync(dbPath) ? dbPath : null,
                        config: config,
                        tempDir: tempDir
                    });
                })
                .on('error', (err) => reject(err));
        });
    }

    /**
     * 导入配置
     */
    async _importConfig(config) {
        const workspaceConfig = vscode.workspace.getConfiguration('vocabularyNotebook');

        // 询问用户是否导入配置
        const choice = await vscode.window.showInformationMessage(
            '是否导入配置信息（LLM设置、翻译器设置）？',
            '是', '否'
        );

        if (choice === '是') {
            if (config.llm) {
                if (config.llm.baseUrl) {
                    await workspaceConfig.update('llm.baseUrl', config.llm.baseUrl, vscode.ConfigurationTarget.Global);
                }
                if (config.llm.model) {
                    await workspaceConfig.update('llm.model', config.llm.model, vscode.ConfigurationTarget.Global);
                }
            }

            if (config.translator) {
                await workspaceConfig.update('translator.autoAddWord', config.translator.autoAddWord, vscode.ConfigurationTarget.Global);
                await workspaceConfig.update('translator.autoExtractKeywords', config.translator.autoExtractKeywords, vscode.ConfigurationTarget.Global);
            }

            vscode.window.showInformationMessage('配置已导入（API Key需要重新配置）');
        }
    }

    /**
     * 导入数据库
     */
    async _importDatabase(importDbPath) {
        const Database = require('better-sqlite3');
        const importDb = new Database(importDbPath, { readonly: true });

        try {
            // 读取所有单词
            const stmt = importDb.prepare('SELECT * FROM words');
            const words = stmt.all();

            let importCount = 0;
            for (const word of words) {
                try {
                    this.storage.addWord({
                        word: word.word,
                        phonetic: word.phonetic,
                        meanings: JSON.parse(word.meanings),
                        examples: JSON.parse(word.examples)
                    });
                    importCount++;
                } catch (error) {
                    console.error(`导入单词 ${word.word} 失败:`, error);
                }
            }

            return importCount;

        } finally {
            importDb.close();

            // 清理临时文件
            try {
                fs.unlinkSync(importDbPath);
                fs.rmdirSync(path.dirname(importDbPath));
            } catch (err) {
                // 忽略清理错误
                console.error('清理临时文件失败:', err);
            }
        }
    }
}

module.exports = ImportExportService;
