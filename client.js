/**
 * dsh-feiyu-avatar —— 浏览器半边
 * ============================================================================
 * 头像不是 React 组件，是一层 CSS：聊天每条消息的外层容器上带着
 * data-chat-flow-kind（user / assistant-step），我们只给这两类行留出边距，
 * 再把头像画成绝对定位的圆。消息内容本身一个像素都不动。
 *
 *   用户消息（右）→ ::after  贴在行右边缘
 *   AI 消息（左）  → ::before 贴在行左边缘
 *
 * 设置里改开关 / 大小 / 换图之后，直接把 <style> 的文本换掉，立刻生效。
 * ============================================================================
 */
window.__ModuleLoader__.load({
  id: 'dsh-feiyu-avatar',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement

    const API = '/dsh-feiyu-avatar'

    let styleEl = null
    let cfg = { enabled: true, size: 36 }
    let have = { user: false, assistant: false }

    function buildCss(config, availability, stamp) {
      if (!config || config.enabled === false) return ''
      const size = Number(config.size) || 36
      const gutter = size + 14
      const v = stamp || Date.now()
      const rules = [
        '[data-chat-flow-kind="user"],[data-chat-flow-kind="assistant-step"]{position:relative}',
        '[data-chat-flow-kind="user"]::after,[data-chat-flow-kind="assistant-step"]::before{',
        'content:"";position:absolute;top:2px;box-sizing:border-box;',
        `width:${size}px;height:${size}px;border-radius:50%;`,
        'background-color:rgba(127,127,127,.16);background-size:cover;background-position:center;background-repeat:no-repeat;',
        'border:1px solid rgba(127,127,127,.28);box-shadow:0 1px 4px rgba(0,0,0,.16);',
        'pointer-events:none;user-select:none}',
      ]
      if (availability.user) {
        rules.push(`[data-chat-flow-kind="user"]{padding-right:${gutter}px}`)
        rules.push(`[data-chat-flow-kind="user"]::after{right:0;background-image:url("${API}/user?v=${v}")}`)
      }
      if (availability.assistant) {
        rules.push(`[data-chat-flow-kind="assistant-step"]{padding-left:${gutter}px}`)
        rules.push(`[data-chat-flow-kind="assistant-step"]::before{left:0;background-image:url("${API}/assistant?v=${v}")}`)
      }
      return rules.join('\n')
    }

    function paint(stamp) {
      if (!styleEl) return
      const next = buildCss(cfg, have, stamp)
      if (styleEl.textContent !== next) styleEl.textContent = next
    }

    function absorb(payload) {
      if (!payload) return
      if (payload.config) cfg = payload.config
      have = { user: Boolean(payload.userImage), assistant: Boolean(payload.assistantImage) }
    }

    const getJson = async (url) => {
      const res = await fetch(url, { headers: { accept: 'application/json' }, cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    }
    const postJson = async (url, body) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body || {}),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    }

    const CSS = `
[data-fa-wrap]{display:flex;flex-direction:column;gap:16px;padding:4px 2px 24px}
[data-fa-note]{font-size:12px;opacity:.66;line-height:1.55}
[data-fa-sec]{display:flex;flex-direction:column;gap:10px}
[data-fa-h]{font-size:13px;font-weight:600;opacity:.88;padding-top:8px;border-top:1px solid rgba(127,127,127,.18)}
[data-fa-row]{display:flex;align-items:center;gap:14px}
[data-fa-grow]{flex:1;min-width:160px}
[data-fa-face]{width:52px;height:52px;border-radius:50%;object-fit:cover;flex:0 0 auto;background:rgba(127,127,127,.14);border:1px solid rgba(127,127,127,.28)}
[data-fa-btn]{padding:6px 12px;border-radius:7px;border:1px solid rgba(127,127,127,.35);background:transparent;color:inherit;font-size:13px;cursor:pointer}
[data-fa-btn]:hover{background:rgba(127,127,127,.12)}
[data-fa-input]{padding:6px 9px;border-radius:7px;border:1px solid rgba(127,127,127,.35);background:transparent;color:inherit;font-size:13px;width:100%;box-sizing:border-box}
[data-fa-msg]{font-size:12px;opacity:.8;min-height:16px}
`

    function Panel() {
      const [state, setState] = React.useState(null)
      const [msg, setMsg] = React.useState('')
      const [stamp, setStamp] = React.useState(Date.now())
      const [size, setSize] = React.useState(36)
      const [path, setPath] = React.useState('')
      const userInput = React.useRef(null)
      const aiInput = React.useRef(null)

      const flash = (text) => {
        setMsg(text)
        setTimeout(() => setMsg(''), 2500)
      }

      React.useEffect(() => {
        getJson(`${API}/config`).then((d) => {
          setState(d)
          if (d && d.config) {
            setSize(d.config.size || 36)
            setPath(d.config.assistantPath || '')
          }
        }).catch((e) => flash(`读取失败：${e.message}`))
      }, [])

      const patch = async (body, label) => {
        try {
          const d = await postJson(`${API}/config`, body)
          setState(d)
          absorb(d)
          paint(Date.now())
          setStamp(Date.now())
          flash(`${label}已保存`)
        } catch (e) {
          flash(`保存失败：${e.message}`)
        }
      }

      const upload = (which, file) => {
        if (!file) return
        const reader = new FileReader()
        reader.onload = async () => {
          try {
            const d = await postJson(`${API}/upload`, { which, dataUrl: reader.result })
            setState(d)
            absorb(d)
            if (d && d.config) setPath(d.config.assistantPath || '')
            paint(Date.now())
            setStamp(Date.now())
            flash('头像已更新')
          } catch (e) {
            flash(`上传失败：${e.message}`)
          }
        }
        reader.onerror = () => flash('这张图读不出来，换一张试试')
        reader.readAsDataURL(file)
      }

      if (!state) return h('div', { 'data-fa-wrap': '' }, h('div', { 'data-fa-note': '' }, '读取中…'))

      const config = state.config || {}

      return h('div', { 'data-fa-wrap': '' },

        h('div', { 'data-fa-h': '', style: { borderTop: 'none', paddingTop: 0 } }, '聊天头像'),
        h('div', { 'data-fa-note': '' },
          '像微信那样一人一张：你的在右边，AI 的在左边。改完立刻生效，已经打开的对话不用刷新。'),

        h('div', { 'data-fa-row': '' },
          h('div', { 'data-fa-grow': '' },
            h('div', { style: { fontSize: 13 } }, '在聊天里显示头像'),
            h('div', { 'data-fa-note': '' }, '关掉之后聊天恢复原样，图不会被删')),
          h('input', {
            type: 'checkbox',
            checked: config.enabled !== false,
            onChange: (e) => patch({ enabled: e.target.checked }, '开关'),
          })),

        h('div', { 'data-fa-row': '' },
          h('div', { 'data-fa-grow': '' },
            h('div', { style: { fontSize: 13 } }, `头像大小 ${size}px`),
            h('div', { 'data-fa-note': '' }, '24 太小、64 太抢戏，36 差不多是微信的尺寸')),
          h('input', {
            type: 'range', min: 24, max: 64, step: 2, value: size, style: { width: 180 },
            onChange: (e) => setSize(Number(e.target.value)),
            onMouseUp: () => patch({ size }, '大小'),
            onTouchEnd: () => patch({ size }, '大小'),
          })),

        h('div', { 'data-fa-sec': '' },
          h('div', { 'data-fa-h': '' }, '你的头像'),
          h('div', { 'data-fa-row': '' },
            state.userImage
              ? h('img', { 'data-fa-face': '', alt: '', src: `${API}/user?v=${stamp}` })
              : h('div', { 'data-fa-face': '', style: { opacity: 0.4 } }),
            h('div', { 'data-fa-grow': '' },
              h('div', { style: { fontSize: 13 } }, state.userImage ? '已经换好了' : '还没上传'),
              h('div', { 'data-fa-note': '' }, '正方形最好；不是正方形会自动裁成圆')),
            h('button', { 'data-fa-btn': '', onClick: () => userInput.current && userInput.current.click() }, '选择图片'),
            h('input', {
              ref: userInput, type: 'file', accept: 'image/*', style: { display: 'none' },
              onChange: (e) => upload('user', e.target.files && e.target.files[0]),
            }))),

        h('div', { 'data-fa-sec': '' },
          h('div', { 'data-fa-h': '' }, 'AI 的头像'),
          h('div', { 'data-fa-row': '' },
            state.assistantImage
              ? h('img', { 'data-fa-face': '', alt: '', src: `${API}/assistant?v=${stamp}` })
              : h('div', { 'data-fa-face': '', style: { opacity: 0.4 } }),
            h('div', { 'data-fa-grow': '' },
              h('div', { style: { fontSize: 13 } }, state.assistantImage ? '已经在用了' : '还没设置'),
              h('div', { 'data-fa-note': '' }, '可以上传一张，也可以直接填图片的绝对路径 —— 填路径的好处是：以后覆盖那个文件，头像自动跟着变')),
            h('button', { 'data-fa-btn': '', onClick: () => aiInput.current && aiInput.current.click() }, '选择图片'),
            h('input', {
              ref: aiInput, type: 'file', accept: 'image/*', style: { display: 'none' },
              onChange: (e) => upload('assistant', e.target.files && e.target.files[0]),
            })),
          h('input', {
            'data-fa-input': '', value: path, placeholder: 'D:\\pictures\\ai-avatar.png（留空 = 不用文件）',
            onChange: (e) => setPath(e.target.value),
            onBlur: () => patch({ assistantPath: path }, '路径'),
            onKeyDown: (e) => { if (e.key === 'Enter') patch({ assistantPath: path }, '路径') },
          })),

        h('div', { 'data-fa-msg': '' }, msg),
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        styleEl = document.createElement('style')
        styleEl.setAttribute('data-plugin-css', 'dsh-feiyu-avatar')
        document.head.appendChild(styleEl)
        ctx.effect(() => () => {
          styleEl && styleEl.remove()
          styleEl = null
        }, 'dsh-feiyu-avatar: 头像样式')

        const panelStyle = document.createElement('style')
        panelStyle.setAttribute('data-plugin-css', 'dsh-feiyu-avatar-panel')
        panelStyle.textContent = CSS
        document.head.appendChild(panelStyle)
        ctx.effect(() => () => panelStyle.remove(), 'dsh-feiyu-avatar: 设置页样式')

        getJson(`${API}/config`).then((d) => {
          absorb(d)
          paint(Date.now())
        }).catch(() => { /* 宿主还没起来就先不画 */ })

        const slots = (typeof ctx.get === 'function' ? ctx.get('slots') : undefined) || ctx.slots
        if (!slots) return
        slots.inject('settings.section', () => slots.register(
          { name: 'settings.section', id: 'feiyu-avatar', order: 41, label: '聊天头像' },
          () => h(Panel),
        ))
      },
    }
  },
})
