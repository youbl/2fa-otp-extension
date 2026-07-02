# beinetOtpExt — 浏览器内的 2FA / OTP 验证码扩展

> 📖 English version: [README.md](README.md)

一个轻量的 Chrome / Edge 扩展（Manifest V3），把你的 2FA TOTP 密钥集中在浏览器里管理，**无需手机、无需任何独立 App**，即可生成、复制 OTP 验证码，并支持从二维码图片导入、导出到手机。

> 已上架 Edge 扩展商店（没上 Chrome 商店只是因为懒得交注册费，Edge 免费）：
> https://microsoftedge.microsoft.com/addons/detail/beinetotpext/ldnafnofjkedpacfpcekjlpbbecplepl

---

## 介绍

平时登录各种网站用的两步验证（2FA）码，大多依赖手机上的 Google Authenticator 之类的 App。但很多时候人就坐在电脑前，掏手机反而麻烦——尤其手机在 VPN 里、或在充电时。这个扩展就是为了解决这个问题：**把 OTP 密钥放在浏览器里，点一下扩展图标即可看到所有验证码并一键复制**。

同时它解决了几个实际痛点：

- **码快过期来不及粘贴** —— 悬停在某个验证码上，会同时显示「当前码」和「下一个码」，两个都能点击复制。
- **从手机迁移到电脑** —— 支持识别标准 `otpauth://` 二维码，**也支持 Google Authenticator App 「导出账户」生成的批量迁移二维码**（`otpauth-migration://`），一次导入多个密钥。
- **从电脑迁移到手机** —— 每条密钥可生成二维码，用手机 App 扫码即可导入（比如手机上的 VPN 也需要 OTP 时）。
- **跨设备同步** —— 密钥存在 `chrome.storage.sync`，登录同一浏览器账号自动同步。

### 截图

![主界面](otp1.png)

![添加密钥 / 选择二维码文件识别](otp2.png)

![批量导出到粘贴板](otp3.png)

![单个二维码导出](otp4.png)

![悬停显示当前码与下一码](otp5.png)

---

## 功能特性

| 功能 | 说明 |
| --- | --- |
| TOTP 生成 | SHA1 / 6 位 / 30 秒周期，兼容 Google Authenticator 等主流 App |
| 实时刷新 | 每秒刷新验证码，并显示当前码剩余有效秒数 |
| 一键复制 | 点击验证码即复制到剪贴板 |
| 当前码 + 下一码 | 鼠标悬停浮层同时展示两个码，均可点击复制，避免码临过期来不及粘贴 |
| 二维码导入 | 上传二维码图片，自动识别 `otpauth://` 中的 secret |
| Google Authenticator 批量导入 | 支持 `otpauth-migration://` 导出二维码，一次性导入多个密钥 |
| 二维码导出 | 为每条密钥生成二维码，供手机 App 扫码导入 |
| 剪贴板导出 / 导入 | 全量密钥以文本格式导出到剪贴板，可粘贴备份或跨设备导入 |
| 站点快捷跳转 | 每条密钥可关联 URL，一键在新标签页打开 |
| 中英双语 | 一键切换 中文 / English，选择会被记住 |
| 自定义弹窗 | 用自定义对话框替代浏览器原生 `alert`，体验更一致 |
| ESC 关闭弹窗 | 按 Esc 关闭任意打开的对话框 |

---

## 安装

### 方式一：Edge 商店（推荐，最省事）

点击上方 Edge 商店链接，直接安装即可。

### 方式二：从源码加载（Chrome / Edge 开发者模式）

1. 下载本仓库代码（`git clone` 或下载 ZIP 并解压）。
2. 打开浏览器，进入 `chrome://extensions`（Edge 为 `edge://extensions`）。
3. 打开右上角「开发者模式」。
4. 点击「加载已解压的扩展程序」，选择本仓库根目录（包含 `manifest.json` 的文件夹）。
5. 工具栏出现扩展图标，点击即可使用。

---

## 使用说明

### 添加密钥

1. 点击扩展图标，点 **Add Key / 添加密钥**。
2. 填写：
   - **Title / 标题**：给这条密钥起个名字（必填）。
   - **URL**：关联的网站地址（可选，填了会显示「URL」按钮一键打开）。
   - **Otp-Key / 密钥**：TOTP 的 secret 字符串（必填，通常是 Base32 编码的字母数字串）。
3. 密钥可以**手填**，也可以点 **QrCode / 识别二维码** 上传二维码图片自动识别填入。
4. 点 **Save / 保存**。

### 生成与复制验证码

- 添加后，列表里每行会实时显示当前验证码和剩余秒数。
- **点击验证码** → 复制到剪贴板。
- **鼠标悬停在验证码上** → 弹出浮层，同时显示「当前码（蓝色）」和「下一码（绿色）」，点击任意一个即可复制。

### 二维码导入（含 Google Authenticator 批量导出）

