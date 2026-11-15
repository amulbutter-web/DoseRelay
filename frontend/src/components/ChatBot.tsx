import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, Minus, X, Maximize2, Bot } from 'lucide-react';
import apiClient from '../api/client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const SUGGESTED_QUESTIONS = [
  'How do I add a hospital?',
  'What is Days of Cover?',
  'How is surplus calculated?',
  'Show current transfer stats',
];

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages or loading state
  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen, isMinimized]);

  // Focus textarea when opened or un-minimized
  useEffect(() => {
    if (isOpen && !isMinimized) {
      textareaRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  const handleSend = async (customMessage?: string) => {
    const textToSend = (customMessage !== undefined ? customMessage : input).trim();
    if (!textToSend || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: textToSend,
      timestamp: new Date(),
    };

    // 1. Add user message to state
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    if (!customMessage) {
      setInput('');
    }

    // 2. Set isLoading = true
    setIsLoading(true);

    try {
      // 3. POST to /api/v1/chat with message and last 10 messages of conversation history
      const historyPayload = messages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await apiClient.post<{ response: string }>('/chat', {
        message: textToSend,
        conversation_history: historyPayload,
      });

      // 4. On success: add assistant message, setIsLoading = false
      const botMessage: Message = {
        role: 'assistant',
        content: res.data.response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (err: any) {
      const status = err?.response?.status;

      // 5. Error handling
      if (status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return;
      }

      let errorText = 'An error occurred while connecting to the assistant. Please try again.';
      if (status === 503) {
        errorText = 'AI Assistant not configured. Please set up Groq API key.';
      } else if (status === 429) {
        errorText = 'Rate limit reached. Please wait a minute.';
      } else if (err?.response?.data?.detail) {
        errorText = String(err.response.data.detail);
      }

      const errorBotMessage: Message = {
        role: 'assistant',
        content: errorText,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorBotMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          aria-label="Open AI Assistant"
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg flex items-center justify-center transition-all transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-blue-300"
        >
          <MessageCircle className="w-7 h-7" />
        </button>
      )}

      {/* Chat window */}
      {isOpen && (
        <div
          className={`fixed bottom-6 right-6 z-50 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col transition-all duration-200 ${
            isMinimized ? 'h-auto' : 'h-[520px] max-h-[600px]'
          }`}
        >
          {/* Header */}
          <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between select-none">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white leading-tight">DoseRelay AI Assistant</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-[11px] text-slate-300 font-medium">Online</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsMinimized(!isMinimized)}
                aria-label={isMinimized ? 'Maximize' : 'Minimize'}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Chat Window Body (hidden if minimized) */}
          {!isMinimized && (
            <>
              {/* Messages area */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-slate-50/60">
                {/* System greeting */}
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 text-blue-600">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="max-w-[85%] bg-slate-100 text-slate-800 rounded-2xl rounded-tl-sm p-3 text-sm shadow-sm leading-relaxed">
                    Hi! I'm your DoseRelay AI Assistant. How can I help you today?
                  </div>
                </div>

                {/* Suggested questions (shown only when no conversation yet) */}
                {messages.length === 0 && (
                  <div className="space-y-1.5 pt-1 pl-10">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Suggested questions:
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {SUGGESTED_QUESTIONS.map((question) => (
                        <button
                          key={question}
                          type="button"
                          onClick={() => handleSend(question)}
                          className="text-left text-xs bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 rounded-xl px-3 py-2 transition-all font-medium shadow-2xs"
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Conversation messages */}
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex flex-col ${
                      msg.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <div className="max-w-[85%] bg-blue-600 text-white rounded-2xl rounded-tr-sm p-3 text-sm shadow-sm whitespace-pre-wrap leading-relaxed">
                        {msg.content}
                      </div>
                    ) : (
                      <div className="flex items-start gap-2.5 max-w-full">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 text-blue-600">
                          <Bot className="w-4 h-4" />
                        </div>
                        <div className="max-w-[85%] bg-slate-100 text-slate-800 rounded-2xl rounded-tl-sm p-3 text-sm shadow-sm whitespace-pre-wrap leading-relaxed">
                          {msg.content}
                        </div>
                      </div>
                    )}
                    <span
                      className={`text-[10px] text-slate-400 mt-1 ${
                        msg.role === 'user' ? 'mr-1' : 'ml-10'
                      }`}
                    >
                      {msg.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}

                {/* Loading indicator */}
                {isLoading && (
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 text-blue-600">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5 shadow-sm">
                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input area */}
              <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask DoseRelay AI..."
                  disabled={isLoading}
                  className="w-full resize-none border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 max-h-24 overflow-y-auto"
                />
                <button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  aria-label="Send message"
                  className="h-9 w-9 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl flex items-center justify-center shrink-0 transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
