'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface ResponseContextType {
  aiResponse: string;
  setAiResponse: (response: string) => void;
  transcript: string;
  setTranscript: (transcript: string) => void;
}

const ResponseContext = createContext<ResponseContextType | undefined>(undefined);

export function ResponseProvider({ children }: { children: ReactNode }) {
  const [aiResponse, setAiResponse] = useState<string>('');
  const [transcript, setTranscript] = useState<string>('');

  return (
    <ResponseContext.Provider value={{ aiResponse, setAiResponse, transcript, setTranscript }}>
      {children}
    </ResponseContext.Provider>
  );
}

export function useResponse() {
  const context = useContext(ResponseContext);
  if (context === undefined) {
    throw new Error('useResponse must be used within a ResponseProvider');
  }
  return context;
}