'use client';

import { useResponse } from '@/context/ResponseContext';
import Image from 'next/image';
export default function Home() {
  const { aiResponse, transcript } = useResponse();
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-[32px] row-start-2 items-center w-full max-w-4xl">
        <h1 className="text-3xl font-bold mb-6 text-center w-full">Assistant IA</h1>
        
        {transcript && (
          <div className="w-full bg-gray-100 dark:bg-gray-800 p-4 rounded-lg mb-6">
            <h2 className="text-lg font-semibold mb-2">Vous avez dit:</h2>
            <p className="italic">"{transcript}"</p>
          </div>
        )}
        
        {aiResponse && (
          <div className="w-full bg-blue-50 dark:bg-blue-900/30 p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Réponse:</h2>
            <div className="prose dark:prose-invert max-w-none">
              {aiResponse.split('\n').map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>
        )}
        
        {!transcript && !aiResponse && (
          <div className="text-center w-full p-8 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <p className="text-lg">Parlez à l'assistant pour obtenir une réponse...</p>
          </div>
        )}
      </main>
      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/file.svg"
            alt="File icon"
            width={16}
            height={16}
          />
          Learn
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/window.svg"
            alt="Window icon"
            width={16}
            height={16}
          />
          Examples
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/globe.svg"
            alt="Globe icon"
            width={16}
            height={16}
          />
          Go to nextjs.org →
        </a>
      </footer>
    </div>
  );
}
