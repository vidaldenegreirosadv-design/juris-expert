import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { 
  Scale, Search, Copy, Check, Loader2, AlertCircle, 
  Gavel, Send, Paperclip, X, FileText, Image as ImageIcon, 
  Plus, MessageSquare, Trash2, Menu, ExternalLink 
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import { motion, AnimatePresence } from "motion/react";

interface Message {
  role: "user" | "assistant";
  content: string;
  files?: AttachedFile[];
  sources?: { title: string; uri: string }[];
}

interface AttachedFile {
  name: string;
  type: string;
  data: string; 
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentSession = sessions.find(s => s.id === currentSessionId);
  const messages = currentSession?.messages || [];

  useEffect(() => {
    const saved = localStorage.getItem("jurisexpert_sessions");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSessions(parsed);
        if (parsed.length > 0 && !currentSessionId) setCurrentSessionId(parsed[0].id);
      } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    if (sessions.length > 0) localStorage.setItem("jurisexpert_sessions", JSON.stringify(sessions));
  }, [sessions]);

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); };
  useEffect(() => { scrollToBottom(); }, [messages, isLoading]);

  const createNewSession = () => {
    const newS: ChatSession = { id: Date.now().toString(), title: "Nova Pesquisa", messages: [], createdAt: Date.now() };
    setSessions([newS, ...sessions]);
    setCurrentSessionId(newS.id);
    setInput("");
    setAttachedFiles([]);
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newS = sessions.filter(s => s.id !== id);
    setSessions(newS);
    if (currentSessionId === id) setCurrentSessionId(newS.length > 0 ? newS[0].id : null);
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newFiles: AttachedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 10 * 1024 * 1024) continue;
      const reader = new FileReader();
      const promise = new Promise<AttachedFile>((resolve) => {
        reader.onload = () => resolve({ name: file.name, type: file.type, data: (reader.result as string).split(",")[1] });
      });
      reader.readAsDataURL(file);
      newFiles.push(await promise);
    }
    setAttachedFiles((prev) => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && attachedFiles.length === 0) || isLoading) return;

    let sessionId = currentSessionId;
    if (!sessionId) {
      const newS: ChatSession = { id: Date.now().toString(), title: "Nova Pesquisa", messages: [], createdAt: Date.now() };
      setSessions([newS, ...sessions]);
      setCurrentSessionId(newS.id);
      sessionId = newS.id;
    }

    const userMessage = input.trim();
    const currentFiles = [...attachedFiles];
    setInput(""); setAttachedFiles([]);

    const updatedMessages: Message[] = [...messages, { role: "user", content: userMessage, files: currentFiles }];
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: updatedMessages, title: s.messages.length === 0 ? (userMessage.substring(0, 30) || "Pesquisa") : s.title } : s));

    setIsLoading(true);
    setError(null);

    try {
      // CHAMADA PARA O BACKEND DA VERCEL
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("O modelo não retornou conteúdo textual.");

      const sources = data.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.map((chunk: any) => chunk.web)
        .filter((web: any) => web && web.uri)
        .map((web: any) => ({ title: web.title, uri: web.uri })) || [];

      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: [...updatedMessages, { role: "assistant", content: text, sources }] } : s));
    } catch (err: any) {
      setError(err.message || "Erro ao conectar com o servidor de pesquisa.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#f8fafc] text-slate-900 font-sans overflow-hidden">
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} className="w-72 bg-slate-900 text-white flex flex-col shrink-0 z-20">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2"><Scale className="w-5 h-5 text-slate-400" /><span className="font-bold text-sm">Histórico</span></div>
              <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1 hover:bg-slate-800 rounded"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4">
              <button onClick={createNewSession} className="w-full flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-700"><Plus className="w-4 h-4" />Nova Pesquisa</button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 space-y-1">
              {sessions.map((s) => (
                <div key={s.id} onClick={() => setCurrentSessionId(s.id)} className={cn("w-full flex items-center justify-between group px-3 py-2.5 rounded-xl text-sm cursor-pointer transition-all", currentSessionId === s.id ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800/50")}>
                  <div className="flex items-center gap-3 truncate"><MessageSquare className="w-4 h-4 shrink-0" /><span className="truncate">{s.title}</span></div>
                  <button onClick={(e) => deleteSession(s.id, e)} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-slate-800 text-[10px] text-slate-500 uppercase text-center">JurisExpert v2.0</div>
          </motion.aside>
        )}
      </AnimatePresence>
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <header className="bg-white border-b border-slate-200 h-16 flex items-center px-4 justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            {!isSidebarOpen && <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-slate-100 rounded-lg"><Menu className="w-5 h-5 text-slate-600" /></button>}
            <div className="flex items-center gap-3">
              <div className="bg-slate-900 p-1.5 rounded-lg"><Scale className="w-5 h-5 text-white" /></div>
              <div><h1 className="text-sm font-bold">JURIS-TESTE</h1><p className="text-[10px] text-slate-500 font-bold uppercase">Assistente Jurídico</p></div>
            </div>
          </div>
          <div className="flex items-center gap-2"><div className="hidden md:flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-full"><div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /><span className="text-[10px] font-bold text-slate-600 uppercase">Sistema Online</span></div></div>
        </header>
        <main className="flex-1 overflow-y-auto bg-[#f8fafc] relative">
          <div className="max-w-4xl mx-auto px-4 py-8 pb-48">
            {messages.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
                <div className="bg-white shadow-sm border border-slate-200 p-6 rounded-full"><Gavel className="w-12 h-12 text-slate-400" /></div>
                <div className="max-w-md space-y-2"><h2 className="text-2xl font-bold text-slate-800">Inicie sua pesquisa jurídica</h2><p className="text-slate-500 text-sm">Descreva o caso ou anexe documentos.</p></div>
              </div>
            )}
            <div className="space-y-8">
              {messages.map((msg, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn("flex gap-4", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1", msg.role === "user" ? "bg-slate-200" : "bg-slate-900")}>
                    {msg.role === "user" ? <span className="text-[10px] font-bold">EU</span> : <Scale className="w-4 h-4 text-white" />}
                  </div>
                  <div className={cn("max-w-[85%] rounded-2xl px-6 py-4 shadow-sm", msg.role === "user" ? "bg-slate-900 text-white rounded-tr-none" : "bg-white border border-slate-200 rounded-tl-none")}>
                    <div className={cn("prose prose-slate max-w-none", msg.role === "user" && "prose-invert")}>
                      <ReactMarkdown components={{ a: ({ node, ...props }) => <a className="text-blue-600 underline font-bold" target="_blank" {...props} /> }}>{msg.content}</ReactMarkdown>
                    </div>
                    {msg.role === "assistant" && msg.sources && (
                      <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase"><Check className="w-3 h-3 text-green-500" /> Fontes Verificadas</div>
                        <div className="flex flex-wrap gap-2">
                          {msg.sources.map((s, idx) => <a key={idx} href={s.uri} target="_blank" className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-[11px] font-medium border border-blue-100">{s.title} <ExternalLink className="w-2.5 h-2.5 inline" /></a>)}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
              {isLoading && <div className="flex gap-4"><div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center animate-pulse"><Scale className="w-4 h-4 text-white" /></div><div className="bg-white border border-slate-200 rounded-2xl px-6 py-4 flex items-center gap-3"><Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm text-slate-500">Pesquisando nos tribunais...</span></div></div>}
              {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-red-700"><AlertCircle className="w-5 h-5" /><p className="text-sm font-medium">{error}</p></div>}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </main>
        <div className="absolute bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 p-4 z-10">
          <div className="max-w-4xl mx-auto">
            <div className="relative flex items-end gap-2">
              <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple accept="application/pdf,image/*" className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="p-3 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 shrink-0 mb-1"><Paperclip className="w-5 h-5" /></button>
              <form onSubmit={handleSubmit} className="relative flex-1">
                <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }} placeholder="Descreva o caso..." className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 pr-16 focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none min-h-[60px]" rows={1} />
                <button type="submit" disabled={(!input.trim() && attachedFiles.length === 0) || isLoading} className={cn("absolute right-3 bottom-3 p-2 rounded-xl transition-all", (input.trim() || attachedFiles.length > 0) && !isLoading ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-400")}><Send className="w-5 h-5" /></button>
              </form>
            </div>
            <p className="text-[10px] text-center text-slate-400 mt-2 uppercase tracking-widest">Uso exclusivo para profissionais do direito</p>
          </div>
        </div>
      </div>
    </div>
  );
}
