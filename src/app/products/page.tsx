import React from 'react';

export default function Products() {
  return (
    <div className="min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <h1 className="text-3xl font-bold mb-8">Nos Produits</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Produit 1 */}
        <div className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
          <div className="h-40 bg-gray-200 rounded-md mb-4"></div>
          <h2 className="text-xl font-semibold mb-2">Produit 1</h2>
          <p className="text-gray-600 mb-4">Description du produit 1. Ceci est un exemple de produit.</p>
          <p className="font-bold">99,99 €</p>
        </div>

        {/* Produit 2 */}
        <div className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
          <div className="h-40 bg-gray-200 rounded-md mb-4"></div>
          <h2 className="text-xl font-semibold mb-2">Produit 2</h2>
          <p className="text-gray-600 mb-4">Description du produit 2. Ceci est un exemple de produit.</p>
          <p className="font-bold">149,99 €</p>
        </div>

        {/* Produit 3 */}
        <div className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
          <div className="h-40 bg-gray-200 rounded-md mb-4"></div>
          <h2 className="text-xl font-semibold mb-2">Produit 3</h2>
          <p className="text-gray-600 mb-4">Description du produit 3. Ceci est un exemple de produit.</p>
          <p className="font-bold">79,99 €</p>
        </div>

        {/* Produit 4 */}
        <div className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
          <div className="h-40 bg-gray-200 rounded-md mb-4"></div>
          <h2 className="text-xl font-semibold mb-2">Produit 4</h2>
          <p className="text-gray-600 mb-4">Description du produit 4. Ceci est un exemple de produit.</p>
          <p className="font-bold">129,99 €</p>
        </div>

        {/* Produit 5 */}
        <div className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
          <div className="h-40 bg-gray-200 rounded-md mb-4"></div>
          <h2 className="text-xl font-semibold mb-2">Produit 5</h2>
          <p className="text-gray-600 mb-4">Description du produit 5. Ceci est un exemple de produit.</p>
          <p className="font-bold">199,99 €</p>
        </div>

        {/* Produit 6 */}
        <div className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
          <div className="h-40 bg-gray-200 rounded-md mb-4"></div>
          <h2 className="text-xl font-semibold mb-2">Produit 6</h2>
          <p className="text-gray-600 mb-4">Description du produit 6. Ceci est un exemple de produit.</p>
          <p className="font-bold">89,99 €</p>
        </div>
      </div>
    </div>
  );
}