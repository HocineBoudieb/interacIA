'use client';

import dynamic from 'next/dynamic';

// Importer dynamiquement le composant VoiceAssistant pour éviter les erreurs de SSR
const VoiceAssistant = dynamic(
  () => import('@/components/VoiceAssistant'),
  { ssr: false }
);

export default function VoiceAssistantWrapper() {
  return <VoiceAssistant />;
}