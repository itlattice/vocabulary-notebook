const vscode = require('vscode');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class VocabularyStorage {
    constructor(context) {
        this.context = context;
        this.db = null;
        this.initDatabase();
    }

    initDatabase() {
        const config = vscode.workspace.getConfiguration('vocabularyNotebook.storage');
        let dbPath = config.get('path');

        if (!dbPath) {
            dbPath = path.join(this.context.globalStorageUri.fsPath, 'vocabulary.db');
        } else {
            dbPath = path.join(dbPath, 'vocabulary.db');
        }

        // 确保目录存在
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        this.db = new Database(dbPath);

        // 创建表
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS words (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                word TEXT UNIQUE NOT NULL,
                phonetic TEXT,
                meanings TEXT,
                examples TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }

    addWord(wordData) {
        const stmt = this.db.prepare(`
            INSERT INTO words (word, phonetic, meanings, examples)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(word) DO UPDATE SET
                phonetic = excluded.phonetic,
                meanings = excluded.meanings,
                examples = excluded.examples,
                updated_at = CURRENT_TIMESTAMP
        `);

        return stmt.run(
            wordData.word,
            wordData.phonetic,
            JSON.stringify(wordData.meanings),
            JSON.stringify(wordData.examples)
        );
    }

    deleteWord(word) {
        const stmt = this.db.prepare('DELETE FROM words WHERE word = ?');
        return stmt.run(word);
    }

    getWord(word) {
        const stmt = this.db.prepare('SELECT * FROM words WHERE word = ?');
        const row = stmt.get(word);

        if (row) {
            return {
                ...row,
                meanings: JSON.parse(row.meanings),
                examples: JSON.parse(row.examples)
            };
        }
        return null;
    }

    getAllWords() {
        const stmt = this.db.prepare('SELECT * FROM words ORDER BY word COLLATE NOCASE ASC');
        const rows = stmt.all();

        return rows.map(row => ({
            ...row,
            meanings: JSON.parse(row.meanings),
            examples: JSON.parse(row.examples)
        }));
    }

    hasWord(word) {
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM words WHERE word = ?');
        const result = stmt.get(word);
        return result.count > 0;
    }

    getDbPath() {
        return this.db.name;
    }

    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

module.exports = VocabularyStorage;
