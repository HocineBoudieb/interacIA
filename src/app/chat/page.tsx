'use client';

import { useState, useRef, useEffect } from 'react';
import { useResponse } from '@/context/ResponseContext';
import { generateAIResponse, getSiteContext } from '@/services/aiService';
import logger from '@/services/logService';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

export default function ChatPage() {
  const { setAiResponse } = useResponse();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Afficher un message de bienvenue au chargement de la page
  useEffect(() => {
    const welcomeMessage: Message = {
      id: Date.now().toString(),
      content: 'Bonjour, je suis votre assistant. Comment puis-je vous aider?',
      sender: 'assistant',
      timestamp: new Date()
    };
    setMessages([welcomeMessage]);
  }, []);

  // Faire défiler automatiquement vers le dernier message
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputValue.trim()) return;
    
    // Ajouter le message de l'utilisateur
    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: 'user',
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsProcessing(true);
    
    try {
      logger.operation('Traitement de message textuel');
      logger.userAction('Message textuel', { message: inputValue });
      
      // Obtenir le contexte du site
      const siteContext = getSiteContext();
      
      // Appeler l'API IA pour générer une réponse
      logger.info('Appel à l\'API IA pour générer une réponse');
      const aiResponse = await generateAIResponse(inputValue, siteContext);
      
      // Ajouter la réponse de l'assistant
      const assistantMessage: Message = {
        id: Date.now().toString(),
        content: aiResponse.content,
        sender: 'assistant',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      setAiResponse(aiResponse.content);
      
      // Exécuter le script si présent
      if (aiResponse.script) {
        logger.debug('Script détecté dans la réponse IA');
        try {
          // Créer un élément script et l'ajouter au DOM pour l'exécuter
          const scriptElement = document.createElement('script');
          scriptElement.text = aiResponse.script;
          document.body.appendChild(scriptElement);
          
          // Supprimer l'élément script après exécution
          document.body.removeChild(scriptElement);
          
          logger.info('Script exécuté avec succès');
        } catch (scriptError) {
          logger.error('Erreur lors de lexécution du script:', scriptError);
        }
      }
      
      logger.operationEnd('Traitement de message textuel', true);
    } catch (error) {
      logger.error('Erreur lors du traitement du message:', error);
      
      // Ajouter un message d'erreur
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: 'Désolé, je n\'ai pas pu traiter votre demande. Veuillez réessayer.',
        sender: 'assistant',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
      logger.operationEnd('Traitement de message textuel', false);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-screen p-4 sm:p-6 md:p-8 font-[family-name:var(--font-geist-sans)]">
      <h1 className="text-3xl font-bold mb-6 text-center">Chat avec l'Assistant IA</h1>
      
      {/* Zone de messages */}
      <div className="flex-grow overflow-y-auto mb-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
        {messages.map((message) => (
          <div 
            key={message.id} 
            className={`mb-4 ${message.sender === 'user' ? 'text-right' : 'text-left'}`}
          >
            <div 
              className={`inline-block max-w-[80%] p-3 rounded-lg ${message.sender === 'user' 
                ? 'bg-blue-500 text-white rounded-br-none' 
                : 'bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-none'}`}
            >
              <div className="prose dark:prose-invert max-w-none">
                {message.content.split('\n').map((line, i) => (
                  <p key={i} className="m-0">{line}</p>
                ))}
              </div>
              <div className="text-xs opacity-70 mt-1">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Formulaire de saisie */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder="Tapez votre message ici..."
          disabled={isProcessing}
          className="flex-grow p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        />
        <button 
          type="submit" 
          disabled={isProcessing || !inputValue.trim()}
          className="p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isProcessing ? (
            <span className="inline-block animate-pulse">...</span>
          ) : (
            <span>Envoyer</span>
          )}
        </button>
      </form>
    </div>
  );
}