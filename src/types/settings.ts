export interface AppearanceSettings {
  theme: 'light' | 'dark' | 'auto';
  animations: boolean;
  compactMode: boolean;
  highContrast: boolean;
  fontSize: 'small' | 'medium' | 'large' | 'extra-large';
  borderRadius: 'none' | 'small' | 'normal' | 'large';
}

export interface AudioSettings {
  enabled: boolean;
  volume: number;
  voice: string;
  rate: number;
  pitch: number;
  autoSpeak: boolean;
  soundEffects: boolean;
}

export interface CameraSettings {
  resolution: string;
  frameRate: number;
  mirror: boolean;
  brightness: number;
  contrast: number;
  autoFocus: boolean;
}

export interface DetectionSettings {
  confidenceThreshold: number;
  predictionDelay: number;
  maxPredictions: number;
  autoCapture: boolean;
  stabilization: boolean;
}

export interface PrivacySettings {
  saveDetections: boolean;
  shareAnalytics: boolean;
  localStorage: boolean;
  dataRetention: number;
}

export interface AdvancedSettings {
  debugMode: boolean;
  performanceMode: boolean;
  modelCaching: boolean;
  gpuAcceleration: boolean;
  experimentalFeatures: boolean;
}

export interface AllSettings {
  appearance: AppearanceSettings;
  audio: AudioSettings;
  camera: CameraSettings;
  detection: DetectionSettings;
  privacy: PrivacySettings;
  advanced: AdvancedSettings;
}