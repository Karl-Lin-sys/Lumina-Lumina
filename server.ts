import { localApiOnly } from './local-api-guard.mjs';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
app.use('/api', localApiOnly(() => PORT));
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Global generate (prompt + files)
  app.post('/api/generate', async (req, res) => {
    try {
      const { prompt, files, content } = req.body;
      
      const parts: any[] = [{ text: prompt }];
      
      if (files && files.length > 0) {
        files.forEach((f: any) => {
          parts.push({
            inlineData: {
              data: f.base64,
              mimeType: f.type,
            }
          });
        });
      }

      if (content) {
        parts.push({ text: `Current Document Context:\n${content}` });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: { parts },
        config: {
            systemInstruction: "You are an expert AI writing assistant. Generate text based on the user's prompt. Do NOT wrap your response in markdown blocks like ```markdown unless asked. Provide clean, well-formatted plain text or paragraphs."
        }
      });

      res.json({ text: response.text });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  // Iterate on a specific block
  app.post('/api/iterate', async (req, res) => {
    try {
      const { prompt, blockText, contextBefore, contextAfter } = req.body;
      
      const instruction = `You are a writing assistant.
The user wants to rewrite or edit a specific paragraph/block.
Here is what came before it:
---
${contextBefore}
---
Here is what came after it:
---
${contextAfter}
---
Here is the block to edit:
---
${blockText}
---
User's instruction for this block: ${prompt}

Output ONLY the new rewritten block text. No extra conversation, no markdown wrappers, just the text.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: instruction
      });

      res.json({ text: response.text?.trim() });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  // Proactive suggestions
  app.post('/api/suggest', async (req, res) => {
    try {
      const { blocks } = req.body; // array of { id, text }
      
      const docText = blocks.map((b: any) => `<block id="${b.id}">${b.text}</block>`).join('\n\n');

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: `Review the following document composed of text blocks.
Identify blocks that could be significantly improved (e.g., better flow, grammar, word choice, impact).
Provide suggestions for up to 3 blocks.

Document:
${docText}`,
        config: {
          systemInstruction: "You are a proactive editor. Return your feedback strictly as a JSON array of objects. Each object should have 'blockId', 'originalSnippet' (a short quote of what you are changing), 'suggestion' (the new rewritten text for that whole block), and 'reason'.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                blockId: { type: Type.STRING },
                originalSnippet: { type: Type.STRING },
                suggestion: { type: Type.STRING },
                reason: { type: Type.STRING },
              },
              required: ["blockId", "originalSnippet", "suggestion", "reason"]
            }
          }
        }
      });

      let jsonResponse = [];
      try {
          if (response.text) {
             jsonResponse = JSON.parse(response.text);
          }
      } catch (err) {
          console.error("Failed to parse JSON", err);
      }
      res.json({ suggestions: jsonResponse });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '127.0.0.1', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
