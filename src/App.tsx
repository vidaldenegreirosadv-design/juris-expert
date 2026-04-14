import React, { useState, useRef, useEffect } from "react";
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from "react-markdown";
import { 
  Scale, Search, Copy, Check, Loader2, AlertCircle, 
  Gavel, Send, Paperclip, X, FileText, Image as ImageIcon, 
  Plus, MessageSquare, Trash2, Menu, ExternalLink 
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import { motion, AnimatePresence } from "motion/react";

// =========================================================================================
// COLOQUE SUA CHAVE ABAIXO (MANTENHA AS ASPAS)
const MINHA_CHAVE_SECRET = "AIzaSyAzIHw88B8y2pfmStTdiv7gq8B3SJgWl5s"; 
// =========================================================================================

const SYSTEM_INSTRUCTION = `Você é um assistente jurídico brasileiro especializado em pesquisa de jurisprudência atualizada e análise de documentos.

Sua função é ajudar advogados a encontrar decisões relevantes e já entregar o material pronto para uso em peças processuais, além de analisar documentos enviados (PDFs e imagens) para extrair teses e fatos relevantes.

Siga rigorosamente estas instruções:

1. Sempre que eu enviar um tema, problema jurídico, caso concreto ou documento:
   - Identifique a área do direito (ex: consumidor, trabalhista, civil, etc.)
   - Identifique as teses jurídicas envolvidas
   - Se houver um documento, resuma os pontos cruciais para a pesquisa.

2. Busque jurisprudências relevantes e ATUAIS (priorize decisões dos últimos 5 anos). 
   - **IMPORTANTE:** Você DEVE utilizar a ferramenta de busca do Google para encontrar dados reais, números de processos e ementas verdadeiras.
   - **ABRANGÊNCIA:** Busque tanto em tribunais superiores (STF, STJ, TST) quanto em tribunais estaduais, com especial atenção ao **TJRJ**, TJSP, TJMG e outros, conforme a relevância do caso.
   - **CONFIABILIDADE TOTAL:** Você só deve apresentar jurisprudências que você encontrou através da ferramenta de busca e cujos links apareçam na seção de "Fontes Verificadas" do sistema ao final da resposta. Nunca cite decisões de sua memória interna que não possam ser verificadas externamente.

3. Para cada jurisprudência encontrada, forneça:
   a) Tribunal (ex: STJ, STF, TJSP, TJRJ, etc.)
   b) Tipo de recurso (Apelação, REsp, etc.)
   c) Data do julgamento
   d) Número do processo (se possível)
   e) **FONTE (URL):** Forneça o endereço (URL) direto e funcional de onde a informação foi extraída. **NUNCA invente ou alucine URLs.**

4. **CONFIABILIDADE E VERIFICAÇÃO:** Para garantir que o usuário possa verificar a veracidade:
   - Seja extremamente preciso com os números de processos (formato CNJ: NNNNNNN-NN.YYYY.J.TR.OOOO).
   - Se encontrar o link direto para o PDF do tribunal, forneça-lo.
   - O sistema exibirá automaticamente os links que você utilizou na seção "Fontes Verificadas pelo Google" ao final da mensagem. Certifique-se de que as decisões citadas no texto correspondam a esses links.

5. **CITAÇÃO PADRONIZADA:** Logo após a ementa, crie uma linha de citação padronizada seguindo exatamente este modelo:
   *(Tipo de Recurso n. Número/UF, relator Ministro/Desembargador Nome, Órgão Julgador, julgado em Data, DJe de Data.)*
   Exemplo: (RMS n. 35.159/RS, relator Ministro Napoleão Nunes Maia Filho, Primeira Turma, julgado em 5/4/2016, DJe de 20/4/2016.)

6. Após a citação, crie um trecho pronto para peça jurídica, com linguagem formal, incluindo:
   - Introdução contextualizando a jurisprudência
   - Citação integrada ao argumento
   - Conexão com a tese do caso

7. Se possível, apresente mais de uma jurisprudência (mínimo 2).

8. Utilize linguagem jurídica formal e técnica.

9. Evite inventar informações. Caso não tenha certeza de algum dado (como número do processo), sinalize claramente.

10. **VERIFICAÇÃO de DOCUMENTOS (REGRA DE OURO):** Se o usuário enviar um documento (PDF ou imagem), este documento é a sua fonte primária e absoluta de verdade. Analise-o integralmente antes de realizar qualquer busca externa. Se a pesquisa externa retornar dados que conflitem com o documento enviado, prevalece o documento.

11. **TRANSCRIÇÃO INTEGRAL (SEM CORTES):** Você deve transcrever a Ementa de forma LITERAL, COMPLETA e INTEGRAL. 
    - É terminantemente PROIBIDO o uso de reticências "[...]" ou resumos no corpo da ementa.
    - O texto deve ser entregue exatamente como consta na fonte original.
    - O título deve ser exatamente: **Ementa Original**.

12. **PROIBIÇÃO de ALUCINAÇÃO:** É terminantemente proibido inventar ementas, nomes de relatores ou resultados de julgamentos. Se você não conseguir acessar o conteúdo integral e exato de uma decisão através da busca, você deve informar ao usuário que encontrou a referência mas não pôde verificar o teor completo, em vez de tentar "adivinhar" o conteúdo.

13. Organize a resposta em:

=== JURISPRUDÊNCIA 1 ===
[Dados do Tribunal]
**Fonte:** [URL COMPLETA]

> [Ementa Original - Transcreva integralmente, sem cortes]

> **Citação Padronizada:** [Modelo solicitado]

[Trecho pronto para peça]

=== JURISPRUDÊNCIA 2 ===
[Dados do Tribunal]
**Fonte:** [URL COMPLETA]

> [Ementa Original - Transcreva integralmente, sem cortes]

> **Citação Padronizada:** [Modelo solicitado]

[Trecho pronto para peça]

14. Ao final, inclua uma seção:
"Como utilizar na peça"
com orientação breve de onde encaixar o conteúdo (fundamentação, pedidos, etc.)

Se necessário, peça mais detalhes do caso antes de responder.`;

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
        if (parsed.length > 0 && !currentSessionId) {
          setCurrentSessionId(parsed[0].id);
        }
      } catch (e) {
        console.error("Failed to parse sessions", e);
      }
    }
  }, []);

  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem("jurisexpert_sessions", JSON.stringify(sessions));
    }
  }, [sessions]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: "Nova Pesquisa",
      messages: [],
      createdAt: Date.now()
    };
    setSessions([newSession, ...sessions]);
    setCurrentSessionId(newSession.id);
    setInput("");
    setAttachedFiles([]);
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSessions = sessions.filter(s => s.id !== id);
    setSessions(newSessions);
    if (currentSessionId === id) {
      setCurrentSessionId(newSessions.length > 0 ? newSessions[0].id : null);
    }
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
      if (file.size > 10 * 1024 * 1024) {
        setError("O arquivo deve ter no máximo 10MB.");
        continue;
      }

      const reader = new FileReader();
      const promise = new Promise<AttachedFile>((resolve) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(",")[1];
          resolve({
            name: file.name,
            type: file.type,
            data: base64,
          });
        };
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
      const newSession: ChatSession = {
        id: Date.now().toString(),
        title: input.trim().substring(0, 30) || "Nova Pesquisa",
        messages: [],
        createdAt: Date.now()
      };
      setSessions([newSession, ...sessions]);
      setCurrentSessionId(newSession.id);
      sessionId = newSession.id;
    }

    const userMessage = input.trim();
    const currentFiles = [...attachedFiles];
    
    setInput("");
    setAttachedFiles([]);

    const updatedMessages: Message[] = [...messages, { role: "user", content: userMessage, files: currentFiles }];
    
    setSessions(prev => prev.map(s => 
      s.id === sessionId 
        ? { ...s, messages: updatedMessages, title: s.messages.length === 0 ? (userMessage.substring(0, 30) || "Pesquisa") : s.title } 
        : s
    ));

    setIsLoading(true);
    setError(null);

    try {
      // INSTANCIAÇÃO DIRETA DENTRO DO HANDLER PARA EVITAR UNDEFINED
      const genAI = new GoogleGenAI(MINHA_CHAVE_SECRET);
      
      const safetySettings = [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
      ];

      const generationConfig = {
        temperature: 0.7,
        topP: 0.95,
        topK: 64,
        maxOutputTokens: 8192, 
      };

      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-pro", 
        systemInstruction: SYSTEM_INSTRUCTION,
      });

      const contents = updatedMessages.map(m => {
        const parts: any[] = [];
        if (m.content) parts.push({ text: m.content });
        if (m.files) {
          m.files.forEach(f => {
            parts.push({
              inlineData: {
                data: f.data,
                mimeType: f.type
              }
            });
          });
        }
        return {
          role: m.role === "user" ? "user" : "model",
          parts
        };
      });

      const result = await model.generateContent({
        contents: contents,
        tools: [{ googleSearch: {} }],
        safetySettings,
        generationConfig,
      });

      const response = await result.response;
      let text = response.text();
      
      if (!text) {
        const candidate = response.candidates?.[0];
        if (candidate?.finishReason === "SAFETY") {
          throw new Error("A resposta foi bloqueada pelos filtros de segurança.");
        } else if (candidate?.finishReason === "RECITATION") {
          throw new Error("A resposta foi bloqueada por conter material protegido por direitos autorais.");
        }
        throw new Error("O modelo não retornou conteúdo textual.");
      }
      
      const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.map(chunk => chunk.web)
        .filter(web => web && web.uri && web.title)
        .map(web => ({ title: web!.title!, uri: web!.uri! })) || [];

      setSessions(prev => prev.map(s => 
        s.id === sessionId 
          ? { ...s, messages: [...updatedMessages, { role: "assistant", content: text, sources }] } 
          : s
      ));
    } catch (err: any) {
      console.error("Gemini API Error:", err);
      let errorMessage = err.message || "Ocorreu um erro ao processar sua solicitação.";
      
      if (err.message?.includes("API key")) {
        errorMessage = "Erro de autenticação: Verifique a chave de API.";
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#f8fafc] text-slate-900 font-sans overflow-hidden">
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            className="w-72 bg-slate-900 text-white flex flex-col shrink-0 z-20"
          >
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-slate-400" />
                <span className="font-bold text-sm tracking-tight">Histórico</span>
              </div>
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="lg:hidden p-1 hover:bg-slate-800 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-4">
              <button 
                onClick={createNewSession}
                className="w-full flex items-center gap-2 bg-slate-800 hover:bg-slate-700 transition-colors px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-700"
              >
                <Plus className="w-4 h-4" />
                Nova Pesquisa
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 space-y-1">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => setCurrentSessionId(s.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setCurrentSessionId(s.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className={cn(
                    "w-full flex items-center justify-between group px-3 py-2.5 rounded-xl text-sm transition-all text-left cursor-pointer outline-none focus:ring-1 focus:ring-slate-700",
                    currentSessionId === s.id 
                      ? "bg-slate-800 text-white" 
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                  )}
                >
                  <div className="flex items-center gap-3 truncate">
                    <MessageSquare className="w-4 h-4 shrink-0" />
                    <span className="truncate">{s.title}</span>
                  </div>
                  <button 
                    onClick={(e) => deleteSession(s.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-800 text-[10px] text-slate-500 font-medium uppercase tracking-widest text-center">
              JurisExpert v2.0
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col relative overflow-hidden">
        <header className="bg-white border-b border-slate-200 h-16 shrink-0 flex items-center px-4 justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            {!isSidebarOpen && (
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Menu className="w-5 h-5 text-slate-600" />
              </button>
            )}
            <div className="flex items-center gap-3">
              <div className="bg-slate-900 p-1.5 rounded-lg">
                <Scale className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight text-slate-900">
                  JURIS-TESTE
                </h1>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  Assistente Jurídico
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-full">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Sistema Online</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-[#f8fafc] relative">
          <div className="max-w-4xl mx-auto px-4 py-8 pb-48">
            {messages.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
                <div className="bg-white shadow-sm border border-slate-200 p-6 rounded-full">
                  <Gavel className="w-12 h-12 text-slate-400" />
                </div>
                <div className="max-w-md space-y-2">
                  <h2 className="text-2xl font-bold text-slate-800">
                    Inicie sua pesquisa jurídica
                  </h2>
                  <p className="text-slate-500 text-sm">
                    Descreva o caso, anexe documentos ou peça jurisprudências específicas (STF, STJ, TJRJ, etc).
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl mt-8">
                  {[
                    "Jurisprudência TJRJ sobre cobrança indevida",
                    "Dano moral por atraso de voo internacional",
                    "Revisão de contrato bancário com juros abusivos",
                    "Desconsideração da personalidade jurídica no trabalho"
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className="text-left p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-400 hover:shadow-md transition-all text-sm font-medium text-slate-700 flex items-center gap-3"
                    >
                      <Search className="w-4 h-4 text-slate-400" />
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-8">
              <AnimatePresence initial={false}>
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "flex gap-4",
                      msg.role === "user" ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-sm",
                      msg.role === "user" ? "bg-slate-200" : "bg-slate-900"
                    )}>
                      {msg.role === "user" ? (
                        <span className="text-[10px] font-bold text-slate-600">EU</span>
                      ) : (
                        <Scale className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <div className={cn(
                      "max-w-[85%] rounded-2xl px-6 py-4 shadow-sm",
                      msg.role === "user" 
                        ? "bg-slate-900 text-white rounded-tr-none" 
                        : "bg-white border border-slate-200 rounded-tl-none"
                    )}>
                      {msg.files && msg.files.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {msg.files.map((f, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 border border-slate-700">
                              {f.type.includes("image") ? <ImageIcon className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                              <span className="truncate max-w-[120px]">{f.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className={cn(
                        "prose prose-slate max-w-none prose-headings:text-slate-900 prose-strong:text-slate-900",
                        msg.role === "user" && "prose-invert"
                      )}>
                        <ReactMarkdown
                          components={{
                            blockquote: ({ node, ...props }) => (
                              <blockquote className="ementa-original" {...props} />
                            ),
                            a: ({ node, ...props }) => (
                              <a 
                                className="text-blue-600 hover:text-blue-800 underline font-bold" 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                {...props} 
                              />
                            ),
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                      {msg.role === "assistant" && (
                        <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
                          {msg.sources && msg.sources.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                <Check className="w-3 h-3 text-green-500" />
                                Fontes Verificadas pelo Google
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {msg.sources.map((source, idx) => (
                                  <a
                                    key={idx}
                                    href={source.uri}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-[11px] font-medium border border-blue-100 hover:bg-blue-100 transition-all max-w-full hover:shadow-sm"
                                  >
                                    <span className="truncate">{source.title}</span>
                                    <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="flex justify-end">
                            <button
                              onClick={() => handleCopy(msg.content, i)}
                              className="flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
                            >
                              {copiedIndex === i ? (
                                <>
                                  <Check className="w-3 h-3" />
                                  Copiado!
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  Copiar Resposta
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isLoading && (
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center shrink-0 animate-pulse shadow-sm">
                    <Scale className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none px-6 py-4 shadow-sm flex items-center gap-3">
                    <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                    <span className="text-sm text-slate-500 font-medium">
                      Analisando dados e pesquisando jurisprudências (STF, STJ, TJRJ...)...
                    </span>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-red-700">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </main>

        <div className="absolute bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 p-4 z-10">
          <div className="max-w-4xl mx-auto">
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3 px-2">
                {attachedFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 border border-slate-200 group">
                    {f.type.includes("image") ? <ImageIcon className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                    <span className="truncate max-w-[150px]">{f.name}</span>
                    <button onClick={() => removeFile(i)} className="text-slate-400 hover:text-red-500 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="relative flex items-end gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                multiple
                accept="application/pdf,image/*"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-3 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-all shrink-0 mb-1"
                title="Anexar arquivo (PDF ou Imagem)"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <form onSubmit={handleSubmit} className="relative flex-1">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                  placeholder="Descreva o caso ou anexe documentos..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 pr-16 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all resize-none min-h-[60px] max-h-[200px]"
                  rows={1}
                />
                <button
                  type="submit"
                  disabled={(!input.trim() && attachedFiles.length === 0) || isLoading}
                  className={cn(
                    "absolute right-3 bottom-3 p-2 rounded-xl transition-all",
                    (input.trim() || attachedFiles.length > 0) && !isLoading
                      ? "bg-slate-900 text-white hover:bg-slate-800"
                      : "bg-slate-100 text-slate-400 cursor-not-allowed"
                  )}
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
            <p className="text-[10px] text-center text-slate-400 mt-2 font-medium uppercase tracking-widest">
              Uso exclusivo para profissionais do direito • Verifique sempre as fontes oficiais
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
