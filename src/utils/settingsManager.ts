export class SettingsManager {
  private static instance: SettingsManager;
  private settings: any = {};
  private listeners: Array<(settings: any) => void> = [];

  private constructor() {
    this.loadSettings();
    this.setupAutoSave();
  }

  static getInstance(): SettingsManager {
    if (!SettingsManager.instance) {
      SettingsManager.instance = new SettingsManager();
    }
    return SettingsManager.instance;
  }

  private loadSettings() {
    try {
      const stored = localStorage.getItem('signflow-settings');
      if (stored) {
        this.settings = JSON.parse(stored);
        this.applyStoredSettings();
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  private setupAutoSave() {
    setInterval(() => {
      this.save();
    }, 30000);
  }

  private applyStoredSettings() {
    if (this.settings.appearance) {
      this.applyAppearanceSettings();
    }
  }

  private applyAppearanceSettings() {
    const root = document.documentElement;
    const body = document.body;

    if (this.settings.appearance.fontSize) {
      root.style.fontSize = this.getFontSizeValue(this.settings.appearance.fontSize);
    }

    if (this.settings.appearance.borderRadius) {
      root.style.setProperty('--border-radius-base', this.getBorderRadiusValue(this.settings.appearance.borderRadius));
    }

    body.classList.remove('high-contrast', 'compact-mode', 'no-animations');

    if (this.settings.appearance.highContrast) {
      body.classList.add('high-contrast');
    }

    if (this.settings.appearance.compactMode) {
      body.classList.add('compact-mode');
    }

    if (!this.settings.appearance.animations) {
      body.classList.add('no-animations');
    }
  }

  private getFontSizeValue(size: string) {
    const sizes = {
      'small': '14px',
      'medium': '16px', 
      'large': '18px',
      'extra-large': '20px'
    };
    return sizes[size as keyof typeof sizes] || sizes.medium;
  }

  private getBorderRadiusValue(radius: string) {
    const radiuses = {
      'none': '0px',
      'small': '4px',
      'normal': '8px', 
      'large': '16px'
    };
    return radiuses[radius as keyof typeof radiuses] || radiuses.normal;
  }

  get(key: string, defaultValue?: any) {
    const keys = key.split('.');
    let value = this.settings;

    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) {
        return defaultValue;
      }
    }

    return value;
  }

  set(key: string, value: any) {
    const keys = key.split('.');
    let current = this.settings;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
    this.save();
    this.notifyListeners();
    this.applyStoredSettings();
  }

  private save() {
    try {
      localStorage.setItem('signflow-settings', JSON.stringify(this.settings));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  subscribe(listener: (settings: any) => void) {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.settings));
  }

  reset() {
    this.settings = {};
    localStorage.removeItem('signflow-settings');
    document.body.className = '';
    document.documentElement.style.fontSize = '';
    document.documentElement.style.setProperty('--border-radius-base', '');
    this.notifyListeners();
  }

  export() {
    return JSON.stringify(this.settings, null, 2);
  }

  import(settingsJson: string) {
    try {
      const imported = JSON.parse(settingsJson);
      this.settings = imported;
      this.save();
      this.applyStoredSettings();
      this.notifyListeners();
      return true;
    } catch (error) {
      console.error('Error importing settings:', error);
      return false;
    }
  }

  applySettings(settings: any) {
    this.settings = { ...this.settings, ...settings };
    this.applyStoredSettings();
    this.save();
    this.notifyListeners();
  }

  getAudioSettings() {
    return this.get('audio', {
      enabled: true,
      volume: 0.8,
      voice: '',
      rate: 1,
      pitch: 1,
      autoSpeak: false,
      soundEffects: true
    });
  }

  getCameraSettings() {
    return this.get('camera', {
      resolution: '640x480',
      frameRate: 30,
      mirror: true,
      brightness: 0,
      contrast: 0,
      autoFocus: true
    });
  }

  getDetectionSettings() {
    return this.get('detection', {
      confidenceThreshold: 0.7,
      predictionDelay: 500,
      maxPredictions: 10,
      autoCapture: true,
      stabilization: true
    });
  }

  getPrivacySettings() {
    return this.get('privacy', {
      saveDetections: true,
      shareAnalytics: false,
      localStorage: true,
      dataRetention: 30
    });
  }

  getAdvancedSettings() {
    return this.get('advanced', {
      debugMode: false,
      performanceMode: false,
      modelCaching: true,
      gpuAcceleration: true,
      experimentalFeatures: false
    });
  }
}

export const settingsManager = SettingsManager.getInstance();