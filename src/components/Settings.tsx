import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSun, FiMoon, FiMonitor, FiVolume2, FiVolumeX, FiMic, FiMicOff, FiCamera, FiSettings, FiDownload, FiUpload, FiTrash2, FiSave, FiRotateCcw, FiInfo, FiShield, FiGlobe, FiUser, FiKey, FiDatabase, FiCheck, FiX, FiZap} from 'react-icons/fi';
import toast from 'react-hot-toast';

declare global {
  interface Window {
    signflowDebug?: boolean;
  }
}

interface SettingsProps {
  theme: 'light' | 'dark' | 'auto';
  onThemeToggle: () => void;
}

const Settings: React.FC<SettingsProps> = ({ theme, onThemeToggle }) => {
  const [activeSection, setActiveSection] = useState<string>('appearance');
  const [settings, setSettings] = useState({
    appearance: {
      theme: theme,
      animations: true,
      compactMode: false,
      highContrast: false,
      fontSize: 'medium',
      borderRadius: 'normal'
    },
    audio: {
      enabled: true,
      volume: 0.8,
      voice: '',
      rate: 1,
      pitch: 1,
      autoSpeak: false,
      soundEffects: true
    },
    camera: {
      resolution: '640x480',
      frameRate: 30,
      mirror: true,
      brightness: 0,
      contrast: 0,
      autoFocus: true
    },
    detection: {
      confidenceThreshold: 0.7,
      predictionDelay: 500,
      maxPredictions: 10,
      autoCapture: true,
      stabilization: true
    },
    privacy: {
      saveDetections: true,
      shareAnalytics: false,
      localStorage: true,
      dataRetention: 30
    },
    advanced: {
      debugMode: false,
      performanceMode: false,
      modelCaching: true,
      gpuAcceleration: true,
      experimentalFeatures: false
    }
  });

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  const sections = [
    { id: 'appearance', name: 'Apariencia', icon: FiMonitor, color: 'from-blue-500 to-indigo-500' },
    { id: 'audio', name: 'Audio', icon: FiVolume2, color: 'from-green-500 to-emerald-500' },
    { id: 'camera', name: 'Cámara', icon: FiCamera, color: 'from-purple-500 to-violet-500' },
    { id: 'detection', name: 'Detección', icon: FiSettings, color: 'from-orange-500 to-red-500' },
    { id: 'privacy', name: 'Privacidad', icon: FiShield, color: 'from-pink-500 to-rose-500' },
    { id: 'advanced', name: 'Avanzado', icon: FiKey, color: 'from-gray-500 to-gray-600' }
  ];

  useEffect(() => {
    loadVoices();
    loadSettings();

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    if ('speechSynthesis' in window) {
      speechSynthesis.addEventListener('voiceschanged', loadVoices);
    }
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if ('speechSynthesis' in window) {
        speechSynthesis.removeEventListener('voiceschanged', loadVoices);
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  useEffect(() => {
    applySettings();
  }, [settings]);

  const loadVoices = () => {
    if ('speechSynthesis' in window) {
      const availableVoices = speechSynthesis.getVoices();
      const spanishVoices = availableVoices.filter(voice =>
        voice.lang.startsWith('es') || voice.lang.startsWith('en')
      );
      setVoices(spanishVoices);

      if (spanishVoices.length > 0 && !settings.audio.voice) {
        updateSetting('audio', 'voice', spanishVoices[0].name);
      }
    }
  };

  const loadSettings = () => {
    try {
      const savedSettings = localStorage.getItem('signflow-settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsed }));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const applySettings = () => {
    const root = document.documentElement;

    root.style.fontSize = getFontSizeValue(settings.appearance.fontSize);
    root.style.setProperty('--border-radius-base', getBorderRadiusValue(settings.appearance.borderRadius));

    document.body.className = '';

    if (settings.appearance.highContrast) {
      document.body.classList.add('high-contrast');
    }

    if (settings.appearance.compactMode) {
      document.body.classList.add('compact-mode');
    }

    if (!settings.appearance.animations) {
      document.body.classList.add('no-animations');
    }

    if (settings.advanced.debugMode) {
      console.log('Debug mode enabled');
      window.signflowDebug = true;
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

  const saveSettings = async () => {
    try {
      localStorage.setItem('signflow-settings', JSON.stringify(settings));
      setIsDirty(false);

      if (settings.privacy.shareAnalytics) {
        try {
          await fetch('/api/analytics/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'settings_saved',
              timestamp: new Date().toISOString()
            })
          });
        } catch (error) {
          console.warn('Analytics not available');
        }
      }

      toast.success('Configuración guardada correctamente');
    } catch (error) {
      toast.error('Error al guardar la configuración');
    }
  };

  const resetSettings = async () => {
    if (window.confirm('¿Estás seguro de que quieres restablecer todas las configuraciones?')) {
      try {
        localStorage.removeItem('signflow-settings');

        const defaultSettings = {
          appearance: {
            theme: 'dark' as 'light' | 'dark' | 'auto',
            animations: true,
            compactMode: false,
            highContrast: false,
            fontSize: 'medium',
            borderRadius: 'normal'
          },
          audio: {
            enabled: true,
            volume: 0.8,
            voice: '',
            rate: 1,
            pitch: 1,
            autoSpeak: false,
            soundEffects: true
          },
          camera: {
            resolution: '640x480',
            frameRate: 30,
            mirror: true,
            brightness: 0,
            contrast: 0,
            autoFocus: true
          },
          detection: {
            confidenceThreshold: 0.7,
            predictionDelay: 500,
            maxPredictions: 10,
            autoCapture: true,
            stabilization: true
          },
          privacy: {
            saveDetections: true,
            shareAnalytics: false,
            localStorage: true,
            dataRetention: 30
          },
          advanced: {
            debugMode: false,
            performanceMode: false,
            modelCaching: true,
            gpuAcceleration: true,
            experimentalFeatures: false
          }
        };

        setSettings(defaultSettings);
        setIsDirty(false);

        document.body.className = '';

        toast.success('Configuración restablecida');
      } catch (error) {
        toast.error('Error al restablecer configuración');
      }
    }
  };

  const exportSettings = () => {
    try {
      const dataStr = JSON.stringify(settings, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `signflow-settings-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Configuración exportada');
    } catch (error) {
      toast.error('Error al exportar configuración');
    }
  };

  const importSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        setSettings(imported);
        setIsDirty(true);
        toast.success('Configuración importada correctamente');
      } catch (error) {
        toast.error('Error al importar la configuración');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const updateSetting = (section: string, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev],
        [key]: value
      }
    }));
    setIsDirty(true);
  };

  const testVoice = () => {
    if ('speechSynthesis' in window && settings.audio.enabled) {
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance('Hola, esta es una prueba de voz para SignFlow AI');
      const voice = voices.find(v => v.name === settings.audio.voice);
      if (voice) utterance.voice = voice;
      utterance.volume = settings.audio.volume;
      utterance.rate = settings.audio.rate;
      utterance.pitch = settings.audio.pitch;
      speechSynthesis.speak(utterance);
    } else {
      toast.error('Síntesis de voz no disponible');
    }
  };

  const cleanLocalData = async () => {
    if (window.confirm('¿Estás seguro de que quieres eliminar todos los datos locales?')) {
      try {
        const keysToKeep = ['signflow-settings'];
        const keysToDelete = [];

        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && !keysToKeep.includes(key)) {
            keysToDelete.push(key);
          }
        }

        keysToDelete.forEach(key => localStorage.removeItem(key));

        if ('indexedDB' in window) {
          const databases = await indexedDB.databases();
          databases.forEach(db => {
            if (db.name && db.name.includes('signflow')) {
              indexedDB.deleteDatabase(db.name);
            }
          });
        }

        toast.success('Datos locales eliminados');
      } catch (error) {
        toast.error('Error al eliminar datos locales');
      }
    }
  };

  const clearCache = async () => {
    if (window.confirm('¿Eliminar toda la caché del navegador?')) {
      try {
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(
            cacheNames.map(name => caches.delete(name))
          );
        }

        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          registrations.forEach(registration => registration.unregister());
        }

        toast.success('Caché eliminada');
      } catch (error) {
        toast.error('Error al eliminar caché');
      }
    }
  };

  const runPerformanceTest = () => {
    const start = performance.now();

    const testData = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      data: Math.random()
    }));

    testData.sort((a, b) => a.data - b.data);
    testData.filter(item => item.data > 0.5);
    testData.map(item => ({ ...item, processed: true }));

    const end = performance.now();
    const duration = end - start;

    toast.success(`Prueba de rendimiento: ${duration.toFixed(2)}ms`);

    if (settings.advanced.debugMode) {
      console.log('Performance test results:', {
        duration,
        testSize: testData.length,
        memoryUsage: (performance as any).memory?.usedJSHeapSize || 'N/A'
      });
    }
  };

  const renderAppearanceSettings = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            updateSetting('appearance', 'theme', 'light');
            if (theme === 'dark') onThemeToggle();
          }}
          className={`p-4 rounded-xl border-2 transition-all ${
            settings.appearance.theme === 'light'
              ? 'border-yellow-400 bg-yellow-50 text-yellow-800'
              : 'border-gray-200 hover:border-gray-300 bg-white'
          }`}
        >
          <FiSun className="text-2xl mx-auto mb-2" />
          <div className="font-semibold">Claro</div>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            updateSetting('appearance', 'theme', 'dark');
            if (theme === 'light') onThemeToggle();
          }}
          className={`p-4 rounded-xl border-2 transition-all ${
            settings.appearance.theme === 'dark'
              ? 'border-indigo-400 bg-indigo-50 text-indigo-800'
              : 'border-gray-200 hover:border-gray-300 bg-white'
          }`}
        >
          <FiMoon className="text-2xl mx-auto mb-2" />
          <div className="font-semibold">Oscuro</div>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => updateSetting('appearance', 'theme', 'auto')}
          className={`p-4 rounded-xl border-2 transition-all ${
            settings.appearance.theme === 'auto'
              ? 'border-green-400 bg-green-50 text-green-800'
              : 'border-gray-200 hover:border-gray-300 bg-white'
          }`}
        >
          <FiMonitor className="text-2xl mx-auto mb-2" />
          <div className="font-semibold">Auto</div>
        </motion.button>
      </div>

      <div className="space-y-4">
        <label className="flex items-center justify-between">
          <div>
            <div className="font-medium">Animaciones</div>
            <div className="text-sm text-gray-600">Habilitar transiciones animadas</div>
          </div>
          <input
            type="checkbox"
            checked={settings.appearance.animations}
            onChange={(e) => updateSetting('appearance', 'animations', e.target.checked)}
            className="w-5 h-5 text-blue-500 rounded focus:ring-blue-500"
          />
        </label>

        <label className="flex items-center justify-between">
          <div>
            <div className="font-medium">Modo Compacto</div>
            <div className="text-sm text-gray-600">Interfaz más densa</div>
          </div>
          <input
            type="checkbox"
            checked={settings.appearance.compactMode}
            onChange={(e) => updateSetting('appearance', 'compactMode', e.target.checked)}
            className="w-5 h-5 text-blue-500 rounded focus:ring-blue-500"
          />
        </label>

        <label className="flex items-center justify-between">
          <div>
            <div className="font-medium">Alto Contraste</div>
            <div className="text-sm text-gray-600">Mejora la visibilidad</div>
          </div>
          <input
            type="checkbox"
            checked={settings.appearance.highContrast}
            onChange={(e) => updateSetting('appearance', 'highContrast', e.target.checked)}
            className="w-5 h-5 text-blue-500 rounded focus:ring-blue-500"
          />
        </label>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tamaño de Fuente
          </label>
          <select
            value={settings.appearance.fontSize}
            onChange={(e) => updateSetting('appearance', 'fontSize', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="small">Pequeño</option>
            <option value="medium">Mediano</option>
            <option value="large">Grande</option>
            <option value="extra-large">Extra Grande</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Bordes
          </label>
          <select
            value={settings.appearance.borderRadius}
            onChange={(e) => updateSetting('appearance', 'borderRadius', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="none">Sin bordes</option>
            <option value="small">Bordes pequeños</option>
            <option value="normal">Bordes normales</option>
            <option value="large">Bordes grandes</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderAudioSettings = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
        <div className="flex items-center gap-3">
          {settings.audio.enabled ? <FiVolume2 className="text-green-500" /> : <FiVolumeX className="text-gray-400" />}
          <div>
            <div className="font-medium">Audio del Sistema</div>
            <div className="text-sm text-gray-600">Habilitar síntesis de voz</div>
          </div>
        </div>
        <input
          type="checkbox"
          checked={settings.audio.enabled}
          onChange={(e) => updateSetting('audio', 'enabled', e.target.checked)}
          className="w-5 h-5 text-green-500 rounded focus:ring-green-500"
        />
      </div>

      {settings.audio.enabled && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Volumen: {Math.round(settings.audio.volume * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={settings.audio.volume}
              onChange={(e) => updateSetting('audio', 'volume', parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-green"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Voz
            </label>
            <select
              value={settings.audio.voice}
              onChange={(e) => updateSetting('audio', 'voice', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="">Voz por defecto</option>
              {voices.map(voice => (
                <option key={voice.name} value={voice.name}>
                  {voice.name} ({voice.lang})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Velocidad: {settings.audio.rate.toFixed(1)}x
              </label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={settings.audio.rate}
                onChange={(e) => updateSetting('audio', 'rate', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-green"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tono: {settings.audio.pitch.toFixed(1)}
              </label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={settings.audio.pitch}
                onChange={(e) => updateSetting('audio', 'pitch', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-green"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={testVoice}
              className="flex-1 bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 transition-colors font-semibold"
            >
              Probar Voz
            </motion.button>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.audio.autoSpeak}
                onChange={(e) => updateSetting('audio', 'autoSpeak', e.target.checked)}
                className="w-4 h-4 text-green-500 rounded focus:ring-green-500"
              />
              <span className="text-sm">Auto hablar</span>
            </label>
          </div>

          <label className="flex items-center justify-between">
            <div>
              <div className="font-medium">Efectos de Sonido</div>
              <div className="text-sm text-gray-600">Sonidos de notificación</div>
            </div>
            <input
              type="checkbox"
              checked={settings.audio.soundEffects}
              onChange={(e) => updateSetting('audio', 'soundEffects', e.target.checked)}
              className="w-5 h-5 text-green-500 rounded focus:ring-green-500"
            />
          </label>
        </div>
      )}
    </div>
  );

  const renderCameraSettings = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Resolución
        </label>
        <select
          value={settings.camera.resolution}
          onChange={(e) => updateSetting('camera', 'resolution', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
        >
          <option value="320x240">320x240 (Baja)</option>
          <option value="640x480">640x480 (Media)</option>
          <option value="1280x720">1280x720 (Alta)</option>
          <option value="1920x1080">1920x1080 (Full HD)</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          FPS: {settings.camera.frameRate}
        </label>
        <input
          type="range"
          min="15"
          max="60"
          step="15"
          value={settings.camera.frameRate}
          onChange={(e) => updateSetting('camera', 'frameRate', parseInt(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-purple"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>15 fps</span>
          <span>30 fps</span>
          <span>45 fps</span>
          <span>60 fps</span>
        </div>
      </div>

      <div className="space-y-4">
        <label className="flex items-center justify-between">
          <div>
            <div className="font-medium">Espejo</div>
            <div className="text-sm text-gray-600">Voltear imagen horizontalmente</div>
          </div>
          <input
            type="checkbox"
            checked={settings.camera.mirror}
            onChange={(e) => updateSetting('camera', 'mirror', e.target.checked)}
            className="w-5 h-5 text-purple-500 rounded focus:ring-purple-500"
          />
        </label>

        <label className="flex items-center justify-between">
          <div>
            <div className="font-medium">Auto Enfoque</div>
            <div className="text-sm text-gray-600">Enfoque automático</div>
          </div>
          <input
            type="checkbox"
            checked={settings.camera.autoFocus}
            onChange={(e) => updateSetting('camera', 'autoFocus', e.target.checked)}
            className="w-5 h-5 text-purple-500 rounded focus:ring-purple-500"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Brillo: {settings.camera.brightness > 0 ? '+' : ''}{settings.camera.brightness}
          </label>
          <input
            type="range"
            min="-50"
            max="50"
            step="5"
            value={settings.camera.brightness}
            onChange={(e) => updateSetting('camera', 'brightness', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-purple"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Contraste: {settings.camera.contrast > 0 ? '+' : ''}{settings.camera.contrast}
          </label>
          <input
            type="range"
            min="-50"
            max="50"
            step="5"
            value={settings.camera.contrast}
            onChange={(e) => updateSetting('camera', 'contrast', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-purple"
          />
        </div>
      </div>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => toast.success('Configuración de cámara aplicada')}
        className="w-full bg-purple-500 text-white py-3 px-4 rounded-lg hover:bg-purple-600 transition-colors font-semibold"
      >
        Aplicar Configuración
      </motion.button>
    </div>
  );

  const renderDetectionSettings = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Umbral de Confianza: {(settings.detection.confidenceThreshold * 100).toFixed(0)}%
        </label>
        <input
          type="range"
          min="0.3"
          max="0.95"
          step="0.05"
          value={settings.detection.confidenceThreshold}
          onChange={(e) => updateSetting('detection', 'confidenceThreshold', parseFloat(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-orange"
        />
        <div className="text-sm text-gray-600 mt-1">
          Menor valor = más sensible, Mayor valor = más preciso
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Delay de Predicción: {settings.detection.predictionDelay}ms
        </label>
        <input
          type="range"
          min="100"
          max="1000"
          step="50"
          value={settings.detection.predictionDelay}
          onChange={(e) => updateSetting('detection', 'predictionDelay', parseInt(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-orange"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Máximo de Predicciones: {settings.detection.maxPredictions}
        </label>
        <input
          type="range"
          min="5"
          max="50"
          step="5"
          value={settings.detection.maxPredictions}
          onChange={(e) => updateSetting('detection', 'maxPredictions', parseInt(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-orange"
        />
      </div>

      <label className="flex items-center justify-between">
        <div>
          <div className="font-medium">Captura Automática</div>
          <div className="text-sm text-gray-600">Capturar muestras automáticamente durante el entrenamiento</div>
        </div>
        <input
          type="checkbox"
          checked={settings.detection.autoCapture}
          onChange={(e) => updateSetting('detection', 'autoCapture', e.target.checked)}
          className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
        />
      </label>

      <label className="flex items-center justify-between">
        <div>
          <div className="font-medium">Estabilización</div>
          <div className="text-sm text-gray-600">Suavizar predicciones para mayor estabilidad</div>
        </div>
        <input
          type="checkbox"
          checked={settings.detection.stabilization}
          onChange={(e) => updateSetting('detection', 'stabilization', e.target.checked)}
          className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
        />
      </label>
    </div>
  );

  const renderPrivacySettings = () => (
    <div className="space-y-6">
      <div className="p-4 bg-pink-50 rounded-xl border border-pink-200">
        <h3 className="font-semibold text-pink-800 mb-2 flex items-center gap-2">
          <FiShield className="text-pink-600" />
          Privacidad y Datos
        </h3>
        <p className="text-sm text-pink-700">
          Controla cómo se manejan tus datos y configuraciones de privacidad
        </p>
      </div>

      <div className="space-y-4">
        <label className="flex items-center justify-between">
          <div>
            <div className="font-medium">Guardar Detecciones</div>
            <div className="text-sm text-gray-600">Almacenar historial de predicciones localmente</div>
          </div>
          <input
            type="checkbox"
            checked={settings.privacy.saveDetections}
            onChange={(e) => updateSetting('privacy', 'saveDetections', e.target.checked)}
            className="w-5 h-5 text-pink-500 rounded focus:ring-pink-500"
          />
        </label>

        <label className="flex items-center justify-between">
          <div>
            <div className="font-medium">Compartir Analíticas</div>
            <div className="text-sm text-gray-600">Ayudar a mejorar el sistema (anónimo)</div>
          </div>
          <input
            type="checkbox"
            checked={settings.privacy.shareAnalytics}
            onChange={(e) => updateSetting('privacy', 'shareAnalytics', e.target.checked)}
            className="w-5 h-5 text-pink-500 rounded focus:ring-pink-500"
          />
        </label>

        <label className="flex items-center justify-between">
          <div>
            <div className="font-medium">Almacenamiento Local</div>
            <div className="text-sm text-gray-600">Guardar configuraciones en el navegador</div>
          </div>
          <input
            type="checkbox"
            checked={settings.privacy.localStorage}
            onChange={(e) => updateSetting('privacy', 'localStorage', e.target.checked)}
            className="w-5 h-5 text-pink-500 rounded focus:ring-pink-500"
          />
        </label>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Retención de Datos: {settings.privacy.dataRetention} días
          </label>
          <input
            type="range"
            min="1"
            max="90"
            step="1"
            value={settings.privacy.dataRetention}
            onChange={(e) => updateSetting('privacy', 'dataRetention', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-pink"
          />
          <div className="text-sm text-gray-600 mt-1">
            Los datos se eliminarán automáticamente después de este período
          </div>
        </div>
      </div>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={cleanLocalData}
        className="w-full bg-red-500 text-white py-3 px-4 rounded-lg hover:bg-red-600 transition-colors font-semibold flex items-center justify-center gap-2"
      >
        <FiTrash2 />
        Limpiar Datos Locales
      </motion.button>
    </div>
  );

  const renderAdvancedSettings = () => (
    <div className="space-y-6">
      <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-200">
        <h3 className="font-semibold text-yellow-800 mb-2 flex items-center gap-2">
          <FiInfo className="text-yellow-600" />
          Configuración Avanzada
        </h3>
        <p className="text-sm text-yellow-700">
          Estas opciones son para usuarios experimentados. Cambiarlas puede afectar el rendimiento.
        </p>
      </div>

      <div className="space-y-4">
        <label className="flex items-center justify-between">
          <div>
            <div className="font-medium">Modo Debug</div>
            <div className="text-sm text-gray-600">Mostrar información de depuración en consola</div>
          </div>
          <input
            type="checkbox"
            checked={settings.advanced.debugMode}
            onChange={(e) => updateSetting('advanced', 'debugMode', e.target.checked)}
            className="w-5 h-5 text-gray-500 rounded focus:ring-gray-500"
          />
        </label>

        <label className="flex items-center justify-between">
          <div>
            <div className="font-medium">Modo Rendimiento</div>
            <div className="text-sm text-gray-600">Optimizar para velocidad sobre precisión</div>
          </div>
          <input
            type="checkbox"
            checked={settings.advanced.performanceMode}
            onChange={(e) => updateSetting('advanced', 'performanceMode', e.target.checked)}
            className="w-5 h-5 text-gray-500 rounded focus:ring-gray-500"
          />
        </label>

        <label className="flex items-center justify-between">
          <div>
            <div className="font-medium">Caché de Modelos</div>
            <div className="text-sm text-gray-600">Mantener modelos en memoria</div>
          </div>
          <input
            type="checkbox"
            checked={settings.advanced.modelCaching}
            onChange={(e) => updateSetting('advanced', 'modelCaching', e.target.checked)}
            className="w-5 h-5 text-gray-500 rounded focus:ring-gray-500"
          />
        </label>

        <label className="flex items-center justify-between">
          <div>
            <div className="font-medium">Aceleración GPU</div>
            <div className="text-sm text-gray-600">Usar GPU para procesamiento (si está disponible)</div>
          </div>
          <input
            type="checkbox"
            checked={settings.advanced.gpuAcceleration}
            onChange={(e) => updateSetting('advanced', 'gpuAcceleration', e.target.checked)}
            className="w-5 h-5 text-gray-500 rounded focus:ring-gray-500"
          />
        </label>

        <label className="flex items-center justify-between">
          <div>
            <div className="font-medium">Funciones Experimentales</div>
            <div className="text-sm text-gray-600">Habilitar características en desarrollo</div>
          </div>
          <input
            type="checkbox"
            checked={settings.advanced.experimentalFeatures}
            onChange={(e) => updateSetting('advanced', 'experimentalFeatures', e.target.checked)}
            className="w-5 h-5 text-gray-500 rounded focus:ring-gray-500"
          />
        </label>
      </div>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={runPerformanceTest}
        className="w-full bg-blue-500 text-white py-3 px-4 rounded-lg hover:bg-blue-600 transition-colors font-semibold flex items-center justify-center gap-2"
      >
        <FiZap />
        Ejecutar Prueba de Rendimiento
      </motion.button>

      <div className="p-4 bg-red-50 rounded-xl border border-red-200">
        <h4 className="font-semibold text-red-800 mb-2">Zona de Peligro</h4>
        <p className="text-sm text-red-700 mb-3">
          Estas acciones no se pueden deshacer
        </p>
        <div className="grid grid-cols-2 gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={clearCache}
            className="bg-red-500 text-white py-2 px-3 rounded-lg hover:bg-red-600 transition-colors text-sm"
          >
            Limpiar Caché
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={resetSettings}
            className="bg-red-600 text-white py-2 px-3 rounded-lg hover:bg-red-700 transition-colors text-sm"
          >
            Reset Total
          </motion.button>
        </div>
      </div>
    </div>
  );

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'appearance':
        return renderAppearanceSettings();
      case 'audio':
        return renderAudioSettings();
      case 'camera':
        return renderCameraSettings();
      case 'detection':
        return renderDetectionSettings();
      case 'privacy':
        return renderPrivacySettings();
      case 'advanced':
        return renderAdvancedSettings();
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="text-center">
        <motion.h2
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-bold bg-gradient-to-r from-gray-500 to-gray-600 bg-clip-text text-transparent mb-3"
        >
          Configuración
        </motion.h2>
        <p className="text-gray-600 text-lg">
          Personaliza tu experiencia con SignFlow AI
        </p>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">
        <motion.nav
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-1"
        >
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Secciones</h3>
            <div className="space-y-2">
              {sections.map((section, index) => (
                <motion.button
                  key={section.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all ${
                    activeSection === section.id
                      ? `bg-gradient-to-r ${section.color} text-white shadow-lg`
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <section.icon className="text-lg" />
                  {section.name}
                </motion.button>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200 space-y-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={saveSettings}
                disabled={!isDirty}
                className={`w-full py-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                  isDirty
                    ? 'bg-green-500 text-white hover:bg-green-600 shadow-lg'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                <FiSave />
                {isDirty ? 'Guardar Cambios' : 'Guardado'}
              </motion.button>

              <div className="grid grid-cols-2 gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={exportSettings}
                  className="bg-blue-500 text-white py-2 px-3 rounded-lg hover:bg-blue-600 transition-colors text-sm flex items-center justify-center gap-1"
                >
                  <FiDownload />
                  Exportar
                </motion.button>

                <label className="bg-purple-500 text-white py-2 px-3 rounded-lg hover:bg-purple-600 transition-colors text-sm flex items-center justify-center gap-1 cursor-pointer">
                  <FiUpload />
                  Importar
                  <input
                    type="file"
                    accept=".json"
                    onChange={importSettings}
                    className="hidden"
                  />
                </label>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={resetSettings}
                className="w-full bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors font-semibold flex items-center justify-center gap-2 text-sm"
              >
                <FiRotateCcw />
                Restablecer
              </motion.button>
            </div>
          </div>

          {isDirty && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
            >
              <div className="flex items-center gap-2 text-yellow-800 text-sm">
                <FiInfo />
                <span>Tienes cambios sin guardar</span>
              </div>
            </motion.div>
          )}
        </motion.nav>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-3"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8"
            >
              <div className="flex items-center gap-3 mb-6">
                {React.createElement(sections.find(s => s.id === activeSection)?.icon || FiSettings, {
                  className: `text-3xl bg-gradient-to-r ${sections.find(s => s.id === activeSection)?.color} bg-clip-text text-transparent`
                })}
                <h3 className="text-2xl font-bold text-gray-800">
                  {sections.find(s => s.id === activeSection)?.name}
                </h3>
              </div>

              {renderActiveSection()}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default Settings;