# dumate-duanz

将百度搭子 DuMate 的个人积分接入 **magpie / OpenCode**。

血缘：[R227BOUT/magpie-dumate](https://github.com/R227BOUT/magpie-dumate) → [RanceLee233/dumate-rance](https://github.com/RanceLee233/dumate-rance) → 本仓库。前两层的修改见 [NOTICE.md](NOTICE.md)。

本层新增：

- **可读模型名 + 实测积分倍率**。`deepseek-v41-flash` 显示为 `DeepSeek-V4.1 Flash · 100%`，`glm-53-flash` 显示为 `GLM-5.3 Flash · 6.1%`。倍率是以 DeepSeek-V4.1 Flash 为 100% 基准、通过真实调用测出的每千 output token 积分消耗，不是官方数字（百度未公开 per-model 积分表）。
- **积分分池显示**。控制器返回的 `totalPoints` 把 `product:"comate"` 的另一个产品积分也算进了总额；usage 现在按 `product` 拆成独立窗口，只统计 `status:"active"` 的包，并显示订阅是第几期、最早过期的积分何时清零。
- **客户端版本号跟随官方**。UA 中的 `DuMate/x.y.z` 升到文档公布的最新个人版（当前 1.0.91）。

**非官方实验版本。** 百度可能调整接口；目前已观察到新进程获取 gateway token 时返回“服务器内部错误”，已有进程的缓存 token 仍可调用。因此不能保证首次调用、续期或卸载客户端后的持续可用性。遇到此问题请保留 DuMate 客户端；本插件不会静默改走客户端本地代理。

## 安装与登录

```bash
magpie plugin add github:DuanZGit/dumate-duanz
magpie plugin use github:DuanZGit/dumate-duanz dumate
magpie plugin login dumate
```

选择“百度搭子桌面端登录态”。请先打开 DuMate 并完成登录。已有其他 DuMate 插件时，`plugin use` 用来指定由本插件提供服务；原插件可以保留或停用，避免重复显示。

插件包名是 `dumate-duanz`，供应商 ID 继续使用 `dumate`，模型入口为 `dumate/<模型ID>`。这让已有客户端配置可以继续使用。

本地开发安装：`magpie plugin add /absolute/path/to/dumate-duanz`。

## 自动寻找正确位置

| 系统 | DuMate 默认登录数据目录 |
| --- | --- |
| macOS | `~/Library/Application Support/qianfan-desktop-app/` |
| Windows | `%APPDATA%\qianfan-desktop-app\` |
| Linux | `$XDG_CONFIG_HOME/qianfan-desktop-app/`，未设置时为 `~/.config/qianfan-desktop-app/` |

先读取该目录中的 `auth.json` 和 `.cookie-key`，在内存中解密 Cookie；不修改 DuMate 登录文件。支持 `DUMATE_USER_DATA_DIR` 指定不同的数据目录。环境变量必须对运行 magpie 的进程可见，桌面应用不一定继承终端变量。

模型配置按当前激活账号查找：

```text
<数据目录>/qianfan_desk_xdg/<当前账号>/config/opencode/opencode.json
```

没有激活账号信息时，只在唯一账号目录存在的情况下自动选择；多个账号不猜测。可用 `DUMATE_OPENCODE_CONFIG` 指定配置文件的绝对路径。Linux 默认路径和 Windows APPDATA 路径经过离线测试；真实客户端登录验证仅在 macOS 完成。

## 模型名与积分倍率

`catalog.mjs` 把网关返回的模型 id 映射成可读名并附上倍率，`models.mjs` 在生成模型清单时使用它。倍率 = 该模型每千 output token 消耗的积分 ÷ DeepSeek-V4.1 Flash 的同一数值。

实测值（2026-11-13，以 DeepSeek-V4.1 Flash = 2.00 积分/千 output token = 100% 为基准）：

| 模型 | 显示名 | 倍率 |
| --- | --- | --- |
| kimi-k3 | Kimi K3 | 312% |
| qwen2.5-vl-32b-instruct | Qwen2.5-VL-32B | 101% |
| model-text | 自动路由（默认） | 101% |
| deepseek-v4-flash-0731 | DeepSeek-V4-Flash-0731 | 100% |
| deepseek-v41-flash | DeepSeek-V4.1 Flash | 100% |
| ernie-4.5-turbo-vl-32k | 文心 ERNIE-4.5 Turbo VL | 100% |
| qwen3.8-max | Qwen3.8 Max | 95% |
| doubao-seed-2-0-pro | 豆包 Seed 2.0 Pro | 9.7% |
| glm-53-flash | GLM-5.3 Flash | 6.1% |
| kimi-k31 | Kimi K3.1 | 5.9% |
| qwen38-flash | Qwen3.8 Flash | 5.0% |
| deepseek-v4-pro | DeepSeek-V4 Pro | 5.0% |
| qwen3.5-397b-a17b | Qwen3.5-397B-A17B | 4.9% |
| glm-53 | GLM-5.3 | 4.3% |
| qwen3.5-27b | Qwen3.5-27B | 3.4% |
| qwen3.5-35b-a3b | Qwen3.5-35B-A3B | 2.5% |

自动路由别名（`dm-auto-model/*`）不显示百分比，改显“倍率随路由”——实际模型由百度侧决定，无法预估。

精度边界：积分余额只有两位小数，单次短调用只扣 0.03–0.07 分，所以低价档（<0.2 分/千字）的相对误差约 ±10%。要重测用 `node scripts/measure-rates.mjs <模型id>`，它读本机 `plugin-auth.json` 打两次真实调用解斜率，遇 429 自动退避。

`/v1/models` 里的 `pricing` 字段是模型的美元价，与积分折算不成比例，**不要**拿它推导倍率。

## 模型与上下文

读取 `provider.QianfanPersonalQuota.models`，仅导入模型元数据。不会导入其中的 API key、本地代理 URL、headers、插件、命令或权限。

- 使用实际 API `id`；显示名称可能是别名，例如旧的 `glm-5` 配置实际指向 `model-text`。
- 保留配置声明的上下文、输出上限和输入模态；输入上限来自 `limit.context`，没有时取 `limit.input`。
- 排除内部任务路由、mock、OCR、embedding、reranker 和专用图像生成入口；重复别名去重。
- 保留用户在 magpie 中自定义的模型和设置。

2026-11-13 的清单中有 22 个对话入口，包括 DeepSeek、GLM、Kimi、Qwen、豆包和自动路由。**清单存在不代表账号有调用权限或每个模型均已测试。**

`dumate/deepseek-v41-flash` 的渠道配置为 1,000,000 tokens 输入/上下文、384,000 tokens 最大输出，支持图像输入；这是渠道声明，没有进行百万 tokens 极限测试。该模型通过本机 magpie 的小请求已返回成功。其他模型未逐一测试。

成功读取后，将纯模型清单保存到 magpie 配置目录下的 `dumate-duanz/models.snapshot.json`。读取源文件失败或原文件删除时使用最近的快照；新安装且没有快照时使用包内带日期的参考清单。快照不包含 Cookie、密钥、源文件路径或 API 地址。清单回退只解决模型信息保存，不延长登录有效期。

```bash
magpie provider models dumate
magpie model spec dumate/deepseek-v41-flash
magpie provider test dumate deepseek-v41-flash
```

最后一条会发一个真实请求，消耗少量积分。源代码变更后，需要重载插件才能更新运行中 host；重载也会清除内存里的 gateway token，接口异常期间请谨慎操作。Codex 的旧聊天可能保留旧模型信息；圆环依赖客户端收到窗口长度，不是名称中的“1M”文字。

## 登录、请求与隐私

沿用上游的三种方式：桌面登录态、浏览器登录后手动复制请求头 Cookie、直接粘贴 Cookie。浏览器方式需要完整请求头 Cookie；`document.cookie` 无法读取 httpOnly 字段。请只在本机 magpie 的登录界面操作，不要把 Cookie 发给维护者或贴进工单。

magpie 将登录态保存到自己的 `plugin-auth.json`；本插件不另存认证快照。Cookie 用于百度官方控制台的 token/积分接口，换取的 token 用于 `https://dumate-svc.baidu.com/gateway/apis/v1/chat/completions`。聊天请求只允许该地址并拒绝重定向。不会向作者服务器上传凭证或对话，也不会调用配置里的 `127.0.0.1` 代理地址。

提供积分用量、到期信息和签到 hook；积分数额以服务器返回为准。签到由 magpie 的设置控制。本插件沿用桌面账号积分，不会生成百度云 API key。

**暂不建议卸载 DuMate。** 原程序退出后，云端调用理论上不依赖它的进程，但必须先确认新的 magpie 进程能重新获取 token；现阶段该验证未通过。仅凭缓存 token 可用，不能证明长期独立运行。

## 测试与问题反馈

Node.js 20+ 或 Bun，无需安装依赖：

```bash
npm test
```

离线测试涵盖跨平台路径、当前账号选择、加密登录读取、模型字段和 1M 长度、快照回退、凭证隔离、请求地址约束和 token 生命周期。不联网、不领取积分、不调用真实模型。

反馈请提供操作系统、DuMate/magpie 版本及已脱敏的错误信息；不要附 `auth.json`、`.cookie-key`、`plugin-auth.json` 或进程环境变量。

## 来源与许可证

[上游项目](https://github.com/R227BOUT/magpie-dumate) · [修改说明](NOTICE.md) · [MIT License](LICENSE)

DuMate 名称和图标用于识别百度的服务；本项目未经百度或 magpie 官方背书。
