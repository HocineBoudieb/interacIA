// Service pour gérer les logs de l'application

// Types de logs disponibles
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

// Configuration du service de logs
const LOG_CONFIG = {
  // Activer/désactiver les logs (peut être contrôlé par une variable d'environnement)
  enabled: process.env.NEXT_PUBLIC_ENABLE_LOGS !== 'false',
  // Niveau minimum de logs à afficher
  minLevel: (process.env.NEXT_PUBLIC_LOG_LEVEL || 'info') as LogLevel,
  // Préfixe pour tous les logs
  prefix: 'InteracIA',
  // Inclure l'horodatage dans les logs
  includeTimestamp: true
}

// Ordre des niveaux de logs pour le filtrage
const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3
}

/**
 * Vérifie si un niveau de log doit être affiché selon la configuration
 */
const shouldLog = (level: LogLevel): boolean => {
  if (!LOG_CONFIG.enabled) return false;
  return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[LOG_CONFIG.minLevel as LogLevel];
}

/**
 * Formate un message de log avec préfixe et horodatage si configuré
 */
const formatLogMessage = (message: string): string => {
  const parts = [LOG_CONFIG.prefix];
  
  if (LOG_CONFIG.includeTimestamp) {
    const now = new Date();
    parts.push(`[${now.toISOString()}]`);
  }
  
  parts.push(message);
  return parts.join(' ');
}

/**
 * Journalise un message avec le niveau DEBUG
 */
export const logDebug = (message: string, ...args: any[]): void => {
  if (shouldLog(LogLevel.DEBUG)) {
    console.debug(formatLogMessage(message), ...args);
  }
}

/**
 * Journalise un message avec le niveau INFO
 */
export const logInfo = (message: string, ...args: any[]): void => {
  if (shouldLog(LogLevel.INFO)) {
    console.info(formatLogMessage(message), ...args);
  }
}

/**
 * Journalise un message avec le niveau WARN
 */
export const logWarn = (message: string, ...args: any[]): void => {
  if (shouldLog(LogLevel.WARN)) {
    console.warn(formatLogMessage(message), ...args);
  }
}

/**
 * Journalise un message avec le niveau ERROR
 */
export const logError = (message: string, error?: any, ...args: any[]): void => {
  if (shouldLog(LogLevel.ERROR)) {
    console.error(formatLogMessage(message), error, ...args);
  }
}

/**
 * Journalise le début d'une opération
 */
export const logOperation = (operation: string): void => {
  logInfo(`Début de l'opération: ${operation}`);
}

/**
 * Journalise la fin d'une opération
 */
export const logOperationEnd = (operation: string, success: boolean = true): void => {
  if (success) {
    logInfo(`Fin de l'opération: ${operation} - Succès`);
  } else {
    logWarn(`Fin de l'opération: ${operation} - Échec`);
  }
}

/**
 * Journalise une erreur API avec des détails
 */
export const logApiError = (endpoint: string, error: any, details?: any): void => {
  logError(`Erreur API [${endpoint}]`, error, details);
}

/**
 * Journalise une action utilisateur
 */
export const logUserAction = (action: string, details?: any): void => {
  logInfo(`Action utilisateur: ${action}`, details);
}

/**
 * Journalise un événement système
 */
export const logSystemEvent = (event: string, details?: any): void => {
  logInfo(`Événement système: ${event}`, details);
}

// Exporter un objet logger pour un accès plus simple
export const logger = {
  debug: logDebug,
  info: logInfo,
  warn: logWarn,
  error: logError,
  operation: logOperation,
  operationEnd: logOperationEnd,
  apiError: logApiError,
  userAction: logUserAction,
  systemEvent: logSystemEvent
}

export default logger;