/**
 * dsh-feiyu-avatar —— 宿主半边
 * ============================================================================
 * 只干三件事：
 *   1. 存头像图（DSH_HOME/dsh-feiyu-avatar/），鱼的默认读用户设置的那个路径
 *   2. 开路由把图吐给页面：/dsh-feiyu-avatar/user、/assistant
 *   3. 开 /config 读写配置（开关、大小、鱼的头像路径），设置页改完立刻生效
 *
 * 头像本身由浏览器那半边用 CSS 画在聊天行上（见 client.js），
 * 宿主这边不碰页面结构。
 * ============================================================================
 */
import {
  existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'feiyu-avatar'
export const inject = ['webServer']

const PACKAGE_ROOT = fileURLToPath(new URL('.', import.meta.url))

// 状态目录：跟着 DSH_HOME 走
const DSH_HOME = process.env.DSH_HOME || join(homedir(), '.dsh')
const STORE = join(DSH_HOME, 'dsh-feiyu-avatar')
const CONFIG_PATH = join(STORE, 'config.json')

// 不预设任何图片：第一次装好之后，鱼的头像由用户自己选（设置页里上传或填路径）。
// 这是故意的 —— 作者机器上的图片路径不该出现在别人的默认配置里。
const DEFAULT_ASSISTANT = ''

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
}

const DEFAULTS = {
  enabled: true,
  size: 36,
  assistantPath: DEFAULT_ASSISTANT,
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))

function diag(msg) {
  try {
    mkdirSync(STORE, { recursive: true })
    writeFileSync(join(STORE, 'diag.log'), `${new Date().toISOString()}  ${msg}\n`, { flag: 'a' })
  } catch { /* 诊断失败不影响主流程 */ }
}

function loadConfig() {
  try {
    const raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
    return {
      enabled: raw.enabled !== false,
      size: clamp(Math.round(Number(raw.size) || DEFAULTS.size), 24, 64),
      assistantPath: typeof raw.assistantPath === 'string' && raw.assistantPath.trim()
        ? raw.assistantPath.trim()
        : DEFAULT_ASSISTANT,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

function saveConfig(next) {
  try {
    mkdirSync(STORE, { recursive: true })
    const tmp = `${CONFIG_PATH}.tmp`
    writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8')
    renameSync(tmp, CONFIG_PATH)
  } catch (e) {
    diag(`存配置失败：${e && e.message}`)
  }
}

/** 找出用户上传的那张图（user.png / user.jpg …），没有就返回 null。 */
function findImage(basename) {
  try {
    const re = new RegExp(`^${basename}\\.(png|jpe?g|webp|gif)$`, 'i')
    for (const file of readdirSync(STORE)) {
      if (re.test(file)) return join(STORE, file)
    }
  } catch { /* 目录还没有 */ }
  return null
}

const userImage = () => findImage('user')

function assistantFile(cfg) {
  if (cfg.assistantPath && existsSync(cfg.assistantPath)) return cfg.assistantPath
  return findImage('assistant')
}

const assistantImage = (cfg) => assistantFile(cfg) !== null

function state(cfg) {
  return {
    ok: true,
    config: cfg,
    userImage: userImage() !== null,
    assistantImage: assistantImage(cfg),
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify(payload))
}

function sendImage(res, file) {
  try {
    const buf = readFileSync(file)
    res.writeHead(200, {
      'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store',
    })
    res.end(buf)
    return true
  } catch {
    return false
  }
}

function readBody(req, limit = 12 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

async function jsonBody(req) {
  const raw = await readBody(req)
  return raw.length ? JSON.parse(raw.toString('utf8')) : {}
}

const notFound = (res, what) => {
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
  res.end(`no ${what} avatar`)
}

export function apply(ctx) {
  const cfg = loadConfig()
  mkdirSync(STORE, { recursive: true })

  // 一条路径只能注册一次（(kind, path) 必须唯一），method 在 handler 里派发
  const route = (path, handlers) => {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact',
      path,
      handler: async (req, res) => {
        const fn = handlers[req.method] || handlers.ANY
        if (!fn) return sendJson(res, 405, { ok: false, error: 'method not allowed' })
        try {
          await fn(req, res)
        } catch (e) {
          diag(`${path} 失败：${e && e.message}`)
          try { sendJson(res, 500, { ok: false, error: String(e && e.message) }) } catch { /* 已发过 */ }
        }
      },
    }))
  }

  route('/dsh-feiyu-avatar/user', {
    GET: async (req, res) => {
      const file = userImage()
      if (!file || !sendImage(res, file)) notFound(res, 'user')
    },
  })

  route('/dsh-feiyu-avatar/assistant', {
    GET: async (req, res) => {
      const file = assistantFile(cfg)
      if (!file || !sendImage(res, file)) notFound(res, 'assistant')
    },
  })

  route('/dsh-feiyu-avatar/config', {
    GET: async (req, res) => sendJson(res, 200, state(cfg)),
    POST: async (req, res) => {
      const patch = await jsonBody(req)
      if (typeof patch.enabled === 'boolean') cfg.enabled = patch.enabled
      if (patch.size != null) cfg.size = clamp(Math.round(Number(patch.size) || DEFAULTS.size), 24, 64)
      if (typeof patch.assistantPath === 'string') {
        cfg.assistantPath = patch.assistantPath.trim()
      }
      saveConfig(cfg)
      return sendJson(res, 200, state(cfg))
    },
  })

  // 上传头像：前端读成 data URL 发过来，这边落盘成 user.<ext> / assistant.<ext>
  route('/dsh-feiyu-avatar/upload', {
    POST: async (req, res) => {
      const { which, dataUrl } = await jsonBody(req)
      if (which !== 'user' && which !== 'assistant') {
        return sendJson(res, 400, { ok: false, error: 'unknown avatar' })
      }
      const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(String(dataUrl || ''))
      if (!m) return sendJson(res, 400, { ok: false, error: 'bad image data' })
      const ext = m[1] === 'image/png' ? '.png'
        : m[1] === 'image/webp' ? '.webp'
          : m[1] === 'image/gif' ? '.gif'
            : '.jpg'
      const buf = Buffer.from(m[2], 'base64')
      if (buf.length > 8 * 1024 * 1024) return sendJson(res, 413, { ok: false, error: 'image too large' })
      const previous = findImage(which)
      const target = join(STORE, `${which}${ext}`)
      writeFileSync(target, buf)
      if (previous && previous !== target) {
        try { rmSync(previous) } catch { /* 旧文件删不掉也不影响 */ }
      }
      if (which === 'assistant') {
        // 上传的图优先于路径：把路径清空，免得两个来源打架
        cfg.assistantPath = ''
        saveConfig(cfg)
      }
      diag(`收到新头像 ${which}${ext}，${buf.length} 字节`)
      return sendJson(res, 200, state(cfg))
    },
  })

  diag(`feiyu-avatar 已加载，鱼的头像：${cfg.assistantPath || '(未设置)'}`)
}
