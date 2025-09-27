const express = require('express');
const ModelStorage = require('../models');
const SessionStorage = require('../models/sessions');
const router = express.Router();

router.post('/start', async (req, res) => {
  try {
    const { modelId, settings } = req.body;
    
    const model = await ModelStorage.getModel(modelId);
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }

    const session = await SessionStorage.createSession({
      modelId,
      settings: settings || {},
      startTime: new Date().toISOString(),
      predictions: [],
      stats: {
        totalPredictions: 0,
        avgConfidence: 0,
        highConfidencePredictions: 0,
        sessionDuration: 0
      }
    });

    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:sessionId/prediction', async (req, res) => {
  try {
    const { prediction, confidence } = req.body;
    const session = await SessionStorage.getSession(req.params.sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const newPrediction = {
      sign: prediction,
      confidence,
      timestamp: new Date().toISOString()
    };

    const updatedPredictions = [...session.predictions, newPrediction];
    const totalPredictions = updatedPredictions.length;
    const avgConfidence = updatedPredictions.reduce((sum, p) => sum + p.confidence, 0) / totalPredictions;
    const highConfidencePredictions = updatedPredictions.filter(p => p.confidence >= 0.7).length;
    const sessionDuration = Math.floor((Date.now() - new Date(session.startTime).getTime()) / 1000);

    const updatedSession = await SessionStorage.updateSession(req.params.sessionId, {
      predictions: updatedPredictions,
      stats: {
        totalPredictions,
        avgConfidence,
        highConfidencePredictions,
        sessionDuration
      }
    });

    res.json(updatedSession);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:sessionId', async (req, res) => {
  try {
    const session = await SessionStorage.getSession(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:sessionId/end', async (req, res) => {
  try {
    const { detectedText } = req.body;
    const session = await SessionStorage.getSession(req.params.sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const endTime = new Date().toISOString();
    const sessionDuration = Math.floor((new Date(endTime).getTime() - new Date(session.startTime).getTime()) / 1000);

    const finalSession = await SessionStorage.updateSession(req.params.sessionId, {
      endTime,
      detectedText,
      stats: {
        ...session.stats,
        sessionDuration
      },
      completed: true
    });

    res.json(finalSession);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/model/:modelId/history', async (req, res) => {
  try {
    const sessions = await SessionStorage.getSessionsByModel(req.params.modelId);
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;