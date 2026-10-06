# AI 编程小助手

基于 LangChain4j + 通义千问的 AI 编程学习与求职辅导助手，前后端分离，支持流式对话。

[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.5.3-brightgreen.svg)](https://spring.io/projects/spring-boot)
[![LangChain4j](https://img.shields.io/badge/LangChain4j-1.1.0-blue.svg)](https://github.com/langchain4j/langchain4j)
[![Vue.js](https://img.shields.io/badge/Vue.js-3.3.4-4FC08D.svg)](https://vuejs.org/)
[![Java](https://img.shields.io/badge/Java-21-orange.svg)](https://www.oracle.com/java/)

## 项目简介

一个面向编程学习和求职面试场景的 AI 助手。用户可以咨询学习路线、项目选择、简历优化、面试技巧等问题，助手会结合本地知识库和联网搜索来回答，并以流式方式实时输出。

项目的重点是把大模型能力工程化地接进业务：用 LangChain4j 的声明式 AI 服务定义对话能力，再统一装配会话记忆、内容检索器、工具和护轨，让模型调用层和业务逻辑解耦，新增一种调用方式只需要扩展接口方法。

## 功能特性

### AI 能力

- **声明式 AI 服务**：用接口加注解定义 AI 能力，由 LangChain4j 在运行时生成实现，支持对话、结构化报告、RAG 问答、流式对话四种调用形态
- **多轮会话记忆**：按会话 ID 隔离上下文，滑动窗口保留最近 10 条消息，避免多用户并发下的上下文串扰
- **结构化输出**：可以直接返回结构化对象，比如把学习建议映射成固定字段的报告
- **流式响应**：后端基于 SSE 逐段推送，前端实时渲染，实现打字机效果

### 检索与工具

- **RAG 检索增强**：加载本地文档，按段落切分（1000 字、200 字重叠）后向量化入库，检索时取相似度 Top5 并按阈值过滤
- **工具调用**：把面试题搜索封装成模型可自主调用的工具，模型按需触发
- **MCP 协议**：通过 MCP 接入联网搜索，让模型能够获取训练数据之外的实时信息

### 安全与可观测性

- **输入护轨**：对用户输入做敏感词校验，命中后直接终止请求
- **模型监听**：记录每次请求、响应和异常，便于定位问题

## 技术栈

| 层次 | 技术 |
| --- | --- |
| 后端框架 | Spring Boot 3.5、Java 21 |
| AI 框架 | LangChain4j 1.1、langchain4j-mcp、langchain4j-reactor |
| 大模型 | 通义千问 qwen-max（对话）、text-embedding-v4（向量化） |
| 数据与检索 | 内存向量库、Jsoup 网页解析 |
| 前端 | Vue 3、Vite、Axios、Marked、EventSource |

## 快速开始

### 环境要求

- JDK 21+
- Maven 3.6+
- Node.js 16+
- 通义千问（DashScope）API Key：用于对话模型和向量化模型
- BigModel API Key：用于 MCP 联网搜索

### 1. 配置 API Key

真实密钥放在 `src/main/resources/application-local.yml`。这个文件已经被 `.gitignore` 忽略，不会提交到仓库，克隆项目后需要自己新建一份：

```yaml
langchain4j:
  community:
    dashscope:
      chat-model:
        api-key: <你的 DashScope API Key>
      streaming-chat-model:
        api-key: <你的 DashScope API Key>
      embedding-model:
        api-key: <你的 DashScope API Key>
bigmodel:
  api-key: <你的 BigModel API Key>
```

`application.yml` 里只保留占位符，并通过 `spring.config.import` 自动加载 `application-local.yml`，本地文件存在时以它为准，所以密钥不会出现在提交到仓库的配置里。

上面三个 DashScope 配置项填同一个 Key 即可；`bigmodel` 是另一个平台的 Key，需要单独申请。

### 2. 启动后端

```bash
cd ai-code-helper-master
mvn spring-boot:run
```

后端启动时会读取 `src/main/resources/docs` 下的文档并做向量化入库，这一步会调用向量化接口，首次启动需要等一会儿。

> 注意：知识库使用的是相对路径，需要在后端目录下启动，否则加载不到文档。

### 3. 启动前端

```bash
cd ai-code-helper-frontend
npm install
npm run dev
```

### 4. 访问应用

- 前端地址：`http://localhost:3000`
- 后端接口：`http://localhost:8081/api`

## 接入说明

对话接口使用 SSE 推送，每个会话通过 `memoryId` 区分上下文：

```
GET /api/ai/chat?memoryId=1&message=你好
```

返回：

```
data:你好

data:！有什么可以帮你的吗？
```

## 项目结构

```
ai-code-helper-master/
└── src/main
    ├── java/
    │   ├── ai                  # AI 服务层
    │   │   ├── AiCodeHelperService.java          # AI 服务接口定义
    │   │   ├── AiCodeHelperServiceFactory.java   # 装配模型、记忆、检索器和工具
    │   │   ├── guardrail/      # 输入护轨
    │   │   ├── listener/       # 模型调用监听
    │   │   ├── mcp/            # MCP 工具接入
    │   │   ├── model/          # 对话模型配置
    │   │   ├── rag/            # 检索增强配置
    │   │   └── tools/          # 自定义工具
    │   ├── config/             # 跨域等全局配置
    │   └── controller/         # 接口层
    └── resources
        ├── application.yml     # 模型与密钥配置
        ├── system-prompt.txt   # 系统提示词
        └── docs/               # RAG 知识库文档
```

## 核心模块

- `AiCodeHelperService`：AI 服务接口，定义对话、报告、RAG 问答和流式对话能力
- `AiCodeHelperServiceFactory`：装配 ChatModel、StreamingChatModel、ChatMemory、ContentRetriever 和工具
- `QwenChatModelConfig`：对话模型配置
- `RagConfig`：文档加载、切分、向量化和检索配置
- `McpConfig`：MCP 客户端与联网搜索工具
- `InterviewQuestionTool`：面试题搜索工具
- `SafeInputGuardrail`：输入安全防护
- `ChatModelListenerConfig`：对话监听，输出请求、响应与异常日志

## 说明

知识库文档、会话记忆和向量库都存放在内存中，服务重启后会话上下文会清空，向量库会重新构建。生产环境需要替换为持久化方案。

## 致谢

- [LangChain4j](https://github.com/langchain4j/langchain4j)
- [阿里云百炼（通义千问）](https://bailian.console.aliyun.com/)
- [Spring Boot](https://spring.io/projects/spring-boot)
- [Vue.js](https://vuejs.org/)
