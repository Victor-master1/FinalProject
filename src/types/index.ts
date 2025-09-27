export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface Sample {
  landmarks: Landmark[];
  sign: string;
  timestamp: number;
}

export interface Model {
  id: string;
  name: string;
  template: string;
  signs: string[];
  createdAt: string;
  trainedAt?: string;
  samples?: Sample[];
}

export interface TrainingProgress {
  epochs: number[];
  accuracy: number[];
  loss: number[];
  currentEpoch: number;
  isComplete: boolean;
}

export interface Prediction {
  sign: string;
  confidence: number;
  timestamp: number;
}

export interface VisualizationData {
  distribution: { [key: string]: number };
  landmarks: { [key: string]: Landmark[] };
  training?: TrainingProgress;
  accuracy: { [key: string]: number };
  totalSamples: number;
  uniqueSigns: number;
  averageAccuracy: number;
}