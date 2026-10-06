<template>
  <div class="app">
    <!-- 头部标题 -->
    <div class="app-header">
      <button class="new-chat-btn" @click="startNewChat">新对话</button>
      <h1 class="app-title">AI 编程小助手</h1>
      <div class="app-subtitle">帮助您解答编程学习和求职面试相关问题</div>
    </div>

    <!-- 聊天区域 -->
    <div class="chat-container">
      <!-- 消息列表 -->
      <div class="messages-container" ref="messagesContainer">
        <div v-if="messages.length === 0" class="welcome-message">
          <div class="welcome-content">
            <div class="welcome-icon">🤖</div>
            <h2>欢迎使用 AI 编程小助手</h2>
            <p>我可以帮助您：</p>
            <ul>
              <li>解答编程技术问题</li>
              <li>提供代码示例和解释</li>
              <li>协助求职面试准备</li>
              <li>分享编程学习建议</li>
            </ul>
            <p>请随时向我提问吧！</p>
          </div>
        </div>

        <!-- 历史消息 -->
        <ChatMessage
          v-for="message in messages"
          :key="message.id"
          :message="message.content"
          :is-user="message.isUser"
          :timestamp="message.timestamp"
        />

        <!-- AI 正在回复的消息 -->
        <div v-if="isAiTyping" class="chat-message ai-message">
          <div class="message-avatar">
            <div class="avatar ai-avatar">AI</div>
          </div>
          <div class="message-content">
            <div class="message-bubble">
              <div class="ai-typing-content">
                <div
                  class="ai-response-text message-markdown"
                  v-html="currentAiResponseRendered"
                ></div>
                <LoadingDots v-if="isStreaming" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 输入框 -->
      <ChatInput
        :disabled="isAiTyping"
        @send-message="sendMessage"
        placeholder="请输入您的编程问题..."
      />
    </div>

    <!-- 连接状态提示 -->
    <div v-if="connectionError" class="connection-error">
      <div class="error-content">
        <span class="error-icon">⚠️</span>
        <span>连接服务器失败，请检查后端服务是否启动</span>
      </div>
    </div>
  </div>
</template>

<script>
import ChatMessage from './components/ChatMessage.vue'
import ChatInput from './components/ChatInput.vue'
import LoadingDots from './components/LoadingDots.vue'
import { chatWithSSE } from './api/chatApi.js'
import { generateMemoryId, renderMarkdown } from './utils/index.js'

const STORAGE_KEY = 'aichat'

