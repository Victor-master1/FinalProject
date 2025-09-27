const express = require('express');
const ModelStorage = require('../models');
const { predictSign } = require('../utils/preprocessing');
const { generateResponse } = require('../utils/nlp');
const router = express.Router();

router.post('/predict', async (req, res) => {
  try {
    const { modelId, landmarks, settings } = req.body;

    if (!modelId || !landmarks || landmarks.length !== 21) {
      return res.status(400).json({ error: 'Invalid prediction data' });
    }

    const model = await ModelStorage.getModel(modelId);
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }

    if (!model.classifier) {
      return res.status(400).json({ error: 'Model not trained yet' });
    }

    const modelSettings = { ...model.settings?.detection, ...settings };
    
    console.log(`Predicting for model ${modelId} with ${landmarks.length} landmarks`);
    
    const prediction = predictSign(model, landmarks, modelSettings);
    
    console.log(`Prediction result: ${prediction.sign} with confidence ${prediction.confidence}`);

    res.json({
      prediction: prediction.sign,
      confidence: prediction.confidence,
      modelId,
      timestamp: new Date().toISOString(),
      settings: modelSettings,
      allPredictions: prediction.allPredictions || {}
    });

  } catch (error) {
    console.error('Prediction error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/practice-predict', async (req, res) => {
  try {
    const { modelId, landmarks, expectedSign, settings } = req.body;

    if (!modelId || !landmarks || landmarks.length !== 21 || !expectedSign) {
      return res.status(400).json({ error: 'Invalid practice prediction data' });
    }

    const model = await ModelStorage.getModel(modelId);
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }

    if (!model.classifier) {
      return res.status(400).json({ error: 'Model not trained yet' });
    }

    const modelSettings = { 
      confidenceThreshold: 0.6,
      ...model.settings?.detection, 
      ...settings 
    };
    
    const prediction = predictSign(model, landmarks, modelSettings);
    
    const isCorrect = prediction.sign === expectedSign && prediction.confidence >= 0.7;
    const isPartiallyCorrect = prediction.sign === expectedSign && prediction.confidence >= 0.5;
    
    let feedback = {
      prediction: prediction.sign,
      confidence: prediction.confidence,
      expectedSign,
      isCorrect,
      isPartiallyCorrect,
      timestamp: new Date().toISOString()
    };

    if (isCorrect) {
      feedback.status = 'success';
      feedback.message = '¡Perfecto! Seña realizada correctamente';
      feedback.color = 'green';
      feedback.icon = 'check';
    } else if (isPartiallyCorrect) {
      feedback.status = 'partial';
      feedback.message = `Seña correcta pero mejora la precisión (${(prediction.confidence * 100).toFixed(0)}%)`;
      feedback.color = 'orange';
      feedback.icon = 'warning';
    } else if (prediction.confidence >= 0.4) {
      feedback.status = 'incorrect';
      feedback.message = `Detecté "${prediction.sign}" en lugar de "${expectedSign}"`;
      feedback.color = 'red';
      feedback.icon = 'x';
    } else {
      feedback.status = 'unclear';
      feedback.message = 'Seña no clara. Mantén tu mano visible y estable';
      feedback.color = 'gray';
      feedback.icon = 'eye-off';
    }

    res.json(feedback);

  } catch (error) {
    console.error('Practice prediction error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/batch-predict', async (req, res) => {
  try {
    const { modelId, landmarksList, settings } = req.body;

    if (!modelId || !Array.isArray(landmarksList)) {
      return res.status(400).json({ error: 'Invalid batch prediction data' });
    }

    const model = await ModelStorage.getModel(modelId);
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }

    if (!model.classifier) {
      return res.status(400).json({ error: 'Model not trained yet' });
    }

    const modelSettings = { ...model.settings?.detection, ...settings };

    const predictions = landmarksList.map(landmarks => {
      if (landmarks.length !== 21) {
        return { error: 'Invalid landmarks length' };
      }
      return predictSign(model, landmarks, modelSettings);
    });

    res.json({
      predictions,
      modelId,
      timestamp: new Date().toISOString(),
      total: predictions.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/generate-response', async (req, res) => {
  try {
    const { text, context } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const response = await generateResponse(text, context);

    res.json({
      response,
      originalText: text,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;