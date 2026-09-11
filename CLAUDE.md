# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vocabulary Notebook is a VSCode extension that helps users learn vocabulary while coding. It uses LLM APIs (OpenAI-compatible format) to translate words and files, and stores vocabulary in a local SQLite database.

## Development Commands

```bash
# Lint code
npm run lint

# Run tests
npm test

# Package extension for distribution
vsce package

# The extension runs by pressing F5 in VSCode (launches Extension Development Host)
```

## Architecture

### Core Components

**extension.js** - Main entry point
- Registers all commands on activation
- Initializes three singletons: `storage`, `treeDataProvider`, `webviewPanel`
- Registers the translator webview view provider
- Contains business logic in `learnWord()`, `translateFile()`, and `handleTranslation()` functions
- `handleTranslation()` supports auto-adding words and extracting keywords based on user configuration
- On deactivation, closes the database connection

**src/llmService.js** - LLM API client
- Reads configuration from `vocabularyNotebook.llm.*` settings
- `translate(text, type)` - Makes OpenAI-compatible API calls (type: 'word' or 'file')
- `translateText(text, targetLang)` - General translation method supporting auto language detection ('auto', 'en', 'ja')
- `extractKeywords(text, translatedText)` - Extracts 3-5 key English words from translated text
- `parseWordResponse(response)` - Extracts JSON from LLM response using regex, with post-processing to normalize word casing (converts common words to lowercase, preserves proper nouns and acronyms)
- `isSingleWord(text)` - Checks if text is a single English word
- `_detectLanguage(text)` - Auto-detects language (zh/en/ja/other) based on character composition
- `_getWordPrompt(word)` - Generates prompt requiring LLM to return normalized word form (lowercase for common words, proper case for proper nouns/acronyms)
- `_getTranslationPrompt(text, sourceLang, targetLang)` - Generates translation prompt with lowercase requirement for single-word translations
- `_isLikelyProperNoun(word)` - Helper to identify proper nouns vs common words
- Throws detailed errors for API failures (network, auth, format issues)

**src/storage.js** - SQLite persistence
- Uses `better-sqlite3` for synchronous database access
- Database location: user-configurable or defaults to `context.globalStorageUri`
- Schema: stores word, phonetic, meanings (JSON), examples (JSON), timestamps
- `addWord()` uses UPSERT to update existing entries (prevents duplicates with same word)
- `getAllWords()` returns all words with parsed JSON fields

**src/treeDataProvider.js** - Sidebar vocabulary list
- Implements VSCode TreeDataProvider interface
- Sorts words alphabetically (case-insensitive)
- Shows first meaning as tree item description
- Each item has a command to open word details

**src/translatorTreeProvider.js** - Translator view provider (minimal)
- Placeholder provider for the translator webview view
- The actual UI is rendered via `registerWebviewViewProvider` in extension.js

**src/webviewPanel.js** - Word detail panel
- Creates/reuses a webview panel in `ViewColumn.Beside`
- Renders HTML with VSCode theme CSS variables
- Includes "记录到单词本" button that posts message back to extension
- The webview survives hidden state (`retainContextWhenHidden`)

**src/translatorWebview.js** - Translator webview (deprecated)
- Original central panel translator implementation
- No longer used; functionality moved to sidebar webview view

### Data Flow

1. **Word lookup**: User selects text → `learnWord` command → LLM normalizes word casing → `LLMService.translate('word')` → `parseWordResponse` → display in webview
2. **Save to notebook**: User clicks button in webview → webview posts message → `storage.addWord()` → `treeDataProvider.refresh()`
3. **View saved word**: User clicks tree item → `openNotebook` command → `storage.getWord()` → display in webview
4. **Translator view**: User inputs text in sidebar → `handleTranslation()` → `translateText()` → display result in sidebar webview
5. **Auto-add word**: If single word + `autoAddWord` enabled → `addWordToNotebook()` → `storage.addWord()`
6. **Auto-extract keywords**: If long text + `autoExtractKeywords` enabled → `extractKeywords()` → `addKeywordsToNotebook()`

### Configuration

All settings are under `vocabularyNotebook.*`:
- `llm.baseUrl` - API endpoint (default: OpenAI)
- `llm.apiKey` - Required for API calls
- `llm.model` - Model name (default: gpt-3.5-turbo)
- `storage.path` - Optional custom database location
- `translator.autoAddWord` - Auto-add single words to notebook (default: false)
- `translator.autoExtractKeywords` - Auto-extract keywords from long text (default: false)

## Important Behaviors

### Word Normalization
- The LLM prompt explicitly requires normalized word forms: lowercase for common words, proper case for proper nouns/acronyms
- `parseWordResponse()` includes post-processing to enforce this:
  - Checks if returned word starts with capital letter
  - Applies heuristics to distinguish proper nouns (e.g., "John", "Python") from common words (e.g., "Logistics")
  - Converts common words to lowercase to prevent duplicates (e.g., "Hello" and "hello")
- This two-layer approach (prompt + code) ensures consistent casing in the database

### Translation
- Auto language detection based on character analysis (Chinese chars, Japanese chars, English chars)
- Auto mode: Chinese → English, other languages → Chinese
- Single-word translations include special instruction for lowercase output
- Long text translation can trigger keyword extraction if enabled

### Webview Views
- The translator is implemented as a webview view (sidebar panel) using `registerWebviewViewProvider`
- HTML content is generated in `getTranslatorWebviewContent()` function
- Compact styling optimized for sidebar display
- Bidirectional messaging between webview and extension

## File Structure

```
vocabulary-notebook/
├── extension.js                  # Main entry point
├── package.json                  # Extension manifest
├── src/
│   ├── llmService.js            # LLM API client with translation
│   ├── storage.js               # SQLite database wrapper
│   ├── treeDataProvider.js      # Vocabulary list tree view
│   ├── translatorTreeProvider.js # Translator view provider
│   ├── webviewPanel.js          # Word detail panel
│   └── translatorWebview.js     # (Deprecated) Central translator panel
└── CLAUDE.md                    # This file
```

## Testing the Extension

Press F5 to launch Extension Development Host. In the new window:
1. Configure API key in Settings: search "vocabulary notebook"
2. Click "单词本" icon in activity bar
3. Use "翻译" view to translate text
4. Select a word, right-click → "学习单词"
5. View result in right panel
6. Click "记录到单词本" to save
7. View saved words in "我的单词" tree view

## Common Development Tasks

### Adding New LLM Prompts
- Add prompt generation method in `llmService.js`
- Follow existing pattern: clear instructions, JSON format if structured output needed
- Include normalization requirements for word-related prompts

### Modifying Word Storage Schema
- Update `initDatabase()` in `storage.js` with migration logic
- Update `addWord()` and `getWord()` to handle new fields
- Update webview HTML to display new fields

### Adding New Configuration Options
- Add to `package.json` under `contributes.configuration.properties`
- Access via `vscode.workspace.getConfiguration('vocabularyNotebook.xxx')`
- Document in README.md

### Debugging Translation Issues
- Check LLM prompt in `_getWordPrompt()` or `_getTranslationPrompt()`
- Verify response parsing in `parseWordResponse()`
- Check normalization logic in `_isLikelyProperNoun()` and related methods
- Test with various input cases (lowercase, uppercase, proper nouns)
