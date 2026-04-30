'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, Bot, User, Loader2, Wifi, WifiOff } from 'lucide-react'

interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
}

const SUGGESTED_QUESTIONS = [
  '¿Cómo voy contra el PPTO este mes?',
  '¿Cuál es mi paquete más rentable?',
  '¿Qué días de la semana generan más ingresos?',
  '¿Cuánto tengo pendiente por cobrar?',
]

interface AnalisisChatProps {
  sucursal: string;
  period: string;
}

export default function AnalisisChat({ sucursal, period }: AnalisisChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      if (!webhookUrl) {
        // Simular respuesta cuando no hay webhook configurado
        await new Promise(resolve => setTimeout(resolve, 1500))
        const agentMessage: Message = {
          id: `agent-${Date.now()}`,
          role: 'agent',
          content: `🔧 **Conexión pendiente**\n\nEl webhook de n8n aún no está configurado. Una vez que agregues \`NEXT_PUBLIC_N8N_WEBHOOK_URL\` al archivo \`.env.local\`, podré responder consultas en tiempo real sobre:\n\n• Presupuesto vs Actual\n• Rentabilidad por paquete\n• Tendencias de ingresos\n• Análisis de sesiones\n\nTu pregunta fue: *"${text.trim()}"*`,
          timestamp: new Date(),
        }
        setMessages(prev => [...prev, agentMessage])
      } else {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pregunta: text.trim(),
            sucursal,
            periodo: period,
          }),
        })

        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const data = await response.json()
        const agentMessage: Message = {
          id: `agent-${Date.now()}`,
          role: 'agent',
          content: data.respuesta || 'Sin respuesta del agente.',
          timestamp: new Date(),
        }
        setMessages(prev => [...prev, agentMessage])
      }
    } catch (error: any) {
      const errorMessage: Message = {
        id: `agent-${Date.now()}`,
        role: 'agent',
        content: `❌ **Error de conexión**\n\nNo se pudo contactar al agente de IA. Verifica que el webhook esté activo.\n\nError: ${error.message}`,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleSuggestion = (q: string) => {
    setInput(q)
    inputRef.current?.focus()
  }

  const connectionStatus = !webhookUrl ? 'configuring' : 'connected'

  return (
    <div className="flex flex-col h-full">
      {/* Suggested Questions */}
      {messages.length === 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={18} className="text-primary" />
            <h4 className="text-sm font-medium text-muted-foreground">Preguntas sugeridas</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {SUGGESTED_QUESTIONS.map((q, i) => (
              <button
                key={i}
                onClick={() => handleSuggestion(q)}
                className="text-left p-4 rounded-xl border border-border/50 bg-secondary/20 hover:bg-secondary/40 hover:border-primary/30 transition-all text-sm text-foreground/80 hover:text-foreground group"
              >
                <span className="text-primary/60 group-hover:text-primary transition-colors mr-2">→</span>
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Welcome message when empty */}
      {messages.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Bot size={32} className="text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Asistente de Análisis</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Pregúntame sobre tus métricas, presupuesto, rentabilidad, sesiones o cualquier 
              dato de tu negocio. Te responderé con datos en tiempo real.
            </p>
          </div>
        </div>
      )}

      {/* Messages Area */}
      {messages.length > 0 && (
        <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2" style={{ maxHeight: 'calc(100vh - 420px)' }}>
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex items-start gap-3 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.role === 'user' ? 'bg-primary/20' : 'bg-secondary'
                }`}>
                  {msg.role === 'user' ? <User size={16} className="text-primary" /> : <Bot size={16} className="text-muted-foreground" />}
                </div>
                {/* Bubble */}
                <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-emerald-900/50 border border-emerald-700/30 text-emerald-50'
                    : 'bg-secondary/60 border border-border/50 text-foreground'
                }`}>
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                  <p className={`text-xs mt-2 ${msg.role === 'user' ? 'text-emerald-400/50' : 'text-muted-foreground/50'}`}>
                    {msg.timestamp.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                  <Bot size={16} className="text-muted-foreground" />
                </div>
                <div className="rounded-2xl px-4 py-3 bg-secondary/60 border border-border/50">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 size={14} className="animate-spin" />
                    <span>Analizando datos...</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-border/50 pt-4">
        <form onSubmit={handleSubmit} className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu pregunta..."
            disabled={isLoading}
            className="flex-1 bg-secondary/30 border border-border/50 rounded-xl px-4 py-3 text-sm outline-none text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="h-[46px] px-5 rounded-xl bg-primary text-primary-foreground font-medium text-sm flex items-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Send size={16} />
            Enviar
          </button>
        </form>

        {/* Connection status */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            {connectionStatus === 'connected' ? (
              <>
                <Wifi size={14} className="text-primary" />
                <span className="text-xs text-primary font-medium">Agente conectado</span>
              </>
            ) : connectionStatus === 'configuring' ? (
              <>
                <Loader2 size={14} className="text-yellow-400 animate-spin" />
                <span className="text-xs text-yellow-400 font-medium">Configurando conexión...</span>
              </>
            ) : (
              <>
                <WifiOff size={14} className="text-destructive" />
                <span className="text-xs text-destructive font-medium">Agente desconectado</span>
              </>
            )}
          </div>
          <span className="text-xs text-muted-foreground/50">
            Sucursal: {sucursal} · Período: {period}
          </span>
        </div>
      </div>
    </div>
  )
}
