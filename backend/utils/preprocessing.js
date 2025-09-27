const { Matrix } = require('ml-matrix');
const brain = require('brain.js');

const preprocessLandmarks = (samples) => {
  const processedData = [];
  const labels = [];

  samples.forEach(sample => {
    if (sample.landmarks && sample.landmarks.length === 21) {
      const normalizedLandmarks = normalizeLandmarks(sample.landmarks);
      const features = extractFeatures(normalizedLandmarks);
      
      if (features.every(f => !isNaN(f) && isFinite(f))) {
        processedData.push(features);
        labels.push(sample.sign);
      }
    }
  });

  return { features: processedData, labels };
};

const normalizeLandmarks = (landmarks) => {
  const wrist = landmarks[0];
  
  const normalized = landmarks.map(point => ({
    x: point.x - wrist.x,
    y: point.y - wrist.y,
    z: point.z - wrist.z
  }));

  const distances = normalized.map(point =>
    Math.sqrt(point.x * point.x + point.y * point.y + point.z * point.z)
  );
  const maxDistance = Math.max(...distances.filter(d => d > 0));

  if (maxDistance === 0 || !isFinite(maxDistance)) {
    return normalized;
  }

  return normalized.map(point => ({
    x: point.x / maxDistance,
    y: point.y / maxDistance,
    z: point.z / maxDistance
  }));
};

const extractFeatures = (landmarks) => {
  const features = [];

  landmarks.forEach(point => {
    features.push(point.x, point.y, point.z);
  });

  const fingerTips = [4, 8, 12, 16, 20];
  const fingerBases = [2, 5, 9, 13, 17];

  for (let i = 0; i < fingerTips.length; i++) {
    const tip = landmarks[fingerTips[i]];
    const base = landmarks[fingerBases[i]];
    const distance = euclideanDistance(
      [tip.x, tip.y, tip.z],
      [base.x, base.y, base.z]
    );
    features.push(distance);
  }

  const palmPoints = [0, 1, 5, 9, 13, 17];
  for (let i = 0; i < palmPoints.length; i++) {
    for (let j = i + 1; j < palmPoints.length; j++) {
      const p1 = landmarks[palmPoints[i]];
      const p2 = landmarks[palmPoints[j]];
      const distance = euclideanDistance(
        [p1.x, p1.y, p1.z],
        [p2.x, p2.y, p2.z]
      );
      features.push(distance);
    }
  }

  const angles = [];
  for (let i = 1; i < landmarks.length; i++) {
    if (i + 1 < landmarks.length) {
      const p1 = landmarks[i - 1];
      const p2 = landmarks[i];
      const p3 = landmarks[i + 1];
      
      const angle = calculateAngle(p1, p2, p3);
      angles.push(angle);
    }
  }
  
  features.push(...angles);

  return features.filter(f => !isNaN(f) && isFinite(f));
};

const calculateAngle = (p1, p2, p3) => {
  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y, z: p1.z - p2.z };
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y, z: p3.z - p2.z };

  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);

  if (mag1 === 0 || mag2 === 0) return 0;

  const cosAngle = dot / (mag1 * mag2);
  const clampedCos = Math.max(-1, Math.min(1, cosAngle));
  
  return Math.acos(clampedCos);
};

const trainClassifier = (data) => {
  const { features, labels } = data;

  if (features.length === 0) {
    throw new Error('No training data available');
  }

  const uniqueLabels = [...new Set(labels)];
  if (uniqueLabels.length < 2) {
    throw new Error('Need at least 2 different signs to train');
  }

  console.log(`Training with ${features.length} samples and ${uniqueLabels.length} unique signs`);

  const trainingData = features.map((feature, index) => ({
    input: feature,
    output: { [labels[index]]: 1 }
  }));

  const net = new brain.NeuralNetwork({
    hiddenLayers: [128, 64, 32],
    activation: 'sigmoid',
    learningRate: 0.1,
    momentum: 0.1,
    dropout: 0.1
  });

  console.log('Starting neural network training...');

  const stats = net.train(trainingData, {
    iterations: 3000,
    errorThresh: 0.003,
    log: true,
    logPeriod: 100,
    learningRate: 0.1,
    momentum: 0.1,
    callback: (stats) => {
      console.log(`Training progress: ${stats.iterations} iterations, error: ${stats.error}`);
    }
  });

  console.log('Training completed with stats:', stats);

  return {
    type: 'neural_network',
    network: net.toJSON(),
    uniqueLabels,
    trained: true,
    timestamp: new Date().toISOString(),
    stats,
    featureLength: features[0].length
  };
};

const predictSign = (model, landmarks, settings = {}) => {
  if (!model.classifier || !model.classifier.network) {
    console.log('No classifier found in model');
    return { sign: 'UNKNOWN', confidence: 0 };
  }

  try {
    console.log('Loading neural network for prediction...');
    const net = new brain.NeuralNetwork();
    net.fromJSON(model.classifier.network);

    console.log('Processing landmarks...');
    const normalizedLandmarks = normalizeLandmarks(landmarks);
    const features = extractFeatures(normalizedLandmarks);

    console.log(`Extracted ${features.length} features`);

    if (features.length === 0 || features.some(f => isNaN(f) || !isFinite(f))) {
      console.log('Invalid features extracted');
      return { sign: 'INVALID', confidence: 0 };
    }

    console.log('Running prediction...');
    const prediction = net.run(features);

    let maxConfidence = 0;
    let predictedSign = 'UNKNOWN';

    Object.keys(prediction).forEach(sign => {
      console.log(`Sign: ${sign}, Confidence: ${prediction[sign]}`);
      if (prediction[sign] > maxConfidence) {
        maxConfidence = prediction[sign];
        predictedSign = sign;
      }
    });

    const confidenceThreshold = settings.confidenceThreshold || 0.7;
    
    if (maxConfidence < confidenceThreshold * 0.5) {
      predictedSign = 'UNCERTAIN';
      maxConfidence *= 0.5;
    }

    console.log(`Final prediction: ${predictedSign} with confidence ${maxConfidence}`);

    return {
      sign: predictedSign,
      confidence: Math.min(0.99, Math.max(0.01, maxConfidence)),
      allPredictions: prediction
    };

  } catch (error) {
    console.error('Prediction error:', error);
    return { sign: 'ERROR', confidence: 0 };
  }
};

const euclideanDistance = (a, b) => {
  if (a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.pow(a[i] - b[i], 2);
  }
  return Math.sqrt(sum);
};

module.exports = {
  preprocessLandmarks,
  trainClassifier,
  predictSign,
  euclideanDistance,
  normalizeLandmarks,
  extractFeatures
};