// Service pour gérer les interactions avec l'API Ollama locale
import logger from './logService';

// URL de l'API Ollama locale
const OLLAMA_API_URL = 'http://localhost:11434';

// Type pour la réponse de l'API Ollama
interface OllamaResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  script?: string; // Script JavaScript optionnel extrait de la réponse
}

// Type pour la réponse de l'IA à renvoyer au composant VoiceAssistant
interface AIResponse {
  content: string;  // Le contenu textuel de la réponse
  script?: string;  // Script JavaScript optionnel à exécuter
}

/**
 * Récupère le contexte du site actuel pour fournir des informations pertinentes à l'IA
 * @returns Le contexte du site sous forme de texte
 */
export const getSiteContext = (): string => {
  logger.debug('Récupération du contexte du site');
  
  // Vérifier si nous sommes dans un environnement navigateur
  if (typeof window === 'undefined') {
    logger.warn('getSiteContext appelé en dehors du navigateur');
    return 'Contexte non disponible (environnement serveur)';
  }
  
  try {
    // Récupérer le titre de la page
    const pageTitle = document.title || 'Page sans titre';
    
    // Récupérer l'URL actuelle
    const currentUrl = window.location.href;
    
    // Récupérer le texte visible sur la page (limité pour éviter des contextes trop grands)
    const visibleText = document.body ? 
      Array.from(document.body.querySelectorAll('h1, h2, h3, p, li, a, button'))
        .map(el => el.textContent)
        .filter(Boolean)
        .join(' ')
        .substring(0, 1000) : 
      '';
    
    // Construire le contexte
    const context = "Ce site est neuract."
    
    logger.debug('Contexte du site récupéré avec succès');
    return context;
  } catch (error) {
    logger.error('Erreur lors de la récupération du contexte du site:', error);
    return 'Erreur lors de la récupération du contexte';
  }
};

/**
 * Type pour la fonction de callback qui sera appelée à chaque morceau de réponse reçu
 */
export type StreamCallback = (chunk: string) => void;

/**
 * Génère une réponse IA basée sur la commande vocale et le contexte du site
 * @param command La commande vocale transcrite
 * @param context Le contexte du site
 * @param onStream Callback optionnel appelé à chaque morceau de réponse reçu
 * @returns Une promesse qui résout vers la réponse de l'IA
 */
export const generateAIResponse = async (command: string, context: string): Promise<AIResponse> => {
  logger.operation('Génération de réponse IA');
  logger.info(`Commande: "${command}", Taille du contexte: ${context.length} caractères`);
  
  try {
    // Interroger l'API Ollama locale avec la commande et le contexte
    const response = await queryOllama({
      question: command,
      context: context
    }); // Passer le callback de streaming à queryOllama
    
    logger.operationEnd('Génération de réponse IA', true);

    // Renvoyer la réponse de l'IA avec le contenu textuel et le script JavaScript
    return {
      content: response.message.content,
      script: response.script
    };
  } catch (error) {
    logger.error('Erreur lors de la génération de la réponse IA:', error);
    logger.operationEnd('Génération de réponse IA', false);
    
    // En cas d'erreur, renvoyer une réponse par défaut
    return {
      content: 'Désolé, je rencontre des difficultés à traiter votre demande. Veuillez réessayer.'
    };
  }
};

/**
 * Fonction pour interroger l'API Ollama locale avec streaming
 * @param data Les données à envoyer à l'API (question et contexte)
 * @param onStream Callback optionnel appelé à chaque morceau de réponse reçu
 * @returns Une promesse qui résout vers la réponse de l'API
 */
