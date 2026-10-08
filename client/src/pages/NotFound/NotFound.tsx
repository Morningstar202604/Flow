import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';

const NotFound: React.FC = () => {
  const { t } = useLanguage();
  return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-slate-900 mb-4">404</h1>
        <p className="text-lg text-slate-500 mb-6">{t.common.noResults}</p>
        <Link to="/" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          {t.auth.backToHome}
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
