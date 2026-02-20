"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  citations?: { content: string; source: string; similarity: number }[];
}

interface ChatInterfaceProps {
  endpoint: string;
  placeholder?: string;
  extraBody?: Record<string, unknown>;
  onStreamComplete?: (response: string) => void;
}

export default function ChatInterface({
  endpoint,
  placeholder = "Ask a question...",
  extraBody = {},
  onStreamComplete,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || streaming) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setStreaming(true);

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMessage, ...extraBody }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullResponse = "";
      let citations: ChatMessage["citations"] = [];

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "chunk") {
              fullResponse += event.content;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: fullResponse, citations };
                return updated;
              });
            } else if (event.type === "citations") {
              citations = event.citations;
            } else if (event.type === "answer") {
              fullResponse = event.content;
              citations = event.citations || [];
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: fullResponse, citations };
                return updated;
              });
            }
          } catch {
            // skip malformed events
          }
        }
      }

      onStreamComplete?.(fullResponse);
    } catch (err) {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", content: `Error: ${err instanceof Error ? err.message : "Request failed"}` },
      ]);
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.length === 0 && (
          <div className="text-center py-12 text-white/20 font-body text-sm">
            Ask a question to get started
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-xl px-4 py-3 text-sm font-body ${
                msg.role === "user"
                  ? "bg-gold/20 text-white border border-gold/20"
                  : "bg-white/[0.03] text-white/80 border border-white/5"
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                  <p className="text-xs text-white/30 uppercase tracking-wider">Sources</p>
                  {msg.citations.map((c, j) => (
                    <div key={j} className="text-xs p-2 rounded bg-white/[0.03] border border-white/5">
                      <span className="text-gold/60 font-mono">{c.source}</span>
                      <span className="text-white/20 ml-2">({(c.similarity * 100).toFixed(0)}%)</span>
                      <p className="text-white/40 mt-1 line-clamp-2">{c.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {streaming && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/5">
              <Loader2 size={14} className="text-gold spinner" />
              <span className="text-white/40 text-sm font-body">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
          placeholder={placeholder}
          disabled={streaming}
          className="flex-1 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-white text-sm font-body placeholder:text-white/20 focus:outline-none focus:border-gold/30 disabled:opacity-50"
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || streaming}
          className="px-4 py-3 rounded-xl bg-gold/20 border border-gold/20 text-gold hover:bg-gold/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
