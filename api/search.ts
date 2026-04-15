import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Configurações de CORS para permitir que seu frontend acesse a API
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  try {
    const { messages } = req.body;
    const API_KEY = process.env.GEMINI_API_KEY;

    if (!API_KEY) {
      return res.status(500).json({ error: 'Erro interno: Chave de API não configurada no servidor Vercel.' });
    }

    // Utilizamos a v1beta para garantir suporte ao Google Search Grounding (Busca do Google)
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: messages,
        system_instruction: { 
          parts: [{ text: "Você é um assistente jurídico brasileiro especializado em pesquisa de jurisprudência atualizada. Use busca do Google para encontrar dados reais, números de processos e ementas verdadeiras. Transcreva as ementas INTEGRALMENTE, sem cortes ou resumos. Use linguagem jurídica formal." }] 
        },
        tools: [{ google_search_retrieval: {} }],
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        ],
        generationConfig: { 
          temperature: 0.7, 
          maxOutputTokens: 8192 
        },
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(data.error.code || 500).json({ error: data.error.message });
    }

    return res.status(200).json(data);

  } catch (error: any) {
    console.error('Erro no Servidor API:', error);
    return res.status(500).json({ error: 'Erro interno ao processar a requisição jurídica.' });
  }
}
