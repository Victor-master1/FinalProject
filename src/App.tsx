import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import { FiTarget, FiZap, FiPlay, FiDownload, FiBarChart, FiSettings, FiBook } from 'react-icons/fi';
import ModelCreator from './components/ModelCreator';
import ModelTrainer from './components/ModelTrainer';
import ModelTester from './components/ModelTester';
import DataImporter from './components/DataImporter';
import SignLearning from './components/SignLearning';
import DataVisualizer from './components/DataVisualizer';
import Settings from './components/Settings';
import SpeechSynthesis from './components/SpeechSynthesis';
import { api } from './utils/api';
import { settingsManager } from './utils/settingsManager';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('create');
  const [models, setModels] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [settings, setSettings] = useState<any>({});

  const tabs = [
    { id: 'create', name: 'Crear Modelo', icon: FiTarget, color: 'from-emerald-500 to-teal-500' },
    { id: 'train', name: 'Entrenar', icon: FiZap, color: 'from-orange-500 to-red-500' },
    { id: 'test', name: 'Usar Modelo', icon: FiPlay, color: 'from-blue-500 to-indigo-500' },
    { id: 'learn', name: 'Aprender Señas', icon: FiBook, color: 'from-indigo-500 to-purple-500' },
    { id: 'import', name: 'Importar', icon: FiDownload, color: 'from-purple-500 to-pink-500' },
    { id: 'visualize', name: 'Analytics', icon: FiBarChart, color: 'from-cyan-500 to-blue-500' },
    { id: 'settings', name: 'Configuración', icon: FiSettings, color: 'from-gray-500 to-gray-600' }
  ];

  useEffect(() => {
    loadModels();
    initializeSettings();
  }, []);

  const initializeSettings = () => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme);
    }

    const unsubscribe = settingsManager.subscribe((newSettings) => {
      setSettings(newSettings);
      applyGlobalSettings(newSettings);
    });

    const currentSettings = settingsManager.export();
    if (currentSettings !== '{}') {
      setSettings(JSON.parse(currentSettings));
      applyGlobalSettings(JSON.parse(currentSettings));
    }

    return unsubscribe;
  };

  const applyGlobalSettings = (settings: any) => {
    if (settings.appearance) {
      const body = document.body;
      body.classList.remove('high-contrast', 'compact-mode', 'no-animations');

      if (settings.appearance.highContrast) {
        body.classList.add('high-contrast');
      }

      if (settings.appearance.compactMode) {
        body.classList.add('compact-mode');
      }

      if (!settings.appearance.animations) {
        body.classList.add('no-animations');
      }

      if (settings.appearance.fontSize) {
        document.documentElement.style.fontSize = getFontSizeValue(settings.appearance.fontSize);
      }

      if (settings.appearance.borderRadius) {
        document.documentElement.style.setProperty('--border-radius-base', getBorderRadiusValue(settings.appearance.borderRadius));
      }
    }

    if (settings.advanced?.debugMode) {
      window.signflowDebug = true;
      console.log('Debug mode enabled globally');
    } else {
      window.signflowDebug = false;
    }
  };

  const getFontSizeValue = (size: string) => {
    const sizes = {
      'small': '14px',
      'medium': '16px',
      'large': '18px',
      'extra-large': '20px'
    };
    return sizes[size as keyof typeof sizes] || sizes.medium;
  };

  const getBorderRadiusValue = (radius: string) => {
    const radiuses = {
      'none': '0px',
      'small': '4px',
      'normal': '8px',
      'large': '16px'
    };
    return radiuses[radius as keyof typeof radiuses] || radiuses.normal;
  };

  const loadModels = async () => {
    try {
      const response = await api.get('/models');
      setModels(response.data);
    } catch (error) {
      console.error('Error loading models:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModelCreated = (model: any) => {
    setModels([...models, model]);
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    settingsManager.set('appearance.theme', newTheme);
  };

  const renderActiveComponent = () => {
    const shouldAnimate = settings.appearance?.animations !== false;

    if (shouldAnimate) {
      const animationProps = {
        initial: { opacity: 0, x: 20 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -20 },
        transition: { duration: 0.4 }
      };

      switch (activeTab) {
        case 'create':
          return <motion.div {...animationProps}><ModelCreator onModelCreated={handleModelCreated} /></motion.div>;
        case 'train':
          return <motion.div {...animationProps}><ModelTrainer models={models} /></motion.div>;
        case 'test':
          return <motion.div {...animationProps}><ModelTester models={models} /></motion.div>;
        case 'learn':
          return <motion.div {...animationProps}><SignLearning models={models} /></motion.div>;
        case 'import':
          return <motion.div {...animationProps}><DataImporter onDataImported={loadModels} /></motion.div>;
        case 'visualize':
          return <motion.div {...animationProps}><DataVisualizer models={models} /></motion.div>;
        case 'settings':
          return <motion.div {...animationProps}><Settings theme={theme} onThemeToggle={toggleTheme} /></motion.div>;
        default:
          return <motion.div {...animationProps}><ModelCreator onModelCreated={handleModelCreated} /></motion.div>;
      }
    } else {
      switch (activeTab) {
        case 'create':
          return <div><ModelCreator onModelCreated={handleModelCreated} /></div>;
        case 'train':
          return <div><ModelTrainer models={models} /></div>;
        case 'test':
          return <div><ModelTester models={models} /></div>;
        case 'learn':
          return <div><SignLearning models={models} /></div>;
        case 'import':
          return <div><DataImporter onDataImported={loadModels} /></div>;
        case 'visualize':
          return <div><DataVisualizer models={models} /></div>;
        case 'settings':
          return <div><Settings theme={theme} onThemeToggle={toggleTheme} /></div>;
        default:
          return <div><ModelCreator onModelCreated={handleModelCreated} /></div>;
      }
    }
  };

  if (isLoading) {
    const shouldAnimate = settings.appearance?.animations !== false;
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className="text-center">
          {shouldAnimate ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-16 h-16 mx-auto mb-4 border-4 border-blue-200 border-t-blue-600 rounded-full"
            />
          ) : (
            <div className="w-16 h-16 mx-auto mb-4 border-4 border-blue-200 border-t-blue-600 rounded-full" />
          )}
          <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
            Cargando sistema...
          </p>
        </div>
      </div>
    );
  }

  const shouldAnimate = settings.appearance?.animations !== false;

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      theme === 'dark'
        ? 'bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900'
        : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'
    }`}>
      <div className="container mx-auto px-4 py-8">
        {shouldAnimate ? (
          <motion.header
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="inline-block"
            >
              <h1 className={`text-6xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent`}>
                Eres Criminal?
              </h1>
            </motion.div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className={`text-xl ${theme === 'dark' ? 'text-blue-200' : 'text-gray-600'}`}
            >
              Plataforma inteligente para reconocimiento de lenguaje de señas
            </motion.p>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-4 flex items-center justify-center gap-4"
            >
              <div className={`px-3 py-1 rounded-full text-sm ${
                theme === 'dark' ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
              }`}>
                {models.length} Modelos
              </div>
              <button
                onClick={toggleTheme}
                className={`p-2 rounded-full transition-colors ${
                  theme === 'dark' ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
            </motion.div>
          </motion.header>
        ) : (
          <header className="text-center mb-12">
            <div className="inline-block">
              <h1 className={`text-6xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent`}>
                Eres Criminal?
              </h1>
            </div>
            <p className={`text-xl ${theme === 'dark' ? 'text-blue-200' : 'text-gray-600'}`}>
              Plataforma inteligente para reconocimiento de lenguaje de señas
            </p>
            <div className="mt-4 flex items-center justify-center gap-4">
              <div className={`px-3 py-1 rounded-full text-sm ${
                theme === 'dark' ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
              }`}>
                {models.length} Modelos
              </div>
              <button
                onClick={toggleTheme}
                className={`p-2 rounded-full transition-colors ${
                  theme === 'dark' ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
            </div>
          </header>
        )}

        {shouldAnimate ? (
          <motion.nav
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="mb-8"
          >
            <div className="flex flex-wrap justify-center gap-3">
              {tabs.map((tab, index) => (
                <motion.button
                  key={tab.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative px-6 py-4 rounded-2xl font-semibold transition-all duration-300 flex items-center gap-3 overflow-hidden ${
                    activeTab === tab.id
                      ? `bg-gradient-to-r ${tab.color} text-white shadow-2xl`
                      : theme === 'dark'
                      ? 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 hover:text-white backdrop-blur-sm border border-gray-700'
                      : 'bg-white/80 text-gray-700 hover:bg-white hover:text-gray-900 shadow-lg backdrop-blur-sm border border-gray-200'
                  }`}
                >
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-gradient-to-r opacity-20"
                      style={{ background: `linear-gradient(to right, ${tab.color})` }}
                    />
                  )}
                  <tab.icon className="text-xl" />
                  <span className="relative z-10">{tab.name}</span>
                  {activeTab === tab.id && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-2 h-2 bg-white rounded-full opacity-60"
                    />
                  )}
                </motion.button>
              ))}
            </div>
          </motion.nav>
        ) : (
          <nav className="mb-8">
            <div className="flex flex-wrap justify-center gap-3">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative px-6 py-4 rounded-2xl font-semibold transition-all duration-300 flex items-center gap-3 overflow-hidden ${
                    activeTab === tab.id
                      ? `bg-gradient-to-r ${tab.color} text-white shadow-2xl`
                      : theme === 'dark'
                      ? 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 hover:text-white backdrop-blur-sm border border-gray-700'
                      : 'bg-white/80 text-gray-700 hover:bg-white hover:text-gray-900 shadow-lg backdrop-blur-sm border border-gray-200'
                  }`}
                >
                  <tab.icon className="text-xl" />
                  <span className="relative z-10">{tab.name}</span>
                  {activeTab === tab.id && (
                    <div className="w-2 h-2 bg-white rounded-full opacity-60" />
                  )}
                </button>
              ))}
            </div>
          </nav>
        )}

        <main
          key={activeTab}
          className={`rounded-3xl shadow-2xl p-8 backdrop-blur-lg border ${
            theme === 'dark'
              ? 'bg-gray-800/30 border-gray-700/50'
              : 'bg-white/90 border-white/50'
          }`}
        >
          {shouldAnimate ? (
            <AnimatePresence mode="wait">
              {renderActiveComponent()}
            </AnimatePresence>
          ) : (
            renderActiveComponent()
          )}
        </main>

        <SpeechSynthesis />
      </div>

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: theme === 'dark' ? '#374151' : '#ffffff',
            color: theme === 'dark' ? '#ffffff' : '#000000',
            border: `1px solid ${theme === 'dark' ? '#4B5563' : '#E5E7EB'}`,
          },
        }}
      />
    </div>
  );
};

export default App;