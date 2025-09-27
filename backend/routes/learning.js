const express = require('express');
const ModelStorage = require('../models');
const path = require('path');
const fs = require('fs').promises;
const router = express.Router();

class LearningStorage {
  constructor() {
    this.learningDir = path.join(__dirname, '..', 'data', 'learning');
    this.init();
  }

  async init() {
    try {
      await fs.mkdir(this.learningDir, { recursive: true });
    } catch (error) {
      console.error('Error creating learning directory:', error);
    }
  }

  async getProgress(modelId) {
    try {
      const filePath = path.join(this.learningDir, `${modelId}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return {
        modelId,
        signProgress: {},
        totalProgress: 0,
        completedSigns: 0,
        studyTime: 0,
        lastStudied: null
      };
    }
  }

  async updateProgress(modelId, signProgress) {
    const progress = await this.getProgress(modelId);
    const model = await ModelStorage.getModel(modelId);
    if (!model) return null;

    progress.signProgress = { ...progress.signProgress, ...signProgress };
    progress.completedSigns = Object.values(progress.signProgress).filter(p => p.mastered).length;
    progress.totalProgress = Math.round((progress.completedSigns / model.signs.length) * 100);
    progress.lastStudied = new Date().toISOString();

    const filePath = path.join(this.learningDir, `${modelId}.json`);
    await fs.writeFile(filePath, JSON.stringify(progress, null, 2));
    return progress;
  }
}

const learningStorage = new LearningStorage();

router.get('/stats/:modelId', async (req, res) => {
  try {
    const progress = await learningStorage.getProgress(req.params.modelId);
    const model = await ModelStorage.getModel(req.params.modelId);
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }

    const signStats = model.signs.map(sign => ({
      sign,
      progress: progress.signProgress[sign] || {
        viewed: 0,
        correct: 0,
        incorrect: 0,
        mastered: false,
        lastStudied: null,
        practiceAttempts: 0,
        practiceSuccess: 0,
        practiceAccuracy: 0
      }
    }));

    res.json({
      ...progress,
      totalSigns: model.signs.length,
      signStats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/progress', async (req, res) => {
  try {
    const { modelId, sign, action, correct, time, attempts } = req.body;

    if (!modelId || !sign || !action) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const progress = await learningStorage.getProgress(modelId);
    
    if (!progress.signProgress[sign]) {
      progress.signProgress[sign] = {
        viewed: 0,
        correct: 0,
        incorrect: 0,
        mastered: false,
        lastStudied: null,
        studyTime: 0,
        practiceAttempts: 0,
        practiceSuccess: 0,
        practiceAccuracy: 0
      };
    }

    const signProgress = progress.signProgress[sign];

    switch (action) {
      case 'view':
        signProgress.viewed++;
        break;
        
      case 'quiz':
        if (correct) {
          signProgress.correct++;
          if (signProgress.correct >= 5 && signProgress.correct > signProgress.incorrect * 2) {
            signProgress.mastered = true;
          }
        } else {
          signProgress.incorrect++;
          signProgress.mastered = false;
        }
        break;
        
      case 'study':
        signProgress.studyTime += time || 30;
        break;
        
      case 'practice_start':
        break;
        
      case 'practice_complete':
        signProgress.practiceAttempts += attempts || 1;
        if (correct) {
          signProgress.practiceSuccess += 1;
        }
        signProgress.practiceAccuracy = signProgress.practiceAttempts > 0 
          ? (signProgress.practiceSuccess / signProgress.practiceAttempts) * 100 
          : 0;
        
        if (signProgress.practiceAccuracy >= 80 && signProgress.practiceAttempts >= 5) {
          signProgress.mastered = true;
        }
        break;
        
      case 'practice_attempt':
        signProgress.practiceAttempts += 1;
        if (correct) {
          signProgress.practiceSuccess += 1;
        }
        signProgress.practiceAccuracy = signProgress.practiceAttempts > 0 
          ? (signProgress.practiceSuccess / signProgress.practiceAttempts) * 100 
          : 0;
        break;
    }

    signProgress.lastStudied = new Date().toISOString();

    const updatedProgress = await learningStorage.updateProgress(modelId, {
      [sign]: signProgress
    });

    res.json(updatedProgress);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/leaderboard', async (req, res) => {
  try {
    const models = await ModelStorage.getAllModels();
    const leaderboard = [];

    for (const model of models) {
      const progress = await learningStorage.getProgress(model.id);
      leaderboard.push({
        modelName: model.name,
        totalProgress: progress.totalProgress,
        completedSigns: progress.completedSigns,
        totalSigns: model.signs.length,
        studyTime: progress.studyTime || 0
      });
    }

    leaderboard.sort((a, b) => b.totalProgress - a.totalProgress);
    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/practice-feedback', async (req, res) => {
  try {
    const { modelId, sign, prediction, confidence, expectedSign } = req.body;
    
    if (!modelId || !sign || !prediction || confidence === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const isCorrect = prediction === expectedSign && confidence >= 0.7;
    
    await req.body.updateProgress(modelId, sign, 'practice_attempt', isCorrect);

    let feedback = {
      correct: isCorrect,
      confidence,
      prediction,
      expectedSign
    };

    if (isCorrect) {
      feedback.message = '¡Excelente! Estás haciendo la seña correctamente.';
      feedback.color = 'green';
    } else if (prediction === expectedSign && confidence < 0.7) {
      feedback.message = `Seña correcta pero con baja confianza (${(confidence * 100).toFixed(0)}%). Mantén la posición más estable.`;
      feedback.color = 'orange';
    } else if (confidence >= 0.5) {
      feedback.message = `Detecté "${prediction}" pero esperaba "${expectedSign}". Revisa la posición de tu mano.`;
      feedback.color = 'red';
    } else {
      feedback.message = 'No puedo reconocer la seña claramente. Asegúrate de que tu mano esté bien visible.';
      feedback.color = 'gray';
    }

    res.json(feedback);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;