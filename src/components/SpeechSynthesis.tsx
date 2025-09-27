import React, { useState, useEffect } from 'react';
import { settingsManager } from '../utils/settingsManager';

const SpeechSynthesis: React.FC = () => {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [settings, setSettings] = useState<any>({});

  useEffect(() => {
    if ('speechSynthesis' in window) {
      setIsSupported(true);
      loadVoices();
      speechSynthesis.addEventListener('voiceschanged', loadVoices);
    }

    const unsubscribe = settingsManager.subscribe((newSettings) => {
      setSettings(newSettings);
    });

    setSettings(JSON.parse(settingsManager.export() || '{}'));

    return () => {
      if ('speechSynthesis' in window) {
        speechSynthesis.removeEventListener('voiceschanged', loadVoices);
      }
      unsubscribe();
    };
  }, []);

  const loadVoices = () => {
    const availableVoices = speechSynthesis.getVoices();
    const spanishVoices = availableVoices.filter(voice =>
      voice.lang.startsWith('es') || voice.lang.startsWith('en')
    );
    setVoices(spanishVoices);
  };

  const speak = (text: string) => {
    if (!isSupported || !text || !settings.audio?.enabled) return;

    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = voices.find(v => v.name === settings.audio?.voice);

    if (voice) {
      utterance.voice = voice;
    }

    utterance.volume = settings.audio?.volume || 0.8;
    utterance.rate = settings.audio?.rate || 1;
    utterance.pitch = settings.audio?.pitch || 1;

    speechSynthesis.speak(utterance);
  };

  if (!isSupported) {
    return null;
  }

  return (
    <div className="hidden">
    </div>
  );
};

export default SpeechSynthesis;