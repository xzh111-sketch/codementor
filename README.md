# CodeMentor

> AI 编程学习与求职辅导助手，Spring Boot + LangChain4j + Vue 3 前后端分离实现

[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.5.3-brightgreen.svg)](https://spring.io/projects/spring-boot)
[![LangChain4j](https://img.shields.io/badge/LangChain4j-1.1.0-blue.svg)](https://github.com/langchain4j/langchain4j)
[![Vue.js](https://img.shields.io/badge/Vue.js-3.3.4-4FC08D.svg)](https://vuejs.org/)
[![Java](https://img.shields.io/badge/Java-21-orange.svg)](https://www.oracle.com/java/)

一个面向编程学习和求职面试场景的 AI 助手。用户可以咨询学习路线、项目选择、简历优化、面试技巧等问题，助手会结合本地知识库检索和联网搜索来回答，并以流式方式实时输出。

项目的重点是把大模型能力工程化地接进业务：用 LangChain4j 的声明式 AI 服务定义对话能力，再统一装配会话记忆、内容检索器、工具和护轨，让模型调用层与业务逻辑解耦。

## 仓库结构

| 目录 | 说明 | 技术栈 |
| --- | --- | --- |
| `codementor-backend` | 后端服务，提供流式对话接口 | Java 21、Spring Boot 3.5、LangChain4j、通义千问 |
| `codementor-frontend` | 前端应用，聊天界面 | Vue 3、Vite、Axios、Marked、EventSource |

## 功能特性

- **多轮对话**：按会话 ID 隔离上下文，滑动窗口保留最近 10 条消息
- **流式输出**：后端通过 SSE 分段推送，前端实时渲染，打字机效果
- **RAG 检索增强**：本地知识库文档切片、向量化入库，检索时按相似度召回
- **工具调用**：把面试题检索封装成模型可自主调用的工具
- **MCP 接入**：通过 MCP 协议接入联网搜索，补充训练数据之外的实时信息
- **输入护轨**：敏感词校验，命中后直接终止请求
- **可观测性**：记录每次模型请求、响应和异常，便于排查问题

## 快速开始

### 1. 配置密钥

密钥不放在受版本控制的配置里。在 `codementor-backend/src/main/resources/` 下新建 `application-local.yml`（该文件已被 `.gitignore` 忽略）：

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

三个 DashScope 配置项填同一个 Key 即可，`bigmodel` 是另一个平台的 Key，需要单独申请。`application.yml` 中保留的是占位符，通过 `spring.config.import` 自动加载本地配置。

### 2. 启动后端

```bash
cd codementor-backend
mvn spring-boot:run
```

服务地址为 `http://localhost:8081/api`。启动时会读取 `src/main/resources/docs` 下的文档并做向量化入库，这一步会调用向量化接口，首次启动需要等待一会儿。

> 知识库使用的是相对路径，需要在后端目录下启动，否则加载不到文档。

### 3. 启动前端

```bash
cd codementor-frontend
npm install
npm run dev
```

前端地址为 `http://localhost:3000`。

## 接口

对话接口使用 SSE 推送，通过 `memoryId` 区分会话上下文：

```
GET /api/ai/chat?memoryId=1&message=你好
```

流结束时服务端会补发一个 `done` 事件，客户端据此主动关闭连接。

## 已知限制

知识库文档、会话记忆和向量库都存放在内存中，服务重启后会话上下文会清空，向量库会重新构建。生产环境需要替换为持久化方案。

## 更多说明

- 后端实现细节见 [codementor-backend/README.md](codementor-backend/README.md)
- 前端实现细节见 [codementor-frontend/README.md](codementor-frontend/README.md)
