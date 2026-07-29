# MD Editor · Git 使用规范（git-usage.md）

> 本文档是项目仓库的 Git 协作规范，配套 [`project-bootstrap.md` § 2.5](./project-bootstrap.md)。  
> 任何对分支模型、提交命名、版本发布规则的调整，必须先修改本文档并由负责人确认。

---

## 1. 仓库与远程

- 默认远程：`origin`，主分支：`main`。
- 强制保护：`main` 禁止 `push --force`；如确需回退，使用 `git revert` 或 PR 流程。
- 接入 Git 的时机：**项目开工前**先初始化仓库并推送一次空提交；不要写到一半再补救。

---

## 2. 分支模型

| 分支 | 用途 | 生命周期 | 谁合并 |
|---|---|---|---|
| `main` | 稳定主分支；与发布版本一一对应 | 长期 | 仅负责人（人） |
| `release` | 预发布分支；冻结后只接受 bugfix | 当前版本周期 | 仅负责人 |
| `pre` | 内测分支；接受 feature + bugfix | 当前迭代 | 负责人 + 评审 |
| `test` | 测试聚合分支；CI 必跑 | 当前迭代 | 负责人 |

### 2.1 派生分支

| 前缀 | 含义 | 基线 | 合入目标 |
|---|---|---|---|
| `feature/<topic>` | 新功能 | `pre` 或最新 `main` | `pre` |
| `bugfix/<topic>` | 缺陷修复 | `release` / `pre` / `main` | 同基线 |
| `refactor/<topic>` | 重构（不改变行为） | `pre` | `pre` |
| `docs/<topic>` | 仅文档 | `pre` | `pre` |
| `chore/<topic>` | 杂项（依赖、日志等） | `pre` | `pre` |

> 分支名 `topic` 用小写 + 下划线；尽量 ≤ 30 字。

### 2.2 分支生命周期

1. 从 `pre` 拉 `feature/<topic>` 或 `bugfix/<topic>`。
2. 在派生分支提交 + 推送 + 提 PR 到 `pre`（或 `release`）。
3. PR 通过 CI + 至少 1 人审阅后合入；squash merge 默认。
4. 合入后删除派生分支（GitHub 上勾选 “Automatically delete head branches”）。

---

## 3. 提交命名

**格式**：

```
<type><YYYY_MM_DD_HH_MM>_<short-snake-name>

<详细说明…>
- 新增了功能 123
- 调整 xxx
- 修复 xxx
```

**示例**：

```
feature2026_07_29_11_55_visible

- 在版本对比 Overlay 中新增“是否显示已删除行”开关
- 默认开启；偏好持久化到 localStorage
```

```
bugfix2026_07_29_11_55_reviewErrorBug

- 修复 review 页空指针
- 复现：连续 3 次空列表请求
- 根因：未判空就调用 .length
```

### 3.1 类型（type）

| type | 含义 | 是否发版 |
|---|---|---|
| `feature` | 新功能 / 新接口 | 视情况 |
| `bugfix` | 缺陷修复 | 累计 10 次或修 P0/P1 必修小版本 |
| `refactor` | 重构（不改变行为） | 不直接发版 |
| `docs` | 文档（README、API、MAINTENANCE 等） | 不直接发版 |
| `test` | 测试（新增 / 调整 / 修复断言） | 不直接发版 |
| `chore` | 杂项（依赖、日志、配置） | 不直接发版 |

### 3.2 提交粒度

- **一次提交只针对一个 feature 或一个 bug**；多要点必须在 message 中分行写清。
- **禁止**“杂烩提交”：例如同时改 UI + 改接口 + 改文档。
- **建议**：在本地用 `git add -p` / `git commit --amend`（仅本分支未推送前）保持提交干净。

---

## 4. 版本发布

### 4.1 触发条件

| 触发 | 版本号变化 | 分支动作 |
|---|---|---|
| 每累计 **10 次提交**（feature/bugfix 累计） | 补丁号 +1：`v1.0 → v1.1` | 从 `pre` 提 PR 到 `release`，通过后打 tag `vX.Y` 并合回 `main` |
| 重要改动或新核心功能 | 主版本 +1：`v1.5 → v2.0` | 同上，tag 同步写到 `main` 与 `release` |
| 不兼容 API 变更 | 主版本 +1 | 在 `docs/API.md` 顶部加 **Breaking Change** 段落 |

> “10 次提交”的计数起点：`c46ff89`（最近一次提交）之后开始累计；建议在 `project_state.md` 决策记录里跟踪。

### 4.2 Tag 与变更日志

- 打 tag：`git tag -a vX.Y.Z -m "<一句话>"`，并 `git push origin vX.Y.Z`。
- 在 `release` 提交说明里列出：本次发布包含的提交（`git log vX.Y-1..vX.Y --oneline`）。

### 4.3 发布 Checklist（人负责）

- [ ] 全量测试退出码 0（见 [`test.md` § 6](./test.md)）
- [ ] `MAINTENANCE.md` 中已修复条目状态闭环
- [ ] `README.md` 与 `docs/API.md` 与当前代码一致
- [ ] CORS / secret 等安全配置已通过环境变量提供
- [ ] tag + 变更日志已推送

---

## 5. 敏感信息

- **禁止**提交：API Key、数据库密码、JWT secret、token、个人凭据。
- **必须**：`.env` / `*.db` / `logs/` 已在 `.gitignore`（参见根 `.gitignore`）。
- **提交前**：执行 `git status --short`，确认没有未跟踪的敏感文件；或安装 `gitleaks` / `pre-commit` 钩子（见 [`project-bootstrap.md` § 2.5](./project-bootstrap.md)）。

---

## 6. 常见反模式

| 反模式 | 后果 | 正确做法 |
|---|---|---|
| 在 `main` 直接提交 | 污染主分支 | 拉 `feature/*` 走 PR |
| `commit --amend` 已推送的提交 | 改写历史 | 用 `git revert` 或新提交 |
| 一次提交塞 5 个不相关改动 | 难回滚、难审查 | 拆提交 |
| 用 `push --force` 推公共分支 | 覆盖他人工作 | 拒绝；如确需，PR 内 `Update branch` |
| `feature/xxx` 合到 `main` 跳过 `pre` | 绕过内测 | 先合 `pre` → `release` → `main` |
| 不带前缀的提交名 | 无法一眼判断类型 | 严格按 § 3 |

---

## 7. 工具与钩子（推荐）

- `pre-commit`：`ruff` (Python) / `eslint` (TS) / `gitleaks`。
- `commit-msg`：用 `commitlint` 校验 `<type><date>_<name>` 格式。
- CI：PR 触发 lint + 关键测试（见 [`project_state.md` § 2 #5](./project_state.md)）。

---

## 8. 更新日志规范

每次代码改动确认完成后，生成 update 日志文件后再提交：

- **位置**：`update/` 文件夹（在项目根目录）
- **命名**：`YYYY-MM-DD_HH-mm.md`（如 `2026-07-29_13-05.md`）
- **内容**：
  - 改动目的
  - 改动时间（YYYY-MM-DD HH:mm:ss）
  - 改动文件列表
  - 复杂问题与解决方式
  - 验证方式与结果
  - 安全建议（如涉及）
  - Git 提交信息

> `update/` 目录已在 `.gitignore` 中排除，无需提交到仓库。

---

## 9. 变更记录

| 日期 | 变更 |
|---|---|
| 2026-07-29 | 初稿：从原始“项目启动要求”整理而来 |