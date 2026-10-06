package com.xzh.aicodehelper.controller;

import com.xzh.aicodehelper.ai.AiCodeHelperService;
import jakarta.annotation.Resource;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/ai")
public class AiController {

    @Resource
    private AiCodeHelperService aiCodeHelperService;

    @GetMapping("/chat")
    public Flux<ServerSentEvent<String>> chat(int memoryId, String message) {
        Flux<ServerSentEvent<String>> content = aiCodeHelperService.chatStream(memoryId, message)
                .map(chunk -> ServerSentEvent.<String>builder()
                        .data(chunk)
                        .build());
        // 流结束时补一个 done 事件，前端收到后主动关闭连接。
        // 否则服务端正常关闭连接时，浏览器会把它当成 error 再触发一次 onerror
        ServerSentEvent<String> done = ServerSentEvent.<String>builder()
                .event("done")
                .data("[DONE]")
                .build();
        return content.concatWith(Mono.just(done));
    }
}
