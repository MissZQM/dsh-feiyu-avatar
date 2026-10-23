# dsh-feiyu-avatar

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）的 Web 聊天界面加上**微信那样的双侧头像**：你的每条消息右侧一个，AI 的回复左侧一个，两侧各自配置、各自可换。

<!-- 有截图之后把下面这行的注释去掉，并把图放进 docs/ -->
<!-- ![预览](docs/preview.png) -->

## 功能

- **你的头像**：贴在你的每条消息右侧（包括运行途中追加的追问）
- **AI 的头像**：贴在 AI 回复左侧
- **各自可配**：显示 / 隐藏、上传图片、头像大小 24–64 px
- **两种来源**：直接上传一张图；或者填一个图片的**绝对路径** —— 填路径的好处是以后覆盖那个文件，头像会自动跟着变
- **不预设任何图片**：没设置就不显示，不会给你一个空圆圈
- 设置入口：**设置 → 聊天头像**
- 改完立刻生效，不用重启，不用刷新
- 客户端只用 `slots`，宿主只用 `webServer`，不依赖任何 `@deepseek-ai/*` 包

## 关于图片

**这个插件不附带任何头像图片。** 装好之后两侧都是空的，头像全部由你自己上传（或指定你自己机器上的图片路径）。

上传的图片和配置只存在你本机的 `$DSH_HOME/dsh-feiyu-avatar/` 下，不会上传到任何服务器，也不会进代码仓库。

## 安装

从 GitHub 直接装：

```bash
dsh plugin add git+https://github.com/MissZQM/dsh-feiyu-avatar.git
# 或者简写
dsh plugin add github:MissZQM/dsh-feiyu-avatar
```

如果用的是命名 profile（比如桌面端），带上 `--profile`：

```bash
dsh plugin --profile desktop add git+https://github.com/MissZQM/dsh-feiyu-avatar.git
```

或者从本地目录装（开发时用）：

```bash
dsh plugin add link:/path/to/dsh-feiyu-avatar
```

装好后刷新一次页面。设置里的「聊天头像」就在侧边栏里。

## 配置

| 项 | 说明 |
| --- | --- |
| 在聊天里显示头像 | 总开关。关掉之后聊天恢复原样，图不会被删 |
| 头像大小 | 24–64 px，默认 36 |
| 你的头像 | 上传一张，自动裁成圆形 |
| AI 的头像 | 上传一张，或者填图片的绝对路径（留空 = 不用文件） |

图片和配置默认存在 `$DSH_HOME/dsh-feiyu-avatar/` 下（`config.json` + `user.*` / `assistant.*`）。

## 它是怎么做的

DSH 的聊天区**没有给头像留插槽**，所以这个插件不去动 React 的消息组件，而是加一层 CSS：聊天里每条消息的外层容器自带 `data-chat-flow-kind`（`user` / `assistant-step`），插件只给这两类行留出内边距，再用 `::before` / `::after` 把头像画成绝对定位的圆。**消息内容一个像素都不动。**

### 兼容性

这层是贴着 DSH 现有聊天结构做的，属于半官方做法。如果 DSH 大改聊天区（换掉 `data-chat-flow-kind` 之类的属性），头像会失效 —— 最坏情况是头像不显示，不会弄坏别的功能。失效了欢迎提 issue。

### 已知限制

- 头像挂在每个 `assistant-step` 行上。工具调用过程通常会被折叠进「思考过程」，所以一轮里一般只看得到一个头像；如果一轮里有多个可见步骤，就会看到多个。
- 只在 Web 界面生效，终端界面没有聊天行，自然也没有头像。

## 开发

```bash
# 目录结构
index.js          宿主半边：路由、读写配置、存图
client.js         浏览器半边：一层 CSS + 设置页
cordis.patch.yml  往 profile 里插一行
locale/*.json     插件列表里的标题和说明
icon.svg          插件图标
```

宿主路由在 `/dsh-feiyu-avatar/` 下：`config`（GET/POST）、`upload`（POST）、`user`（GET 图片）、`assistant`（GET 图片）。

## License

MIT
