import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  try {
    const { messages } = req.body;
    const API_KEY = process.env.GEMINI_API_KEY;

    if (!API_KEY) return res.status(500).json({ error: 'Chave de API não configurada no servidor.' });

    // Usando v1beta para garantir suporte ao Google Search Grounding
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

    // CORREÇÃO CRUCIAL: Transformando o formato do App.tsx para o formato que o Google EXIGE (parts)
    const formattedContents = messages.map((m: any) => {
      const parts: any[] = [];
      
      // O Google não aceita "content", ele quer "parts" com "text"
      if (m.content) {
        parts.push({ text: m.content });
      }
      
      // O Google não aceita "files", ele quer "inlineData" dentro de "parts"
      if (m.files && Array.isArray(m.files)) {
        m.files.forEach((f: any) => {
          parts.push({
            inlineData: {
              data: f.data,
              mimeType: f.type
            }
          });
        });
      }

      return {
        role: m.role === "assistant" ? "model" : "user",
        parts: parts
      };
    });

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: formattedContents,
        system_instruction: { 
          parts: [{ text: "Você é um assistente jurídico brasileiro especializado em pesquisa de jurisprudência atualizada. Use busca do Google para encontrar dados reais. Transcreva ementas INTEGRALMENTE, sem cortes. Use linguagem jurídica formal." }] 
        },
        tools: [{ google_search_retrieval: {} }],
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        ],
        generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(data.error.code || 500).json({ error: data.error.message });
    }

    return res.status(200).json(data);

  } catch (error: any) {
    console.error('Erro no Servidor:', error);
    return res.status(500).json({ error: 'Erro interno ao processar a requisição.' });
  }
}
