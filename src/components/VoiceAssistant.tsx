'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { generateAIResponse, getSiteContext } from '@/services/aiService';
import logger from '@/services/logService';
import { useResponse } from '@/context/ResponseContext';

interface VoiceAssistantProps {
  onStatusChange?: (status: string) => void;
}

const VoiceAssistant = ({ onStatusChange }: VoiceAssistantProps) => {
  const { setAiResponse, setTranscript: setContextTranscript } = useResponse();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [status, setStatus] = useState('Inactif');
  const [hasNetworkError, setHasNetworkError] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);
  const [maxReconnectAttempts] = useState(5); // Nombre maximum de tentatives avant de passer en mode hors ligne
  const router = useRouter();
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const networkCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastNetworkErrorTimeRef = useRef<number | null>(null);

  // Fonction pour vérifier la connectivité Internet
  const checkInternetConnection = () => {
    return navigator.onLine;
  };

  // Effet pour surveiller l'état de la connexion Internet
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      updateStatus('Connexion Internet rétablie');
      logger.systemEvent('Connexion Internet rétablie');
      if (hasNetworkError) {
        // Si on avait une erreur réseau, on tente de redémarrer la reconnaissance
        setHasNetworkError(false);
        setReconnectAttempts(0);
        logger.info('Tentative de redémarrage après rétablissement de la connexion');
        startListening();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      updateStatus('Connexion Internet perdue');
      logger.systemEvent('Connexion Internet perdue');
      if (isListening) {
        // Si on était en train d'écouter, on arrête pour éviter des erreurs
        logger.info('Arrêt de l\'écoute suite à la perte de connexion');
        stopListening();
      }
    };

    // Vérification périodique de la connexion (toutes les 30 secondes)
    networkCheckIntervalRef.current = setInterval(() => {
      const online = checkInternetConnection();
      if (online !== isOnline) {
        if (online) {
          handleOnline();
        } else {
          handleOffline();
        }
      }
    }, 30000);

    // Ajouter les écouteurs d'événements pour les changements de connectivité
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Vérifier l'état initial de la connexion
    setIsOnline(checkInternetConnection());

    return () => {
      // Nettoyage
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (networkCheckIntervalRef.current) {
        clearInterval(networkCheckIntervalRef.current);
      }
    };
  }, [hasNetworkError, isListening, isOnline]);

  useEffect(() => {
    // Vérifier si les API Web Speech sont disponibles dans le navigateur
    logger.operation('Initialisation de l\'assistant vocal');
    if (typeof window !== 'undefined') {
      if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
        logger.info('API Web Speech disponible dans le navigateur');
        // Initialiser la reconnaissance vocale
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'fr-FR';
        logger.debug('Configuration de la reconnaissance vocale: lang=fr-FR, continuous=true, interimResults=true');

        recognitionRef.current.onstart = () => {
          setIsListening(true);
          updateStatus('Écoute en cours...');
          logger.info('Démarrage de la reconnaissance vocale');
        };

        recognitionRef.current.onresult = (event) => {
          const current = event.resultIndex;
          const result = event.results[current][0].transcript;
          setTranscript(result);
          setContextTranscript(result);
          
          // Si le résultat est final, traiter la commande
          if (event.results[current].isFinal) {
            logger.debug(`Transcription finale reçue: "${result}"`);
            processCommand(result);
          }
        };

        recognitionRef.current.onerror = (event) => {
          logger.error(`Erreur de reconnaissance vocale: ${event.error}`);
          
          if (event.error === 'network') {
            setHasNetworkError(true);
            updateStatus('Erreur de connexion réseau. Tentative de reconnexion...');
            logger.warn('Erreur réseau détectée dans la reconnaissance vocale');
            handleNetworkError();
          } else if (event.error === 'not-allowed') {
            updateStatus('Erreur: Accès au microphone non autorisé. Veuillez vérifier les permissions.');
            logger.error('Accès au microphone non autorisé');
            speak('Je n\'ai pas accès au microphone. Veuillez vérifier les permissions de votre navigateur.');
          } else if (event.error === 'no-speech') {
            // Pas d'action spéciale pour no-speech, c'est normal
            updateStatus('Aucune parole détectée, continuez à parler...');
            logger.debug('Aucune parole détectée (no-speech)');
          } else {
            updateStatus('Erreur: ' + event.error);
            logger.error(`Erreur de reconnaissance non gérée: ${event.error}`);
          }
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
          logger.debug('Événement onend de la reconnaissance vocale');
          
          // Ne pas afficher "Reconnaissance terminée" si on a une erreur réseau
          if (!hasNetworkError) {
            updateStatus('Reconnaissance terminée');
            
            // Redémarrer automatiquement la reconnaissance si pas d'erreur réseau
            if (recognitionRef.current) {
              try {
                logger.debug('Tentative de redémarrage automatique de la reconnaissance');
                recognitionRef.current.start();
              } catch (error) {
                logger.error('Erreur lors du redémarrage de la reconnaissance:', error);
                updateStatus('Erreur lors du redémarrage de la reconnaissance');
              }
            }
          }
        };

        // Initialiser la synthèse vocale
        synthRef.current = window.speechSynthesis;

        // Démarrer la reconnaissance vocale automatiquement
        startListening();

        // Message de bienvenue
        displayResponse('Bonjour, je suis votre assistant. Comment puis-je vous aider?');
      } else {
        updateStatus('La reconnaissance vocale n\'est pas prise en charge par ce navigateur');
        console.error('La reconnaissance vocale n\'est pas prise en charge par ce navigateur');
      }
    }

    // Nettoyage lors du démontage du composant
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
      // Nettoyer le timeout de reconnexion
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      // Nettoyer l'intervalle de vérification réseau
      if (networkCheckIntervalRef.current) {
        clearInterval(networkCheckIntervalRef.current);
      }
    };
  }, []);

  const updateStatus = (newStatus: string) => {
    setStatus(newStatus);
    if (onStatusChange) {
      onStatusChange(newStatus);
    }
  };

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      try {
        logger.operation('Démarrage de l\'écoute vocale');
        recognitionRef.current.start();
        setHasNetworkError(false); // Réinitialiser l'état d'erreur réseau
        setReconnectAttempts(0); // Réinitialiser le compteur de tentatives
      } catch (error) {
        logger.error('Erreur lors du démarrage de la reconnaissance:', error);
        updateStatus('Erreur lors du démarrage de la reconnaissance vocale');
      }
    }
  };
  
  // Gestion des erreurs réseau avec backoff exponentiel
  const handleNetworkError = () => {
    // Enregistrer le moment de l'erreur réseau
    lastNetworkErrorTimeRef.current = Date.now();
    logger.operation('Gestion d\'erreur réseau');
    
    // Incrémenter le compteur de tentatives
    const attempts = reconnectAttempts + 1;
    setReconnectAttempts(attempts);
    logger.info(`Tentative de reconnexion ${attempts}/${maxReconnectAttempts}`);
    
    // Vérifier si on doit passer en mode hors ligne après plusieurs tentatives
    if (attempts >= maxReconnectAttempts) {
      setOfflineMode(true);
      updateStatus('Mode hors ligne activé après plusieurs tentatives échouées');
      logger.warn(`Passage en mode hors ligne après ${attempts} tentatives échouées`);
      speak('Je passe en mode hors ligne avec des fonctionnalités limitées. Certaines commandes ne seront pas disponibles.');
      return;
    }
    
    // Calculer le délai avec backoff exponentiel (1s, 2s, 4s, 8s, etc.)
    // Avec un maximum de 30 secondes
    const delay = Math.min(Math.pow(2, attempts - 1) * 1000, 30000);
    
    // Afficher le temps restant avant la prochaine tentative
    updateStatus(`Erreur réseau. Nouvelle tentative dans ${delay/1000} secondes... (${attempts}/${maxReconnectAttempts})`);
    
    // Nettoyer tout timeout existant
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    // Programmer une nouvelle tentative
    reconnectTimeoutRef.current = setTimeout(() => {
      // Vérifier si la connexion Internet est disponible avant d'essayer
      if (checkInternetConnection()) {
        updateStatus('Tentative de reconnexion...');
        
        if (recognitionRef.current) {
          try {
            recognitionRef.current.start();
            setHasNetworkError(false);
            setReconnectAttempts(0);
            setOfflineMode(false);
            updateStatus('Reconnexion réussie. Écoute en cours...');
          } catch (error) {
            console.error('Échec de la tentative de reconnexion:', error);
            // Si l'erreur persiste, réessayer
            handleNetworkError();
          }
        }
      } else {
        // Toujours pas de connexion Internet
        updateStatus('Connexion Internet toujours indisponible');
        handleNetworkError();
      }
    }, delay);
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      logger.operation('Arrêt de l\'écoute vocale');
      recognitionRef.current.stop();
    }
  };

  const displayResponse = (text: string, cancelPrevious: boolean = false) => {
    // Mettre à jour le contexte avec la réponse
    setAiResponse(text);
    logger.info(`Réponse affichée: ${text}`);
    logger.info(`Réponse affichée (${text.length} caractères)`);
    
    // Ajouter la synthèse vocale
    if (synthRef.current) {
      // Annuler toute synthèse vocale précédente si demandé
      if (cancelPrevious) {
        synthRef.current.cancel();
      }
      
      // Créer un nouvel objet d'énoncé
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'fr-FR'; // Définir la langue en français
      utterance.rate = 1.0; // Vitesse normale
      utterance.pitch = 1.0; // Tonalité normale
      
      // Lancer la synthèse vocale
      synthRef.current.speak(utterance);
      logger.info('Synthèse vocale démarrée');
    }
  };
  
  // Alias pour maintenir la compatibilité avec le code existant
  const speak = displayResponse;

  // Fonction pour exécuter un script JavaScript généré par l'IA
  const executeScript = (script: string | undefined) => {
    if (!script) return;
    
    logger.operation('Exécution de script');
    logger.debug(`Script à exécuter: ${script.substring(0, 100)}${script.length > 100 ? '...' : ''}`);
    
    try {
      // Créer une fonction à partir du script et l'exécuter
      const scriptFunction = new Function('document', 'router', 'speak', script);
      scriptFunction(document, router, speak);
      updateStatus('Script exécuté avec succès');
      logger.operationEnd('Exécution de script', true);
    } catch (error) {
      logger.error('Erreur lors de l\'exécution du script:', error);
      updateStatus('Erreur lors de l\'exécution du script');
      speak('Désolé, je n\'ai pas pu exécuter cette action.');
      logger.operationEnd('Exécution de script', false);
    }
  };

  const processCommand = async (command: string) => {
    const lowerCommand = command.toLowerCase().trim();
    updateStatus(`Commande reçue: ${lowerCommand}`);
    logger.operation('Traitement de commande vocale');
    logger.userAction('Commande vocale', { command: lowerCommand });

    // Commandes spécifiques pour la gestion de la connexion
    if (lowerCommand.includes('reconnexion') || lowerCommand.includes('réessayer') || 
        lowerCommand.includes('connecte-toi') || lowerCommand.includes('mode en ligne')) {
      logger.info('Commande de reconnexion détectée');
      speak('Je tente de me reconnecter au service de reconnaissance vocale');
      setHasNetworkError(false);
      setReconnectAttempts(0);
      setOfflineMode(false);
      startListening();
      return;
    }

    // Vérifier l'état de la connexion pour les commandes qui nécessitent Internet
    if (offlineMode || !isOnline) {
      speak('Cette commande nécessite une connexion Internet. Je suis actuellement en mode hors ligne.');
      return;
    }

    try {
      // Obtenir le contexte du site
      const siteContext = getSiteContext();
      logger.debug('Contexte du site récupéré pour la génération de réponse');
      
      // Appeler l'API IA pour générer une réponse
      updateStatus('Traitement de votre demande...');
      logger.info('Appel à l\'API IA pour générer une réponse');
      
      // Créer une variable pour stocker la réponse complète
      let fullResponse = '';
      
      // Définir un callback pour traiter les morceaux de réponse en stream
      
      // Appeler generateAIResponse avec le callback de streaming
      const aiResponse = await generateAIResponse(command, siteContext);
      console.log("Réponse de l'IA: ",aiResponse.content);
      // Vérifier si nous sommes passés en mode hors ligne à cause d'erreurs 429
      if (aiResponse.content.includes("mode limité") || aiResponse.content.includes("Je suis désolé, je ne peux pas accéder")) {
        setOfflineMode(true);
        updateStatus('Mode hors ligne activé - Fonctionnalités limitées');
        logger.warn('Passage en mode hors ligne suite à une réponse de secours');
      } else if (offlineMode) {
        // Si nous recevons une réponse normale alors que nous étions en mode hors ligne, désactiver le mode hors ligne
        setOfflineMode(false);
        updateStatus('Mode en ligne rétabli');
        logger.info('Mode en ligne rétabli après réception d\'une réponse normale');
      }
      
      // Afficher la réponse complète
      if (fullResponse.length === 0) {
        displayResponse(aiResponse.content, true);
      }
      
      // Exécuter le script si présent
      if (aiResponse.script) {
        logger.debug('Script détecté dans la réponse IA, exécution...');
        executeScript(aiResponse.script);
      }
      
      logger.operationEnd('Traitement de commande vocale', true);
    } catch (error) {
      logger.error('Erreur lors du traitement de la commande:', error);
      
      // Vérifier si c'est une erreur 429 (Too Many Requests)
      if (error instanceof Error && error.message.includes('429')) {
        updateStatus('Limite de requêtes atteinte. Passage en mode hors ligne temporaire.');
        setOfflineMode(true);
        logger.warn('Erreur 429 détectée, passage en mode hors ligne temporaire');
        speak('Je suis désolé, j\'ai atteint la limite de requêtes au service en ligne. Je passe temporairement en mode limité.');
      } else {
        updateStatus('Erreur lors du traitement de la commande');
        speak('Désolé, je n\'ai pas pu traiter votre demande. Veuillez réessayer.');
      }
      
      logger.operationEnd('Traitement de commande vocale', false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-gray-800 text-white p-4 rounded-lg shadow-lg max-w-xs">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            <div 
              className={`w-3 h-3 rounded-full mr-2 ${isListening ? 'bg-green-500 animate-pulse' : offlineMode ? 'bg-orange-500' : hasNetworkError ? 'bg-yellow-500' : !isOnline ? 'bg-red-500' : 'bg-gray-500'}`}
              title={isListening ? 'Écoute active' : offlineMode ? 'Mode hors ligne' : hasNetworkError ? 'Problème de connexion' : !isOnline ? 'Hors ligne' : 'Inactif'}
            ></div>
            <span className="text-sm font-medium">{status}</span>
          </div>
          {(hasNetworkError || !isOnline || offlineMode) && (
            <button 
              onClick={() => {
                setHasNetworkError(false);
                setReconnectAttempts(0);
                setOfflineMode(false);
                startListening();
              }}
              className="ml-2 text-xs bg-blue-600 hover:bg-blue-700 text-white py-1 px-2 rounded transition-colors"
              title="Réessayer la connexion"
            >
              Réessayer
            </button>
          )}
        </div>
        {transcript && (
          <div className="mt-2 text-sm bg-gray-700 p-2 rounded">
            <p className="italic">Vous avez dit: "{transcript}"</p>
          </div>
        )}
        {hasNetworkError && (
          <div className="mt-2 text-xs text-yellow-300">
            <p>Problème de connexion au service de reconnaissance vocale. Vérifiez votre connexion internet.</p>
            <p className="mt-1">Tentative {reconnectAttempts}/{maxReconnectAttempts}</p>
          </div>
        )}
        {offlineMode && (
          <div className="mt-2 text-xs text-orange-300">
            <p>Mode hors ligne activé. Fonctionnalités limitées disponibles.</p>
            <p className="mt-1">Certaines commandes vocales ne fonctionneront pas.</p>
          </div>
        )}
        {!isOnline && !hasNetworkError && !offlineMode && (
          <div className="mt-2 text-xs text-red-300">
            <p>Votre appareil est hors ligne. Vérifiez votre connexion internet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Déclaration pour TypeScript
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

export default VoiceAssistant;