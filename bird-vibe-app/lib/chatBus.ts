// 🚌 极简发布订阅：把「识别结果」等外部事件送进全局 AI 聊天窗
// 纯回调注册，不碰 window/document，服务端组件树也能安全 import

export interface RecognizeChatContext {
  type: "recognize_result";
  candidates: { name: string; confidence: number }[];
}

type ChatListener = (ctx: RecognizeChatContext) => void;

// 模块级监听器集合（聊天窗挂载时注册，卸载时取消）
const listeners = new Set<ChatListener>();

export function registerChatListener(fn: ChatListener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function openChatWithContext(ctx: RecognizeChatContext): void {
  listeners.forEach((fn) => fn(ctx));
}
