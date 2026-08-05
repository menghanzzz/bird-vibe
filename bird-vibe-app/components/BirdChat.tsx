"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, User, Sparkles } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function BirdChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("http://localhost:8000/api/v1/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages.map((m) => ({ role: m.role, content: m.content })) }),
      });

      if (!res.ok) throw new Error("请求失败");

      const data = await res.json();
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.content || "抱歉，我暂时无法回答这个问题。",
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "⚠️ 连接失败，请确保后端服务已启动（python backend/main.py）",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAsk = (question: string) => {
    setInput(question);
    // 延迟一点让 setInput 生效后再提交
    setTimeout(() => {
      const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
      handleSubmit(fakeEvent);
    }, 50);
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

          {/* 消息列表 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <Bot className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">你好！我是你的观鸟 AI 助手 🐦</p>
                <p className="text-gray-400 text-xs mt-1">可以问我：</p>
                <div className="mt-3 space-y-2">
                  {[
                    "八哥和乌鸫怎么区分？",
                    "新加坡哪里能看到翠鸟？",
                    "树麻雀有什么特点？",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => handleQuickAsk(q)}
                      className="block w-full text-left px-3 py-2 text-xs bg-white rounded-lg border border-emerald-100 text-emerald-700 hover:bg-emerald-50 transition-colors"
                    >
                      {q}
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
