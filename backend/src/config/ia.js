// Client IA — fournisseur gratuit (Groq), compatible avec l'API OpenAI.
// La clé API reste STRICTEMENT côté serveur : elle n'est jamais renvoyée au
// navigateur ni exposée au client. On réutilise le SDK OpenAI en le pointant
// vers l'endpoint Groq (compatible OpenAI).
import OpenAI from 'openai';

// L'assistant est actif uniquement si une clé Groq est configurée.
export const iaConfiguree = () => !!process.env.GROQ_API_KEY;

// Modèle gratuit chez Groq (surchargable via GROQ_MODEL). Groq retire
// régulièrement d'anciens modèles (ex. llama-3.3-70b-versatile, décommissionné) :
// si l'IA se met à échouer en production, vérifier la liste actuelle sur
// https://console.groq.com/docs/models et ajuster GROQ_MODEL au besoin.
export const MODELE_IA = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

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
