# Security Policy / 安全策略

## Supported version / 支持版本

Security fixes currently target the latest commit on `main`. The project has not published a stable release line yet.

安全修复目前以 `main` 分支最新提交为目标，项目尚未发布稳定版本线。

## Reporting a vulnerability / 报告漏洞

Do not disclose vulnerabilities, pairing URLs, tokens, cookies, API keys, private tunnel URLs, or workspace data in a public issue.

请勿在公开 Issue 中披露漏洞细节、配对链接、Token、Cookie、API Key、私人隧道地址或工作区数据。

Use GitHub's private vulnerability reporting flow from the repository **Security** tab when it is available. Include:

- the affected DSH and plugin versions or commit SHAs;
- operating system and CPU architecture;
- concise reproduction steps;
- the security impact and affected boundary;
- sanitized logs or a minimal proof of concept.

如仓库 **Security** 页面提供私密漏洞报告入口，请通过该入口提交，并包含：

- 受影响的 DSH 与插件版本或提交 SHA；
- 操作系统与 CPU 架构；
- 简洁的复现步骤；
- 安全影响及受影响边界；
- 已脱敏日志或最小化验证样例。

If private reporting is unavailable, open a public issue containing only a request for private contact. Do not include technical details until a private channel is established.

若私密报告入口不可用，请仅创建一个请求私下联系的公开 Issue；在建立私密渠道前，不要附带技术细节。

## Security boundaries / 安全边界

Reports are especially useful when they involve:

- bypassing one-time pairing or session revocation;
- unauthenticated HTTP or WebSocket access through the bridge;
- leakage of a pairing token into request URLs or logs;
- Host or Origin rewriting that weakens DSH browser checks;
- unsafe `cloudflared` download, cache, extraction, or execution behavior;
- remote access to host configuration that should remain disabled.

以下问题属于重点关注范围：

- 绕过一次性配对或会话撤销；
- 未经鉴权访问桥接层的 HTTP 或 WebSocket；
- 配对 Token 泄漏到请求 URL 或日志；
- Host 或 Origin 重写削弱 DSH 浏览器检查；
- `cloudflared` 下载、缓存、解包或执行过程不安全；
- 远程访问本应禁用的宿主配置。

Cloudflare Quick Tunnel is an experimental transport in this project. It does not provide a stable hostname or service-level guarantee. Revoke the remote link after use and do not process sensitive tasks through it.

Cloudflare Quick Tunnel 在本项目中属于实验性传输方式，不提供稳定域名或服务等级保证。使用后请撤销远程链接，不要通过该通道处理敏感任务。
