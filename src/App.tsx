import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";

export default function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Você é um assistente jurídico brasileiro especializado em jurisprudência.\n\nPergunta: ${input}`,
                },
              ],
            },
          ],
        }),
      });

      const data = await res.json();

      const text =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "Sem resposta.";

      const botMessage = { role: "assistant", content: text };

      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Erro ao buscar resposta." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow p-4">
        <h1 className="text-xl font-bold mb-4">Buscador de Jurisprudência</h1>

        <div className="h-[400px] overflow-y-auto mb-4 border p-2 rounded">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`mb-2 ${
                msg.role === "user" ? "text-right" : "text-left"
              }`}
            >
              <div
                className={`inline-block px-3 py-2 rounded-lg ${
                  msg.role === "user"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200"
                }`}
              >
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          ))}

          {loading && <p>Carregando...</p>}

          <div ref={messagesEndRef} />
        </div>

        <div className="flex gap-2">
          <input
            className="flex-1 border rounded px-3 py-2"
            placeholder="Digite sua busca jurídica..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />

          <button
            className="bg-blue-600 text-white px-4 py-2 rounded"
            onClick={handleSend}
            disabled={loading}
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
