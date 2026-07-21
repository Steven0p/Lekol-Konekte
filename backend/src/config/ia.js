// Client IA — fournisseur gratuit (Groq), compatible avec l'API OpenAI.
// La clé API reste STRICTEMENT côté serveur : elle n'est jamais renvoyée au
// navigateur ni exposée au client. On réutilise le SDK OpenAI en le pointant
// vers l'endpoint Groq (compatible OpenAI).
import OpenAI from 'openai';

// L'assistant est actif uniquement si une clé Groq est configurée.
export const iaConfiguree = () => !!process.env.GROQ_API_KEY;

// Modèle gratuit et rapide chez Groq (surchargable via GROQ_MODEL).
export const MODELE_IA = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

let client = null;
export function clientIA() {
  if (!process.env.GROQ_API_KEY) return null;
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }
  return client;
}
