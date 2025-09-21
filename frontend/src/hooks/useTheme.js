import { useState, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const useTheme = () => {
  const [theme, setTheme] = useState('default');
  const [loading, setLoading] = useState(true);

  const fetchTheme = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/site/style/`);
      if (response.ok) {
        const data = await response.json();
        setTheme(data.theme || 'default');
      }
    } catch (error) {
      console.error('Failed to fetch theme:', error);
      setTheme('default');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTheme();
  }, []);

  return { theme, loading, refetchTheme: fetchTheme };
};

export const getThemeClasses = (theme) => {
  const themes = {
    default: {
      pageBackground: 'bg-gray-50 text-gray-900',
      primaryButton: 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg',
      secondaryButton: 'bg-gray-200 hover:bg-gray-300 text-gray-900',
      cardBackground: 'bg-white',
      cardBorder: 'border-gray-200',
      link: 'text-blue-600 hover:text-blue-700 underline',
      badge: 'bg-blue-100 text-blue-700 ring-1 ring-blue-300',
      sectionDivider: 'border-t border-gray-200',
      heroWash: 'bg-gradient-to-br from-blue-400 via-blue-500 to-blue-700',
      inputBorder: 'border-gray-300 focus:ring-2 focus:ring-blue-500',
      text: {
        primary: 'text-gray-900',
        secondary: 'text-gray-600',
        muted: 'text-gray-500',
      },
    },
    verona_sunset: {
      pageBackground: 'bg-paper-ivory text-ink-900',
      primaryButton: 'bg-henna-500 hover:bg-henna-600 text-white shadow-foil-soft',
      secondaryButton: 'bg-foil-gold hover:bg-foil-pale text-ink-900',
      cardBackground: 'bg-white',
      cardBorder: 'border-foil-gold/40',
      link: 'text-henna-600 hover:text-henna-700 underline decoration-foil-gold/40',
      badge: 'bg-henna-100 text-henna-700 ring-1 ring-henna-300',
      sectionDivider: 'border-t border-foil-gold/40',
      heroWash: 'bg-gradient-to-br from-henna-400 via-henna-500 to-henna-700',
      inputBorder: 'border-foil-gold/40 focus:ring-2 focus:ring-henna-500',
      text: {
        primary: 'text-ink-900',
        secondary: 'text-henna-700',
        muted: 'text-henna-600',
      },
    },
  };

  return themes[theme] || themes.default;
};