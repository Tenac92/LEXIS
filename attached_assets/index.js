import React from 'react';
import Header from '../components/Header';
import { DataCard } from '../components/DataCard';
import LoadingSpinner from '../components/LoadingSpinner';

function CatalogPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <DataCard title="Projects" path="/catalog" />
          <DataCard title="Documents" path="/generated-documents" />
          <DataCard title="Budget" path="/budget" />
        </div>
      </main>
    </div>
  );
}

export default CatalogPage;