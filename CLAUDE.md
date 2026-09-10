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
- Contains business logic in `learnWord()` and `translateFile()` functions
- On deactivation, closes the database connection

**src/llmService.js** - LLM API client
- Reads configuration from `vocabularyNotebook.llm.*` settings
- `translate(text, type)` - Makes OpenAI-compatible API calls (type: 'word' or 'file')
- `parseWordResponse(response)` - Extracts JSON from LLM response using regex
- Throws detailed errors for API failures (network, auth, format issues)

**src/storage.js** - SQLite persistence
- Uses `better-sqlite3` for synchronous database access
- Database location: user-configurable or defaults to `context.globalStorageUri`
- Schema: stores word, phonetic, meanings (JSON), examples (JSON), timestamps
- `addWord()` uses UPSERT to update existing entries
- `getAllWords()` returns all words with parsed JSON fields

**src/treeDataProvider.js** - Sidebar vocabulary list
- Implements VSCode TreeDataProvider interface
- Sorts words alphabetically (case-insensitive)
- Shows first meaning as tree item description
- Each item has a command to open word details

**src/webviewPanel.js** - Word detail panel
- Creates/reuses a webview panel in `ViewColumn.Beside`
- Renders HTML with VSCode theme CSS variables
- Includes "记录到单词本" button that posts message back to extension
- The webview survives hidden state (`retainContextWhenHidden`)

### Data Flow

1. **Word lookup**: User selects text → `learnWord` command → `LLMService.translate('word')` → `parseWordResponse` → display in webview
2. **Save to notebook**: User clicks button in webview → webview posts message → `storage.addWord()` → `treeDataProvider.refresh()`
3. **View saved word**: User clicks tree item → `openNotebook` command → `storage.getWord()` → display in webview

### Configuration

All settings are under `vocabularyNotebook.*`:
- `llm.baseUrl` - API endpoint (default: OpenAI)
- `llm.apiKey` - Required for API calls
- `llm.model` - Model name (default: gpt-3.5-turbo)
- `storage.path` - Optional custom database location

## Important Behaviors

- The LLM prompt expects JSON response with specific structure: `{word, phonetic, meanings[], examples[]}`
- Word data is stored as JSON strings in SQLite and parsed on retrieval
- The webview embeds the full `wordData` object in the HTML for the "add to notebook" button
- Tree items are clickable via the `command` property, not manual click handlers
- File translation only supports `.txt` and `.md` extensions (checked by file extension)

## Testing the Extension

Press F5 to launch Extension Development Host. In the new window:
1. Configure API key in Settings: search "vocabulary notebook"
2. Select a word, right-click → "学习单词"
3. View result in right panel
4. Click "单词本" icon in activity bar to see saved words
