import axios from 'axios'

// 配置axios基础URL
const API_BASE_URL = 'http://localhost:8081/api'

/**
 * 使用 SSE 方式调用聊天接口
 * @param {number} memoryId 聊天室ID
 * @param {string} message 用户消息
 * @param {Function} onMessage 接收消息的回调函数
 * @param {Function} onError 错误处理回调函数
 * @param {Function} onClose 连接关闭回调函数
 * @returns {EventSource} 返回 EventSource 对象，用于手动关闭连接
 */
export function chatWithSSE(memoryId, message, onMessage, onError, onClose) {
    // 构建URL参数
    const params = new URLSearchParams({
        memoryId: memoryId,
        message: message
    })
    
    // 创建 EventSource 连接
    const eventSource = new EventSource(`${API_BASE_URL}/ai/chat?${params}`)

    // finished：本次请求已经有结论，避免重复回调
    // receivedData：是否收到过模型输出，用来区分"服务端正常关闭连接"和"压根没连上"
    let finished = false
    let receivedData = false

    // 统一收口：无论是正常结束还是出错，都只回调一次，并确保连接被关闭
    const settle = (isError, error) => {
        if (finished) {
            return
        }
        finished = true
        eventSource.close()
        if (isError) {
            console.error('SSE 连接错误:', error)
            onError && onError(error)
        } else {
            onClose && onClose()
        }
    }

    // 处理接收到的消息
    eventSource.onmessage = function(event) {
        try {
            const data = event.data
            if (data && data.trim() !== '') {
                receivedData = true
                onMessage(data)
            }
        } catch (error) {
            console.error('解析消息失败:', error)
            settle(true, error)
        }
    }

    // 服务端在流结束时发送的结束标记：主动关闭连接，
    // 这样浏览器就不会再把"连接关闭"当成错误
    eventSource.addEventListener('done', function() {
        settle(false)
    })

    // 处理错误：只有真正出错时才上报
    eventSource.onerror = function(error) {
        if (finished) {
            return
        }
        // 收到过内容说明流已经跑完，只是连接被关闭，按正常结束处理；
        // 一个字都没收到才是真的失败（比如后端没启动）
        if (receivedData) {
            settle(false)
        } else {
            settle(true, error)
        }
    }
    
    return eventSource
}

/**
 * 检查后端服务是否可用
 * @returns {Promise<boolean>} 返回服务是否可用
 */
export async function checkServiceHealth() {
    try {
        const response = await axios.get(`${API_BASE_URL}/health`, {
            timeout: 5000
        })
        return response.status === 200
    } catch (error) {
        console.error('服务健康检查失败:', error)
        return false
    }
} 