export default {
  name: 'App',
  components: {
    ChatMessage,
    ChatInput,
    LoadingDots
  },
  data() {
    return {
      messages: [],
      memoryId: null,
      isAiTyping: false,
      isStreaming: false,
      currentAiResponse: '',
      currentEventSource: null,
      connectionError: false
    }
  },
  computed: {
    currentAiResponseRendered() {
      return renderMarkdown(this.currentAiResponse)
    }
  },
  watch: {
    messages: {
      deep: true,
      handler(messages) {
        this.persistMessages(messages)
      }
    }
  },
  methods: {
    sendMessage(message) {
      // 添加用户消息
      this.addMessage(message, true)
      
      // 开始AI回复
      this.startAiResponse(message)
    },
    
    addMessage(content, isUser = false) {
      const message = {
        id: Date.now() + Math.random(),
        content,
        isUser,
        timestamp: new Date()
      }
      this.messages.push(message)
      this.scrollToBottom()
    },

    // 会话内容存到 localStorage，刷新或从外链返回后可以恢复
    persistMessages(messages) {
      try {
        localStorage.setItem(STORAGE_KEY + ':messages', JSON.stringify(messages))
      } catch (error) {
        console.warn('会话记录保存失败:', error)
      }
    },

    startAiResponse(userMessage) {
      this.isAiTyping = true
      this.isStreaming = true
      this.currentAiResponse = ''
      this.connectionError = false
      
      // 关闭之前的连接
      if (this.currentEventSource) {
        this.currentEventSource.close()
      }
      
      // 开始SSE连接
      this.currentEventSource = chatWithSSE(
        this.memoryId,
        userMessage,
        this.handleAiMessage,
        this.handleAiError,
        this.handleAiClose
      )
    },
    
    handleAiMessage(data) {
      this.currentAiResponse += data
      this.scrollToBottom()
    },
    
    handleAiError(error) {
      console.error('AI 回复出错:', error)
      this.connectionError = true
      this.finishAiResponse()
      
      // 5秒后自动隐藏错误提示
      setTimeout(() => {
        this.connectionError = false
      }, 5000)
    },
    
    handleAiClose() {
      this.finishAiResponse()
    },
    
    finishAiResponse() {
      this.isStreaming = false
      
      // 如果有内容，添加到消息列表
      if (this.currentAiResponse.trim()) {
        this.addMessage(this.currentAiResponse.trim(), false)
      }
      
      // 重置状态
      this.isAiTyping = false
      this.currentAiResponse = ''
      
      // 重置连接错误状态（确保正常结束时清除错误提示）
      this.connectionError = false
      
      // 关闭连接
      if (this.currentEventSource) {
        this.currentEventSource.close()
        this.currentEventSource = null
      }
    },
    
    scrollToBottom() {
      this.$nextTick(() => {
        const container = this.$refs.messagesContainer
        if (container) {
          container.scrollTop = container.scrollHeight
        }
      })
    },

    initializeChat() {
      let storedMemoryId = null
      let storedMessages = null
      try {
        storedMemoryId = localStorage.getItem(STORAGE_KEY + ':memoryId')
        storedMessages = localStorage.getItem(STORAGE_KEY + ':messages')
      } catch (error) {
        console.warn('读取历史会话失败:', error)
      }

      // 复用已有的会话 ID，保证后端还能找到同一段会话记忆
      const memoryId = Number(storedMemoryId)
      this.memoryId = Number.isInteger(memoryId) && memoryId > 0 ? memoryId : generateMemoryId()
      this.saveMemoryId()

      // 恢复历史消息，timestamp 需要转回 Date，否则时间显示会变成 NaN
      if (storedMessages) {
        try {
          this.messages = JSON.parse(storedMessages).map(message => ({
            ...message,
            timestamp: new Date(message.timestamp)
          }))
          this.scrollToBottom()
        } catch (error) {
          console.warn('解析历史会话失败:', error)
          this.messages = []
        }
      }
      console.log('聊天室ID:', this.memoryId)
    },

    saveMemoryId() {
      try {
        localStorage.setItem(STORAGE_KEY + ':memoryId', String(this.memoryId))
      } catch (error) {
        console.warn('会话 ID 保存失败:', error)
      }
    },

    // 清空当前对话并开启一段新的后端会话
    startNewChat() {
      if (this.currentEventSource) {
        this.currentEventSource.close()
        this.currentEventSource = null
      }
      this.isAiTyping = false
      this.isStreaming = false
      this.currentAiResponse = ''
      this.connectionError = false
      this.messages = []
      this.memoryId = generateMemoryId()
      this.saveMemoryId()
      this.persistMessages([])
      console.log('已开启新会话，聊天室ID:', this.memoryId)
    }
  },
  
  mounted() {
    this.initializeChat()
  },
  
  beforeUnmount() {
    // 组件销毁前关闭连接
    if (this.currentEventSource) {
      this.currentEventSource.close()
    }
  }
}
</script>

<style scoped>
.app {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f0f0f0;
}

.app-header {
  background-color: #fff;
  padding: 20px;
  border-bottom: 1px solid #e1e5e9;
  text-align: center;
  position: relative;
}

.new-chat-btn {
  position: absolute;
  top: 20px;
  right: 20px;
  padding: 6px 14px;
  font-size: 13px;
  color: #333;
  background-color: #fff;
  border: 1px solid #d0d5dd;
  border-radius: 16px;
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.new-chat-btn:hover {
  background-color: #f2f4f7;
  border-color: #98a2b3;
}

.app-title {
  font-size: 24px;
  font-weight: bold;
  color: #333;
  margin: 0;
}

.app-subtitle {
  font-size: 14px;
  color: #666;
  margin-top: 5px;
}

.chat-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px 0;
}

.welcome-message {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  padding: 0 20px;
}

.welcome-content {
  text-align: center;
  max-width: 400px;
  color: #666;
}

.welcome-icon {
  font-size: 48px;
  margin-bottom: 20px;
}

.welcome-content h2 {
  font-size: 20px;
  margin-bottom: 15px;
  color: #333;
}

.welcome-content p {
  margin-bottom: 10px;
  line-height: 1.5;
}

.welcome-content ul {
  text-align: left;
  margin: 15px 0;
}

