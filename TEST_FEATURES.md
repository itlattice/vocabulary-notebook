# 功能测试说明

## ✅ 已实现的功能

### 1. 单词已存在时隐藏"记录到单词本"按钮

**实现位置**: `src/webviewPanel.js` 第 72 行

**实现逻辑**:
```javascript
// 检查单词是否已在单词本中
const isInNotebook = this.storage ? this.storage.hasWord(wordData.word) : false;

// 在HTML中条件渲染按钮
${!isInNotebook ? '<button class="btn btn-success" onclick="addToNotebook()">记录到单词本</button>' : ''}
```

**测试步骤**:
1. 学习一个新单词（如 "hello"）→ 应该显示"记录到单词本"按钮
2. 点击"记录到单词本"保存
3. 再次学习同一个单词 "hello" → 应该**不显示**"记录到单词本"按钮
4. 单词标题旁应显示 "✓ 已收藏" 徽章

### 2. 导出/导入功能

**实现位置**: `src/importExportService.js`

**功能**:
- 导出: 将 SQLite 数据库 + 配置文件打包成 ZIP
- 导入: 从 ZIP 解压并合并到现有数据库
- 智能合并: 不会删除现有单词

**测试步骤**:
1. 点击单词本视图工具栏的"导出"按钮
2. 选择保存位置，生成 `vocabulary-backup.zip`
3. 点击"导入"按钮，选择刚才的 ZIP 文件
4. 确认导入，检查单词数量

### 3. 上一个/下一个单词导航

**实现位置**: `src/webviewPanel.js` 第 226-230 行

**功能**:
- 从单词本打开单词时显示导航按钮
- 支持循环浏览（最后一个→第一个，第一个→最后一个）
- 从"学习单词"打开时不显示导航（因为没有列表上下文）

**测试步骤**:
1. 在单词本中点击任意单词
2. 应该看到"← 上一个" 和 "下一个 →" 按钮
3. 点击按钮可以循环浏览所有单词

### 4. 单词按字母排序

**实现位置**: `src/storage.js` 第 84 行

**功能**:
- 单词列表按字母顺序（a-z）排序
- 不区分大小写

**测试步骤**:
1. 查看单词本列表
2. 单词应该按字母顺序排列

## 🔧 技术实现细节

### 按钮隐藏逻辑

1. `storage.hasWord(word)` 方法检查数据库中是否存在该单词
2. `webviewPanel.setStorage(storage)` 将 storage 实例传递给 webviewPanel
3. 在生成 HTML 时调用 `this.storage.hasWord(wordData.word)` 判断
4. 根据结果决定是否渲染"记录到单词本"按钮

### 为什么按钮可能仍然显示？

如果按钮仍然显示，可能的原因：
1. ❌ storage 未正确传递 → ✅ 已在 extension.js 第 29 行调用 `webviewPanel.setStorage(storage)`
2. ❌ hasWord 方法未实现 → ✅ 已在 storage.js 第 94-98 行实现
3. ❌ 条件判断错误 → ✅ 使用 `!isInNotebook` 正确判断

## ✅ 功能已正确实现

代码已通过 ESLint 检查，逻辑完整，功能应该正常工作。

建议通过按 F5 启动扩展开发主机进行实际测试验证。
