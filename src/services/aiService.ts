// Service pour gérer les appels à l'API d'IA
import logger from './logService';
import OpenAI from 'openai';

// Initialisation du client OpenAI
let openaiClient: OpenAI | null = null;

// Fonction pour initialiser le client OpenAI
const getOpenAIClient = (): OpenAI => {
  if (!openaiClient) {
    logger.debug('Initialisation du client OpenAI');
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    
    if (!apiKey) {
      logger.error('Clé API OpenAI non définie');
      throw new Error('Clé API OpenAI non définie');
    }
    
    openaiClient = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true // Nécessaire pour l'utilisation côté client
    });
    logger.info('Client OpenAI initialisé avec succès');
  }
  return openaiClient;
};

interface AIResponse {
  content: string;
  script?: string;
}

// Configuration pour les tentatives de requêtes
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 seconde
const MAX_RETRY_DELAY = 15000; // 15 secondes

// Réponses locales de secours pour le mode hors ligne
const FALLBACK_RESPONSES: Record<string, AIResponse> = {
  default: {
    content: "Je suis désolé, je ne peux pas accéder au service en ligne actuellement. Je fonctionne en mode limité."
  },
  aide: {
    content: "Je peux vous aider à naviguer sur le site, consulter les produits disponibles, et répondre à des questions simples même en mode hors ligne."
  },
  produits: {
    content: "Nous avons 6 produits disponibles, avec des prix allant de 79,99€ à 199,99€. Voulez-vous des informations sur un produit spécifique?"
  }
};

// Fonction utilitaire pour attendre un délai spécifié
const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

// Fonction pour obtenir une réponse de secours basée sur le texte de l'utilisateur
function getFallbackResponse(text: string): AIResponse {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('aide') || lowerText.includes('help')) {
    return FALLBACK_RESPONSES.aide;
  } else if (lowerText.includes('produit') || lowerText.includes('article') || lowerText.includes('prix')) {
    return FALLBACK_RESPONSES.produits;
  }
  
  return FALLBACK_RESPONSES.default;
}

export async function generateAIResponse(transcript: string, siteContext: string): Promise<AIResponse> {
  logger.operation('Génération de réponse IA');
  logger.debug(`Transcription: "${transcript}"`);
  logger.debug(`Contexte du site: ${siteContext.substring(0, 100)}...`);
  
  let retryCount = 0;
  let retryDelay = INITIAL_RETRY_DELAY;
  
  // Construire le prompt avec le contexte du site et la transcription de l'utilisateur
  const systemPrompt = 'Tu es un assistant vocal pour un site web. Tu dois générer des réponses et des scripts d\'affichage basés sur les demandes vocales des utilisateurs.';
  
  const userPrompt = `
    Contexte du site: ${siteContext}
    
    L'utilisateur a dit: "${transcript}"
    
    En tant qu'assistant vocal pour ce site web, génère une réponse appropriée et un script d'affichage si nécessaire.
    Format de réponse attendu:
    {
      "content": "Le texte à dire à l'utilisateur",
      "script": "Le code ou les instructions pour modifier l'affichage (optionnel)"
    }
  `;

  // Boucle de tentatives avec backoff exponentiel
  while (retryCount <= MAX_RETRIES) {
    try {
      logger.debug(`Tentative d'appel API OpenAI: ${retryCount + 1}/${MAX_RETRIES + 1}`);
      
      // Obtenir le client OpenAI
      const openai = getOpenAIClient();
      
      // Mesurer le temps de réponse
      const startTime = Date.now();
      logger.debug('Envoi de la requête à l\'API OpenAI');
      
      // Appel à l'API OpenAI avec la nouvelle syntaxe
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 500
      });
      
      // Calculer le temps de réponse
      const responseTime = Date.now() - startTime;
      logger.info(`Réponse OpenAI reçue en ${responseTime}ms`);
      logger.debug(`Tokens utilisés: ${completion.usage?.total_tokens || 'inconnu'}`);
      
      // Extraire la réponse générée par l'IA
      const aiMessage = completion.choices[0].message.content;
      
      if (!aiMessage) {
        logger.warn('Réponse OpenAI vide');
        throw new Error('Réponse OpenAI vide');
      }
      
      logger.debug('Réponse IA reçue avec succès');
      
      // Tenter de parser la réponse JSON
      try {
        // Si la réponse est déjà au format JSON
        const parsedResponse = JSON.parse(aiMessage);
        logger.debug('Réponse IA parsée avec succès au format JSON');
        return parsedResponse;
      } catch (e) {
        // Si la réponse n'est pas au format JSON, retourner juste le contenu
        logger.warn('Réponse IA non au format JSON attendu', e);
        return {
          content: aiMessage
        };
      }
    } catch (error: any) {
      // Journaliser l'erreur avec des détails
      logger.apiError('openai/chat/completions', error);
      
      // Vérifier si c'est une erreur de rate limit (429)
      const isRateLimitError = error.status === 429 || 
                              (error.message && error.message.includes('429')) ||
                              (error.error && error.error.type === 'rate_limit_exceeded');
      
      if (isRateLimitError) {
        logger.warn(`Erreur de limite de taux (429) détectée. Tentative ${retryCount + 1}/${MAX_RETRIES}`);
        
        // Si c'est la dernière tentative
        if (retryCount >= MAX_RETRIES) {
          logger.warn(`Limite de tentatives atteinte (${MAX_RETRIES}) pour l'erreur 429. Utilisation de la réponse de secours.`);
          return getFallbackResponse(transcript);
        }
        
        // Sinon, réessayer avec backoff exponentiel
        logger.info(`Attente de ${retryDelay}ms avant la prochaine tentative`);
        await delay(retryDelay);
        retryCount++;
        retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY); // Backoff exponentiel
        continue;
      }
      
      // Pour les autres types d'erreurs
      logger.error(`Erreur non récupérable lors de l'appel à OpenAI: ${error.message || 'Erreur inconnue'}`);
      
      // Si c'est la dernière tentative ou une erreur non liée au taux de requêtes
      if (retryCount >= MAX_RETRIES) {
        // Utiliser une réponse de secours basée sur le contenu de la demande
        logger.info('Utilisation de la réponse de secours après échec des tentatives');
        return getFallbackResponse(transcript);
      }
      
      // Sinon, réessayer avec backoff exponentiel pour les autres erreurs aussi
      logger.warn(`Tentative ${retryCount + 1}/${MAX_RETRIES} dans ${retryDelay}ms`);
      await delay(retryDelay);
      retryCount++;
      retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY);
    }
  }
  
  // Si toutes les tentatives échouent, utiliser une réponse de secours
  logger.warn('Toutes les tentatives ont échoué, utilisation de la réponse de secours');
  return getFallbackResponse(transcript);
}

// Fonction pour extraire le contexte du site
export function getSiteContext(): string {
  // Cette fonction pourrait être améliorée pour extraire dynamiquement le contenu du site
  return `
    Ce site web contient les pages suivantes:
    - Page d'accueil: Présentation de Next.js avec des liens vers la documentation et le déploiement
    - Page Produits: Liste de produits avec leurs descriptions et prix
      * Produit 1: 99,99 €
      * Produit 2: 149,99 €
      * Produit 3: 79,99 €
      * Produit 4: 129,99 €
      * Produit 5: 199,99 €
      * Produit 6: Prix non spécifié
  `;
}