import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { v4 as uuidv4 } from 'uuid'
import {
  Send,
  Plus,
  Trash2,
  Settings,
  Zap,
  Copy,
  Check,
  ChevronDown,
  MessageSquare,
  X,
  Menu,
  Sparkles,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────
interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

interface Chat {
  id: string
  title: string
  messages: Message[]
  model: string
  createdAt: number
  updatedAt: number
}

// ─── Models ──────────────────────────────────────────────────────────────────
const MODELS = [
  { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', speed: '⚡ Ultra Fast', desc: '560 t/s · Best for quick replies' },
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', speed: '🚀 Fast', desc: '280 t/s · Flagship quality' },
  { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B', speed: '⚡ Ultra Fast', desc: '1000 t/s · Reasoning + Tools' },
  { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B', speed: '🚀 Fast', desc: '500 t/s · Most capable' },
]

const DEFAULT_SYSTEM = `You are Lightning, an ultra-fast AI assistant powered by Groq's LPU inference engine. 
Be helpful, concise, and accurate. Use markdown for formatting when it improves clarity. 
When writing code, always specify the language and keep examples practical.`

// ─── Helpers ─────────────────────────────────────────────────────────────────
function loadChats(): Chat[] {
  try {
    const raw = localStorage.getItem('lightning-chats')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveChats(chats: Chat[]) {
  localStorage.setItem('lightning-chats', JSON.stringify(chats))
}

function truncate(str: string, n: number) {
  return str.length > n ? str.slice(0, n) + '…' : str
}

// ─── Components ──────────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      <span className="typing-dot w-2 h-2 rounded-full bg-indigo-400" />
      <span className="typing-dot w-2 h-2 rounded-full bg-indigo-400" />
      <span className="typing-dot w-2 h-2 rounded-full bg-indigo-400" />
    </div>
  )
}

function CodeBlock({ children, className }: { children: React.ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false)
  const code = String(children).replace(/\n$/, '')
  const lang = className?.replace('language-', '') || 'text'

  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group my-3">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#0d0d14] border border-[#2a2a3a] border-b-0 rounded-t-lg text-xs text-gray-400">
        <span>{lang}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1 hover:text-white transition-colors"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="!mt-0 !rounded-t-none">
        <code className={className}>{children}</code>
      </pre>
    </div>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      <div
        className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-indigo-700 text-white rounded-br-md'
            : 'bg-[#1e1e2e] border border-[#2a2a3a] text-gray-100 rounded-bl-md'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap text-[0.95rem] leading-relaxed">{message.content}</p>
        ) : (
          <div className="prose prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                code({ className, children, ...props }) {
                  const isBlock = className?.includes('language-')
                  if (isBlock) {
                    return <CodeBlock className={className}>{children}</CodeBlock>
                  }
                  return (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  )
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const [chats, setChats] = useState<Chat[]>(() => loadChats())
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM)
  const [selectedModel, setSelectedModel] = useState(MODELS[0].id)
  const [modelDropdown, setModelDropdown] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const activeChat = chats.find((c) => c.id === activeChatId) || null

  // Persist chats
  useEffect(() => {
    saveChats(chats)
  }, [chats])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeChat?.messages, isStreaming])

  // Create new chat
  const createChat = useCallback(() => {
    const id = uuidv4()
    const newChat: Chat = {
      id,
      title: 'New Chat',
      messages: [],
      model: selectedModel,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    setChats((prev) => [newChat, ...prev])
    setActiveChatId(id)
    setSidebarOpen(false)
    setError(null)
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [selectedModel])

  // Delete chat
  const deleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setChats((prev) => prev.filter((c) => c.id !== id))
    if (activeChatId === id) {
      setActiveChatId(null)
    }
  }

  // Send message
  const sendMessage = async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    let chatId = activeChatId
    let currentMessages: Message[] = []

    if (!chatId) {
      // Auto-create chat
      chatId = uuidv4()
      const newChat: Chat = {
        id: chatId,
        title: truncate(text, 40),
        messages: [],
        model: selectedModel,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      setChats((prev) => [newChat, ...prev])
      setActiveChatId(chatId)
      currentMessages = []
    } else {
      currentMessages = activeChat?.messages || []
    }

    const userMsg: Message = {
      id: uuidv4(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }

    const assistantMsg: Message = {
      id: uuidv4(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }

    // Optimistic update
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId
          ? {
              ...c,
              title: c.messages.length === 0 ? truncate(text, 40) : c.title,
              messages: [...c.messages, userMsg, assistantMsg],
              model: selectedModel,
              updatedAt: Date.now(),
            }
          : c
      )
    )
    setInput('')
    setIsStreaming(true)
    setError(null)

    // Prepare messages for API
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...currentMessages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: text },
    ]

    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          model: selectedModel,
          temperature: 0.7,
          max_tokens: 4096,
          stream: true,
        }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(errData.error || `HTTP ${res.status}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let fullContent = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue
          const data = trimmed.slice(6)
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta?.content
            if (delta) {
              fullContent += delta
              setChats((prev) =>
                prev.map((c) =>
                  c.id === chatId
                    ? {
                        ...c,
                        messages: c.messages.map((m) =>
                          m.id === assistantMsg.id ? { ...m, content: fullContent } : m
                        ),
                        updatedAt: Date.now(),
                      }
                    : c
                )
              )
            }
          } catch {
            // skip malformed chunks
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        // user cancelled
      } else {
        const msg = err instanceof Error ? err.message : 'Something went wrong'
        setError(msg)
        // Remove empty assistant message on error
        setChats((prev) =>
          prev.map((c) =>
            c.id === chatId
              ? {
                  ...c,
                  messages: c.messages.filter((m) => m.id !== assistantMsg.id || m.content),
                }
              : c
          )
        )
      }
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }

  const stopStreaming = () => {
    abortRef.current?.abort()
    setIsStreaming(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
  }

  return (
    <div className="flex h-full bg-[#0a0a0f] text-gray-100">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 bg-[#12121a] border-r border-[#2a2a3a] transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[#2a2a3a]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Zap size={18} className="text-white" />
              </div>
              <span className="font-semibold text-lg tracking-tight">Lightning</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-1.5 rounded-lg hover:bg-[#1a1a25]"
            >
              <X size={18} />
            </button>
          </div>

          {/* New Chat */}
          <div className="p-3">
            <button
              onClick={createChat}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition-colors font-medium text-sm"
            >
              <Plus size={18} />
              New Chat
            </button>
          </div>

          {/* Chat list */}
          <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
            {chats.length === 0 && (
              <p className="text-center text-sm text-gray-500 mt-8">No chats yet</p>
            )}
            {chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => {
                  setActiveChatId(chat.id)
                  setSelectedModel(chat.model)
                  setSidebarOpen(false)
                }}
                className={`w-full group flex items-center gap-2 px-3 py-2.5 rounded-xl text-left text-sm transition-colors ${
                  activeChatId === chat.id
                    ? 'bg-[#1a1a25] text-white'
                    : 'text-gray-400 hover:bg-[#1a1a25] hover:text-gray-200'
                }`}
              >
                <MessageSquare size={16} className="shrink-0 opacity-60" />
                <span className="flex-1 truncate">{chat.title}</span>
                <button
                  onClick={(e) => deleteChat(chat.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 hover:text-red-400 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-[#2a2a3a]">
            <button
              onClick={() => setSettingsOpen(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-400 hover:bg-[#1a1a25] hover:text-gray-200 transition-colors"
            >
              <Settings size={16} />
              Settings
            </button>
            <p className="mt-2 text-[11px] text-gray-600 text-center">
              Powered by Groq LPU · Ultra-fast inference
            </p>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-[#2a2a3a] bg-[#0a0a0f]/95 backdrop-blur sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 rounded-lg hover:bg-[#1a1a25]"
          >
            <Menu size={20} />
          </button>

          {/* Model selector */}
          <div className="relative">
            <button
              onClick={() => setModelDropdown(!modelDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1a1a25] border border-[#2a2a3a] hover:border-indigo-500/50 transition-colors text-sm"
            >
              <Sparkles size={14} className="text-indigo-400" />
              <span className="hidden sm:inline">
                {MODELS.find((m) => m.id === selectedModel)?.name || selectedModel}
              </span>
              <span className="sm:hidden">Model</span>
              <ChevronDown size={14} className="opacity-60" />
            </button>

            {modelDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setModelDropdown(false)} />
                <div className="absolute left-0 top-full mt-2 w-80 bg-[#12121a] border border-[#2a2a3a] rounded-xl shadow-2xl z-50 overflow-hidden">
                  {MODELS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setSelectedModel(m.id)
                        setModelDropdown(false)
                      }}
                      className={`w-full text-left px-4 py-3 hover:bg-[#1a1a25] transition-colors border-b border-[#2a2a3a] last:border-0 ${
                        selectedModel === m.id ? 'bg-indigo-600/10' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{m.name}</span>
                        <span className="text-xs text-indigo-400">{m.speed}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{m.desc}</p>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="flex-1" />

          {isStreaming && (
            <button
              onClick={stopStreaming}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-sm hover:bg-red-500/20 transition-colors"
            >
              Stop
            </button>
          )}
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {!activeChat || activeChat.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/20">
                <Zap size={32} className="text-white" />
              </div>
              <h1 className="text-2xl font-bold mb-2 tracking-tight">Lightning</h1>
              <p className="text-gray-400 max-w-md mb-8">
                Ultra-fast AI chat powered by Groq's custom LPU chips.
                Responses stream at hundreds of tokens per second.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
                {[
                  'Explain quantum computing simply',
                  'Write a React hook for debouncing',
                  'Compare SQL vs NoSQL databases',
                  'Help me debug this Python code',
                ].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => {
                      setInput(prompt)
                      inputRef.current?.focus()
                    }}
                    className="px-4 py-3 rounded-xl bg-[#1a1a25] border border-[#2a2a3a] text-sm text-left hover:border-indigo-500/50 hover:bg-[#1e1e2e] transition-all"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
              {activeChat.messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {isStreaming && activeChat.messages[activeChat.messages.length - 1]?.content === '' && (
                <div className="flex justify-start">
                  <div className="bg-[#1e1e2e] border border-[#2a2a3a] rounded-2xl rounded-bl-md">
                    <TypingIndicator />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mb-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="p-1 hover:bg-red-500/20 rounded">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Input area */}
        <div className="border-t border-[#2a2a3a] bg-[#0a0a0f] p-4">
          <div className="max-w-3xl mx-auto">
            <div className="relative flex items-end gap-2 bg-[#12121a] border border-[#2a2a3a] rounded-2xl focus-within:border-indigo-500/60 transition-colors">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                placeholder="Message Lightning…"
                rows={1}
                disabled={isStreaming}
                className="flex-1 bg-transparent resize-none px-4 py-3.5 text-[0.95rem] placeholder:text-gray-500 focus:outline-none max-h-40 disabled:opacity-50"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isStreaming}
                className="m-2 p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 transition-colors shrink-0"
              >
                <Send size={18} />
              </button>
            </div>
            <p className="text-center text-[11px] text-gray-600 mt-2">
              Enter to send · Shift+Enter for new line · Responses may be inaccurate
            </p>
          </div>
        </div>
      </main>

      {/* Settings modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#12121a] border border-[#2a2a3a] rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a3a]">
              <h2 className="font-semibold text-lg">Settings</h2>
              <button
                onClick={() => setSettingsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-[#1a1a25]"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  System Prompt
                </label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={6}
                  className="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500/60 resize-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setSystemPrompt(DEFAULT_SYSTEM)}
                  className="px-4 py-2 rounded-xl text-sm text-gray-400 hover:bg-[#1a1a25]"
                >
                  Reset
                </button>
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-medium"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