async function queryOllama(data: { question: string; context: string }): Promise<OllamaResponse> {
  logger.debug('Appel à l\'API Ollama locale avec streaming');
  
  try {
    // Construire le prompt avec le préprompt, le contexte et la question
    const preprompt = `Tu es un assistant IA sur un site web. Tu dois répondre dans ce format précis: {response:'ta réponse textuelle ici',script:'code JavaScript exécutable ici'}. Le script doit être du JavaScript valide qui crée agie sur la page de manière dynamique, tu peux faire une page modale en y mettant du contenu pertinant par rapport à la question, ou agir directement sur la page en rajoutant des choses, changeant du texte des couleurs etc. Le script doit créer tous les éléments nécessaires et gérer les styles. N'utilise pas de balises <script> dans ta réponse. N'utilise pas de backticks dans ton script pour éviter les problèmes de parsing. Il faut absolument que tu respectes le format de réponse demandé.`;
    const prompt = `${preprompt}\n\nContexte: ${data.context}\n\nQuestion: ${data.question}`;
    const data_json = {
      model: 'llama3.2',
      prompt: prompt,
      stream: true // Activer le streaming
    };
    
    // Appel à l'API Ollama
    const response = await fetch(`${OLLAMA_API_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data_json),
    });
    
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }
    
    if (!response.body) {
      throw new Error('Le corps de la réponse est null');
    }
    
    // Initialiser le lecteur de flux et le décodeur
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullContent = '';
    let done = false;
    let finalResponse: OllamaResponse | null = null;
    
    logger.debug('Début de la lecture du flux de réponse');
    
    while (!done) {
      const { value, done: streamDone } = await reader.read();
      done = streamDone;
      
      if (done) break;
      
      // Décoder le chunk actuel
      const chunk = decoder.decode(value, { stream: true });
      
      // Traiter chaque ligne JSON dans le chunk
      const jsonChunks = chunk.split('\n').filter(line => line.trim() !== '');
      
      for (const jsonString of jsonChunks) {
        try {
          const jsonObject = JSON.parse(jsonString);
          
          // Mettre à jour la réponse finale avec le dernier objet reçu
          if (jsonObject.done) {
            finalResponse = jsonObject as OllamaResponse;
          }
          
          // Concaténer le contenu de la réponse
          if (jsonObject.response) {
            const responseChunk = jsonObject.response;
            fullContent += responseChunk;
             // Ajout de cette ligne pour déboguer le contenu du chunk de réponse
          }
        } catch (e) {
          logger.warn('Erreur lors du parsing JSON d\'un chunk:', e);
        }
      }
    }
    
    logger.debug('Fin de la lecture du flux de réponse');
    
    // Construire la réponse finale
    if (!finalResponse) {
      console.log("fullContent: ",fullContent);
      // Si nous n'avons pas reçu d'objet final, créer un objet par défaut
      finalResponse = {
        model: 'llama3.2',
        created_at: new Date().toISOString(),
        message: {
          role: 'assistant',
          content: fullContent
        },
        done: true
      };
    } else {
      // Mettre à jour le contenu avec le texte complet
      console.log("fullContent: ",fullContent);
      finalResponse.message = {
        role: 'assistant',
        content: fullContent
      };
    }
    
    logger.debug('Réponse de l\'API Ollama reçue avec succès');
    console.log("finalResponse: ",finalResponse.message.content);
    
    // Extraire la réponse textuelle et le script JavaScript du contenu
    let responseText = finalResponse.message.content;
    let scriptCode = undefined;
    
    // Utiliser une regex pour extraire le format {response:'texte',script:'code'}
    const responsePattern = /{s*responses*:\s*['"](.+?)['"]\s*,\s*script\s*:\s*['"](.+?)['"]\s*}/s;
    const match = finalResponse.message.content.match(responsePattern);
    
    // In the queryOllama function, update the script handling:
    if (match) {
      responseText = match[1]; // Le texte de la réponse
      scriptCode = match[2]; // Le code du script
      logger.debug('Format de réponse JSON détecté et parsé avec succès');
      logger.debug(`Réponse textuelle extraite: ${responseText.substring(0, 50)}...`);
      logger.debug(`Script JavaScript extrait: ${scriptCode ? scriptCode.substring(0, 50) + '...' : 'aucun'}`);
      
      // Mettre à jour le contenu de la réponse finale avec seulement le texte
      finalResponse.message.content = responseText;
    } else {
      logger.warn('Format de réponse JSON non détecté, utilisation du contenu brut');
    }
    
    // Créer un objet OllamaResponse modifié avec le script extrait
    const modifiedResponse = {
      ...finalResponse,
      script: scriptCode
    };
    
    return modifiedResponse;
  } catch (error) {
    logger.error('Erreur lors de l\'appel à l\'API Ollama:', error);
    throw error;
  }
}