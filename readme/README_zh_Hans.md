# 在 Zapier 使用 Suno 音乐 — 由 Ace Data Cloud 提供

在 Zap 工作流中生成 Suno 音乐，等待同一个任务完成，再把音频链接传给后续表格或文件步骤。这是 **Ace Data Cloud 提供的集成**，不是 Suno 官方应用，也不代表 Suno 或 Zapier 背书。

[English](../README.md) · [发布验收表（英文）](../PUBLISHING.md)

## 1. 安装入口与当前状态

当前为源码预览 `0.0.1`，**没有已验证的 Zapier 私有上传、公开上架、成功 Zap 或账单**。[Zapier 官方应用目录](https://zapier.com/apps)是后续公开安装渠道，源码仓不是安装入口。管理员需先在已有合法账号中上传并提供准确的私有版本；公开审核后才补真实安装链接。

应用内动作：**Generate Suno Music**（生成音乐并等待完成）、**Retrieve Suno Music Task**（只查原任务）、**Create Chat Response**（聊天）。本版不含 Seedance、HappyHorse、GPT Image 或 Nano Banana 动作。Suno 在动作名与教程中明确显示；公开目录搜 `suno` 能否找到该应用，必须上架后验证，不承诺排名。

## 2. 注册、登录并获取 Token

1. 打开 [Ace Data Cloud → Applications](https://platform.acedata.cloud/console/applications?utm_source=opensource&utm_medium=referral&utm_campaign=evergreen&utm_content=suno_zapier_readme_zh_api_key)，先注册或登录。
2. 找到 **General application**；未创建时选 **Initialize General Application**。通用应用 Key 可调用账号已获权限的服务，专用应用则限对应服务。先确认 Suno 权限、当前价格和余额。
3. 复制卡片上的 Key，或进入 **Manage Keys → Create**，单独命名 `Zapier Suno`，方便轮换和撤销。

![复制 Token 或打开管理页面，来自现有平台教程](../assets/tutorial/get-api-key-en.png)

4. 检查 **Expiration Time**、**Set Usage Limitation**、**Allowed APIs**。开启 API 限制时，同时允许 `/suno/audios` 和 `/suno/tasks`；聊天另需对应 Chat API 权限。模型列表连接测试成功，不代表拥有所有生成权限。
5. 只复制原始 Token，不带 `Bearer `、引号或空格。`platform-...` 管理令牌不能代替此 Token。

复用图中的 `Dify tutorial` 只是示例名称，本连接请填写 `Zapier Suno`。

![创建单独 Key，来自现有平台教程](../assets/tutorial/create-api-key-en.png)

查看[当前服务与价格](https://platform.acedata.cloud/services/suno?utm_source=opensource&utm_medium=referral&utm_campaign=evergreen&utm_content=suno_zapier_readme_zh_pricing)。体验额度以账号当前显示为准。Credits 不是美元，需按当前套餐换算；Zapier 任务费用另计。

## 3. 在 Zapier 连接

在私有 Ace Data Cloud 应用中添加连接，将 Token 粘贴到 **API token**，**Connection name** 填 `Work` 等非敏感名字；名字不会发往 Ace。不要将 Key 放进提示词、截图或共享工作流。

![Zapier 官方原图改编的连接预览，非实际运行](../assets/tutorial/zapier-connection-preview.png)

这是 **2026-10-17 编辑、2026-10-18 复用的官方截图改编预览**；原拍摄日期未知，不证明安装、连接成功、上传或当前界面的准确布局。[来源记录](../assets/tutorial/sources.json)。目前没有 Suno 在 Zapier 内真实生成的截图。

## 4. 建立音乐工作流

获得私有版本权限后配置：

**一次性触发 → Ace Data Cloud / Generate Suno Music → 保存 Audio URL 的表格或文件步骤**。

| 字段 | 首次用例 |
| --- | --- |
| Suno Model | 明确选择 `chirp-v6`，权限和费用以账号为准 |
| Music Prompt | `A gentle instrumental piano melody for a sunrise, no vocals.` |
| Instrumental | `true` |

当前动作使用灵感模式（`custom=false`），提示词 1–500 字符，不偷偷切换模型；自定义歌词、续写、翻唱、分轨不在本版范围。

**Test 按钮也会收费**，执行前先确定额度。动作只提交一次，附带 Zapier 回调地址；Zapier 等待回调后，动作再次用用户 Token 查询原任务，只有最终成功且音频链接有效才继续下一步。回调中的链接不会直接当成可信结果。

## 5. 查同一任务、接结果

回调延迟或运行结果不确定时，不要重新点生成。在 Zap History 或 Ace 任务记录中找到原 **Ace Task ID**，新建 **Retrieve Suno Music Task** 步骤并映射或粘贴该 ID。这个动作只查询，不提交音乐生成。

- `pending / success=false`：过一会儿继续查询同一个 ID，不输出中间试听链接当成品。
- `failed / success=false`：先查使用记录，再决定是否新提交。
- `succeeded / success=true`：将 **First Completed Audio URL**、**Completed Audio URLs** 或 **Track Audio URL** 映射给后续步骤；多首返回保留全部链接。

重放生成可能重复扣费，先核[使用记录](https://platform.acedata.cloud/console?utm_source=opensource&utm_medium=referral&utm_campaign=evergreen&utm_content=suno_zapier_readme_zh_usage)，关联任务、trace 和时间。测试 Zap 验收一次后停用，避免定时生成。Zap 步骤变绿不能代替唯一账单证明。

## 常见问题

找不到应用：源码不等于账号安装，需既有管理员提供真实私有版本；现在不宣称公开上架。连接失败：检查完整 Token、过期、权限、限制和余额。连接成功但生成失败：检查 Suno 生成与查询 API 都允许。限流：等 Zapier 延迟重试，手动重试前查原任务。内容拦截：按错误类别处理，不换模型绕过。无最终音频：只查原 ID，确认终态。

[联系支持](https://docs.acedata.cloud/en/resources/support)时提供任务/trace ID、模型和大致时间，不发送 Key 或私人提示词。[隐私政策](https://docs.acedata.cloud/en/resources/privacy) · [条款](https://docs.acedata.cloud/en/resources/terms)。

开发检查用 Node 22：`npm ci`、`npm test`、`npm run validate`、`npm run validate:publish`、`npm run build`。测试均为离线模拟，不发送收费请求。内置 AI by Zapier 的服务商下拉由 Zapier 管理，本应用上架不代表自动加入该列表。
