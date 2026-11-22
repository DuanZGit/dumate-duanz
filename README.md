# dumate-duanz

将百度搭子 DuMate 的个人积分接入 **magpie / OpenCode**。

血缘：[R227BOUT/magpie-dumate](https://github.com/R227BOUT/magpie-dumate) → [RanceLee233/dumate-rance](https://github.com/RanceLee233/dumate-rance) → 本仓库。前两层的修改见 [NOTICE.md](NOTICE.md)。

本层新增：

- **可读模型名 + 把价格交给 magpie**。`deepseek-v41-flash` 显示为 `DeepSeek-V4.1 Flash`，`glm-53-flash` 显示为 `GLM-5.3 Flash`。插件不再自己打印倍率百分比——那是被编造的数字；它把实测积分换算成 `cost`（USD / 百万 token）交给 magpie，由 magpie 按和其它 provider 相同的方式算 ×N 比值。
- **积分分池显示**。控制器的 `quota_overview` 把同一钱包里 `product:"comate"` 等其它产品的积分也合进了 `totalPoints`。usage 现在按 `product` 拆成独立窗口：DuMate 自己的包只统计 `status:"active"` 的（排队中的未来期次不计入，否则余额会被夸成好几倍），其它产品的共享积分单独成行、按服务器原样列出（不区分状态）；同时显示订阅是第几期、最早过期的积分何时清零。
- **客户端版本号**。UA 中的 `DuMate/x.y.z` 目前是 `1.0.91`（官方个人版最新为 1.0.94）。版本号并不控制控制台或网关接口（1.0.60 / 0.82 / 0.91 表现一致），这里的取值只是维持一个合理的客户端指纹。

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

## 模型名与价格

`catalog.mjs` 把网关返回的模型 id 映射成可读名，并把每个模型的价格写进 `cost`（USD / 百万 token）。**倍率不由本插件给出**——magpie 自己按 `cost` 算它那套 ×N 比值，和任何其它 provider 放在一起比。

百度文档只写“模型调用消耗…统一折算为积分”，没有任何 per-model 积分表，客户端界面也不展示倍率。所以插件不编造倍率，只把手里的两个事实交出去：实测的积分扣减量，和一个把积分换成钱的单价。

### 积分换算成美元

```
Pro: ¥59 / 25000 积分  →  每积分 ¥0.00236
汇率 7.10              →  每积分 ≈ $0.000332
cost(USD/M) = 积分每千 token × 1000 × 0.000332
```

两个常量是假设：¥59/25000 来自产品计费页的 Pro 档，Max 档或兑换券单价不同；汇率是当日的。它们不需要精确——magpie 的倍率是相对值，所有模型用同一个系数，比值就成立。

### 实测积分（2026-11-13）

每千 **output** token 消耗的积分。这些是价格的唯一依据，方法：对真实网关打两次不同长度的调用，从 `usedPoints` 差值解斜率。

| 模型 | id | 积分/千 output |
| --- | --- | --- |
| Kimi K3 | `kimi-k3` | 6.235 |
| Qwen2.5-VL-32B | `qwen2.5-vl-32b-instruct` | 2.024 |
| 自动路由（默认） | `model-text` | 2.014 |
| DeepSeek-V4-Flash-0731 | `deepseek-v4-flash-0731` | 2.007 |
| DeepSeek-V4.1 Flash | `deepseek-v41-flash` | 2.000 |
| 文心 ERNIE-4.5 Turbo VL | `ernie-4.5-turbo-vl-32k` | 1.997 |
| Qwen3.8 Max | `qwen3.8-max` | 1.905 |
| 豆包 Seed 2.0 Pro | `doubao-seed-2-0-pro` | 0.193 |
| GLM-5.3 Flash | `glm-53-flash` | 0.122 |
| Kimi K3.1 | `kimi-k31` | 0.117 |
| Qwen3.8 Flash | `qwen38-flash` | 0.100 |
| DeepSeek-V4 Pro | `deepseek-v4-pro` | 0.100 |
| Qwen3.5-397B-A17B | `qwen3.5-397b-a17b` | 0.098 |
| GLM-5.3 | `glm-53` | 0.087 |
| Qwen3.5-27B | `qwen3.5-27b` | 0.067 |
| Qwen3.5-35B-A3B | `qwen3.5-35b-a3b` | 0.050 |

input 侧只实测了四个（DeepSeek-V4.1 Flash 0.611、Kimi K3 1.213、Qwen3.8 Max 0.625、DeepSeek-V4 Pro 0.089 积分/千），其余按 output 的 0.30 估（实测那几个的比值落在 0.305~0.328）。缓存读写网关不公布，按 input 的 10% / 100% 估。

`dm-auto-model/*` 六个自动路由别名**不给价格**：具体模型由百度侧在请求时决定，钉一个数字就是撒谎。`model-text` 例外——它实测就是 2.014，接近 DeepSeek-V4.1 Flash。

精度边界：积分余额只有两位小数，单次短调用只扣 0.03–0.07 分，低价档的相对误差约 ±10%，所以 GLM-5.3、Qwen3.5-27B 这些的价格只能当量级看。要重测用 `node scripts/measure-rates.mjs <模型id>`，它读本机 `plugin-auth.json` 打两次真实调用解斜率，遇 429 自动退避。

`/v1/models` 里的 `pricing` 字段是模型的公开美元价，和积分折算不成比例，**不要**拿它当成本。

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

消息里的 http(s) 图片外链会在本机先下载并转成 base64 再发给百度（0.4.2 起）：千帆后端自己抓图经常被对方拒绝（400 `fetch object failed`），本机下载则基本都能成。下载失败（404、防盗链、超过 10MB）时保留原 URL，由后端照旧处理。

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
