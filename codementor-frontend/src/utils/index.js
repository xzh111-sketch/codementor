import { marked } from 'marked'

// marked 全局配置只在这里设置一次
marked.setOptions({
    breaks: true, // 支持换行
    gfm: true // 支持 GitHub 风格 Markdown
})

/**
 * 生成会话 ID
 * @returns {number} 适合 int 范围的会话 ID
 */
export function generateMemoryId() {
    // 后端接口按 int 接收，结果限制在 1 ~ 2147483646
    // 时间戳拼接随机数，避免同一毫秒内打开多个标签页时撞 ID
    const timePart = Date.now() % 100000000
    const randomPart = Math.floor(Math.random() * 1000000)
    return (timePart * 1000000 + randomPart) % 2147483646 + 1
}

/**
 * 给渲染结果里的链接补上 target="_blank"，让外链在新标签页打开。
 * v-html 渲染出来的 a 标签默认没有 target，点击会在当前页跳走，
 * 页面被重新加载后组件状态被重置，历史对话就丢了。
 * 同时挡掉 javascript: 这类非 http(s) 协议。
 * @param {string} html Markdown 渲染出的 HTML
 * @returns {string} 处理后的 HTML
 */
function makeLinksOpenInNewTab(html) {
    if (!html) {
        return ''
    }
    const doc = new DOMParser().parseFromString(html, 'text/html')
    doc.querySelectorAll('a[href]').forEach(link => {
        const href = link.getAttribute('href') || ''
        if (/^https?:\/\//i.test(href)) {
            link.setAttribute('target', '_blank')
            link.setAttribute('rel', 'noopener noreferrer')
        } else {
            // 相对路径、锚点和 javascript: 一律不给跳转能力
            link.removeAttribute('href')
        }
    })
    return doc.body.innerHTML
}

/**
 * 渲染 Markdown 为 HTML
 * @param {string} text Markdown 文本
 * @returns {string} HTML 字符串
 */
export function renderMarkdown(text) {
    if (!text) {
        return ''
    }
    return makeLinksOpenInNewTab(marked.parse(text))
}

/**
 * 格式化时间
 * @param {Date} date 日期对象
 * @returns {string} 格式化后的时间字符串
 */
export function formatTime(date) {
    const now = new Date()
    const diff = now - date
    
    if (diff < 60000) { // 1分钟内
        return '刚刚'
    } else if (diff < 3600000) { // 1小时内
        return `${Math.floor(diff / 60000)}分钟前`
    } else if (diff < 86400000) { // 1天内
        return `${Math.floor(diff / 3600000)}小时前`
    } else {
        return date.toLocaleDateString()
    }
}

/**
 * 防抖函数
 * @param {Function} func 要防抖的函数
 * @param {number} wait 等待时间
 * @returns {Function} 防抖后的函数
 */
export function debounce(func, wait) {
    let timeout
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout)
            func(...args)
        }
        clearTimeout(timeout)
        timeout = setTimeout(later, wait)
    }
} 
