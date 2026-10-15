"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, User, Sparkles } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import {
  registerChatListener,
  type RecognizeChatContext,
} from "@/lib/chatBus";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// 消息 id 自增序列（替代 Date.now，避免触发 react-hooks/purity 校验）
let messageIdSeq = 0;
const nextMessageId = () => `msg-${++messageIdSeq}`;

export default function BirdChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  // 识别结果联动上下文：存在时请求体带 context，头部下方显示小横幅
  const [chatContext, setChatContext] = useState<RecognizeChatContext | null>(
    null
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string, contextOverride?: RecognizeChatContext) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    // contextOverride：监听器触发时代 state 还没更新，直接显式带上本次 ctx
    const activeContext = contextOverride ?? chatContext;

    const userMsg: Message = {
      id: nextMessageId(),
      role: "user",
      content: trimmed,
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          ...(activeContext ? { context: activeContext } : {}),
        }),
      });

      if (!res.ok) throw new Error("请求失败");

      const data = await res.json();
      const assistantMsg: Message = {
        id: nextMessageId(),
        role: "assistant",
        content: data.content || "抱歉，我暂时无法回答这个问题。",
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: nextMessageId(),
          role: "assistant",
          content: "⚠️ 连接失败，请确保后端服务已启动（python backend/main.py）",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // ref 永远指向最新 sendMessage，供模块级监听器调用（规避闭包过期读到旧 state）
  const sendMessageRef = useRef(sendMessage);
  useEffect(() => {
    sendMessageRef.current = sendMessage;
  });

  // 识别页「问 AI」联动：开窗 + 带上识别结果上下文 + 自动代发一条提问 🐦
  useEffect(() => {
    return registerChatListener((ctx) => {
      setChatContext(ctx);
      setIsOpen(true);
      void sendMessageRef.current("帮我看看这次的识别结果", ctx);
    });
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    await sendMessage(input);
  };

  const handleQuickAsk = (question: string) => {
    void sendMessage(question);
  };

  return (
    <>
      {/* 悬浮按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-lg transition-all duration-300 hover:scale-110 ${
          isOpen
            ? "bg-red-500 hover:bg-red-600 rotate-90"
            : "bg-emerald-600 hover:bg-emerald-700"
        }`}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <MessageCircle className="w-6 h-6 text-white" />
        )}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] h-[500px] bg-white rounded-2xl shadow-2xl border border-emerald-100 flex flex-col overflow-hidden">
          {/* 头部 */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm">BirdVibe AI 向导</h3>
              <p className="text-emerald-100 text-xs">基于知识库 + 通义千问</p>
            </div>
          </div>

          {/* 识别结果联动小横幅：告诉用户（和 AI）当前在咨询哪组候选 */}
          {chatContext && (
            <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
              <p className="flex-1 text-xs font-bold text-amber-700 truncate">
                🔍 正在咨询识别结果：
                {chatContext.candidates.map((c) => c.name).join("、")}
              </p>
              <button
                type="button"
                onClick={() => setChatContext(null)}
                aria-label="清除识别结果上下文"
                className="p-1 rounded-full text-amber-400 hover:text-amber-600 hover:bg-amber-100 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* 消息列表 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <Bot className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">你好！我是你的观鸟 AI 助手 🐦</p>
                <p className="text-gray-400 text-xs mt-1">可以问我：</p>
                <div className="mt-3 space-y-2">
                  {[
                    { label: "八哥和乌鸫怎么区分？", question: "八哥和乌鸫怎么区分？" },
                    { label: "新加坡哪里能看到翠鸟？", question: "新加坡哪里能看到翠鸟？" },
                    { label: "树麻雀有什么特点？", question: "树麻雀有什么特点？" },
                    // 只有文字描述、没拍到照片的兜底入口 📝
                    { label: "没看到鸟？描述给我听", question: "我想找一种鸟，但只有文字描述" },
                  ].map((q) => (
                    <button
                      key={q.label}
                      onClick={() => handleQuickAsk(q.question)}
                      className="block w-full text-left px-3 py-2 text-xs bg-white rounded-lg border border-emerald-100 text-emerald-700 hover:bg-emerald-50 transition-colors"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-2 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {message.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-emerald-600" />
                  </div>
                )}

                <div
                  className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    message.role === "user"
                      ? "bg-emerald-600 text-white rounded-br-md"
                      : "bg-white text-gray-700 border border-gray-100 shadow-sm rounded-bl-md"
                  }`}
                >
                  {message.content}
                </div>

                {message.role === "user" && (
                  <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-gray-600" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* 输入框 */}
          <form onSubmit={handleSubmit} className="p-3 bg-white border-t border-gray-100">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="问问关于鸟的问题..."
                className="flex-1 px-4 py-2.5 bg-gray-50 rounded-xl text-sm border border-gray-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="p-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
