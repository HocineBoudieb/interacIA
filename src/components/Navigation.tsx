'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();
  
  return (
    <nav className="bg-gray-800 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <div className="text-xl font-bold">InteracIA</div>
        <ul className="flex space-x-6">
          <li>
            <Link 
              href="/" 
              className={`hover:text-blue-300 transition-colors ${pathname === '/' ? 'text-blue-400 font-medium' : ''}`}
            >
              Accueil
            </Link>
          </li>
          <li>
            <Link 
              href="/chat" 
              className={`hover:text-blue-300 transition-colors ${pathname === '/chat' ? 'text-blue-400 font-medium' : ''}`}
            >
              Chat Textuel
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}