.welcome-content li {
  margin-bottom: 5px;
}

/* AI 正在回复时的消息样式 */
.chat-message {
  display: flex;
  margin-bottom: 20px;
  padding: 0 20px;
}

.ai-message {
  justify-content: flex-start;
  flex-direction: row;
}

.message-avatar {
  display: flex;
  align-items: flex-start;
  margin: 0 10px;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: bold;
  color: white;
}

.ai-avatar {
  background-color: #6c757d;
}

.message-content {
  max-width: 70%;
  min-width: 100px;
}

.message-bubble {
  padding: 12px 16px;
  border-radius: 18px;
  position: relative;
  word-wrap: break-word;
  word-break: break-word;
  background-color: #f1f3f4;
  color: #333;
  border-bottom-left-radius: 4px;
}

.ai-typing-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ai-response-text {
  font-size: 14px;
  line-height: 1.5;
}

/* AI实时回复的Markdown样式 */
.ai-response-text.message-markdown h1,
.ai-response-text.message-markdown h2,
.ai-response-text.message-markdown h3,
.ai-response-text.message-markdown h4,
.ai-response-text.message-markdown h5,
.ai-response-text.message-markdown h6 {
  margin: 0.5em 0;
  font-weight: bold;
}

.ai-response-text.message-markdown h1 { font-size: 1.5em; }
.ai-response-text.message-markdown h2 { font-size: 1.3em; }
.ai-response-text.message-markdown h3 { font-size: 1.2em; }
.ai-response-text.message-markdown h4 { font-size: 1.1em; }
.ai-response-text.message-markdown h5 { font-size: 1em; }
.ai-response-text.message-markdown h6 { font-size: 0.9em; }

.ai-response-text.message-markdown p {
  margin: 0.5em 0;
}

.ai-response-text.message-markdown ul,
.ai-response-text.message-markdown ol {
  margin: 0.5em 0;
  padding-left: 1.5em;
}

.ai-response-text.message-markdown li {
  margin: 0.2em 0;
}

.ai-response-text.message-markdown code {
  background-color: rgba(0, 0, 0, 0.1);
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.9em;
}

.ai-response-text.message-markdown pre {
  background-color: rgba(0, 0, 0, 0.1);
  padding: 1em;
  border-radius: 5px;
  overflow-x: auto;
  margin: 0.5em 0;
}

.ai-response-text.message-markdown pre code {
  background-color: transparent;
  padding: 0;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.9em;
}

.ai-response-text.message-markdown blockquote {
  border-left: 4px solid #ccc;
  padding-left: 1em;
  margin: 0.5em 0;
  font-style: italic;
  color: #666;
}

.ai-response-text.message-markdown a {
  color: #007bff;
  text-decoration: underline;
}

.ai-response-text.message-markdown table {
  border-collapse: collapse;
  width: 100%;
  margin: 0.5em 0;
}

.ai-response-text.message-markdown th,
.ai-response-text.message-markdown td {
  border: 1px solid #ddd;
  padding: 0.5em;
  text-align: left;
}

.ai-response-text.message-markdown th {
  background-color: #f2f2f2;
  font-weight: bold;
}

.ai-response-text.message-markdown hr {
  border: none;
  border-top: 1px solid #ddd;
  margin: 1em 0;
}

.connection-error {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background-color: #ff4444;
  color: white;
  padding: 10px 20px;
  border-radius: 5px;
  z-index: 1000;
  animation: slideDown 0.3s ease-out;
}

.error-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.error-icon {
  font-size: 16px;
}

@keyframes slideDown {
  from {
    transform: translateX(-50%) translateY(-100%);
    opacity: 0;
  }
  to {
    transform: translateX(-50%) translateY(0);
    opacity: 1;
  }
}

/* 滚动条样式 */
.messages-container::-webkit-scrollbar {
  width: 6px;
}

.messages-container::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.messages-container::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.messages-container::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

@media (max-width: 768px) {
  .app-header {
    padding: 15px;
  }

  .new-chat-btn {
    top: 15px;
    right: 10px;
    padding: 5px 10px;
    font-size: 12px;
  }
  
  .app-title {
    font-size: 20px;
  }
  
  .messages-container {
    padding: 15px 0;
  }
  
  .welcome-content {
    padding: 0 10px;
  }
  
  .message-content {
    max-width: 85%;
  }
  
  .chat-message {
    padding: 0 10px;
  }
}
</style> 