- 在添加密钥对话框里点 **QrCode**，选择二维码图片。
- 支持：
  - 网站「设置两步验证」时给出的标准二维码（`otpauth://totp/...?secret=...`）；
  - **Google Authenticator App 内「导出账户」生成的二维码**（`otpauth-migration://offline?data=...`），会解析其中的 protobuf 数据，取出第一条密钥填入 secret 字段。
- 识别后建议补填 Title，再保存。

### 二维码导出（给手机用）

- 列表每行右侧有 **QRCode / 二维码** 按钮，鼠标悬停即弹出该密钥的二维码。
- 用手机上的 Google Authenticator 等 App 扫码即可导入。适用于「手机端也需要这个 OTP」（如手机 VPN 登录）的场景。

### 备份与迁移（剪贴板导出 / 导入）

- **Export to Clipboard / 导出到粘贴板**：把全部密钥以文本复制到剪贴板，格式为每行一条：
  ```
  标题:secret|url
  ```
  （无 URL 时省略 `|url`）。请粘贴到安全的地方妥善保存。
- **Import from Clipboard / 从粘贴板导入**：把上述格式文本复制到剪贴板后点此按钮，会提示即将导入几条，确认后写入。**同名标题会被覆盖**。

### 其它

- **DEL / 删除**：删除某条密钥（会二次确认，不可恢复）。
- **URL 按钮**：在新标签页打开该密钥关联的网站。
- **中文 / English**：切换语言，选择会记忆。
- **右上角电源图标**：关闭弹窗。
- **Esc**：关闭任意打开的对话框。

---

## 数据存储与格式

- 密钥保存在 `chrome.storage.sync` 的 `key` 字段下（随浏览器账号跨设备同步），结构：
  ```json
  {
    "Amazon": { "secret": "JBSWY3DPEHPK3PXP", "url": "https://amazon.com" },
    "GitHub": { "secret": "GEZDGNBVGY3TQOJQ", "url": "" }
  }
  ```
  兼容旧版本（值为纯 secret 字符串）。
- 全局配置（如语言）保存在 `configs` 字段下。
- 导出/导入的文本格式：`标题:secret|url`，无 URL 时为 `标题:secret`，每行一条。

---

## 安全说明

- **权限极简**：仅申请 `clipboardRead`、`clipboardWrite`、`storage` 三个权限，无网络、无标签页、无主机权限。除读取本地语言文件 `js/zh-CN.json` 外不发起任何网络请求，密钥不会上传到任何服务器。
- **TOTP 参数**：使用业界标准的 SHA1 / 6 位 / 30 秒，与 Google Authenticator、Microsoft Authenticator 等完全兼容。
- **跨设备同步的取舍**：`chrome.storage.sync` 会把密钥随浏览器账号同步到云端（便于多设备使用）。若你完全不希望密钥离开本机，可改用 `chrome.storage.local`（需自行改 `popup.js` 中的 `setStorage` / `getStorage`），或仅在不开启同步的浏览器 profile 中使用。
- **导出文本请妥善保管**：剪贴板导出的是明文密钥，等于账户的第二因素凭证，请按密码级别保管，不要贴到公开位置。

---

## 技术栈与项目结构

纯原生 HTML / CSS / JavaScript，**无构建步骤、无依赖管理**，clone 下来即可加载运行。

```
├── manifest.json          # Manifest V3 配置
├── popup.html             # 扩展弹窗界面
├── popup.js               # 主逻辑（在 js/ 下）
├── js/
│   ├── popup.js           # 全部业务逻辑：TOTP 生成、二维码解析/生成、导入导出、多语言等
│   ├── otpauth.umd.min.js # TOTP 计算库
│   ├── jsQR.js            # 二维码识别库
│   ├── qrcode.min.js      # 二维码生成库
│   ├── base32.min.js      # Base32 编解码（解析 Google 导出数据用）
│   └── zh-CN.json         # 中英翻译映射
├── img/                   # 界面图标（关闭、电源按钮）
├── one.png / one128.png   # 扩展图标
└── otp1.png ~ otp3.png    # README 截图
```

### 关键实现点

- **TOTP 生成**：`getCode(secret)` 使用 `OTPAuth.TOTP`，固定 SHA1/6位/30秒；每秒由 `setInterval(refreshCode, 1000)` 刷新。
- **下一码预览**：`getNextCode` 临时覆写 `Date.now()` 模拟下一周期来生成下一码（仅用于浮层预览，不影响主流程）。
- **Google Authenticator 迁移二维码解析**：`parseSecretFromGoogleAppExport` + `parseMigrationPayload` 手写 protobuf varint 解码，从 `otpauth-migration://` 的 base64 data 中提取 name 与 secret，并把 secret 原始字节做 Base32 编码。
- **事件绑定防重复**：通过 `bindclick` / `hover-bindclick` 等属性标记，避免动态添加行时重复绑定监听器。

---

## 本地开发

无需安装任何依赖，直接用浏览器加载源码目录即可调试（见上方「从源码加载」）。修改 `popup.js` 或 `popup.html` 后，在扩展管理页点「重新加载」即可生效。

---

## License

开源项目，欢迎自行部署和修改。如需二次分发，请保留作者信息。
