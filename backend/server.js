const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const modelsRouter = require('./routes/models');
const trainingRouter = require('./routes/training');
const predictionRouter = require('./routes/prediction');
const sessionsRouter = require('./routes/sessions');
const learningRouter = require('./routes/learning');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/json') {
      cb(null, true);
    } else {
      cb(new Error('Only JSON files are allowed'));
    }
  }
});

app.use('/api/models', modelsRouter);
app.use('/api/training', trainingRouter);
app.use('/api/prediction', predictionRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/learning', learningRouter);

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const data = await fs.readFile(filePath, 'utf-8');
    let jsonData;

    try {
      jsonData = JSON.parse(data);
    } catch (parseError) {
      await fs.unlink(filePath);
      return res.status(400).json({ error: 'Invalid JSON format' });
    }

    await fs.unlink(filePath);
    res.json({
      message: 'File processed successfully',
      data: jsonData
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    uptime: process.uptime(),
    features: {
      practiceMode: true,
      realTimeFeedback: true,
      progressTracking: true
    }
  });
});

app.get('/api/stats', async (req, res) => {
  try {
    const ModelsStorage = require('./models');
    const SessionsStorage = require('./models/sessions');
    const models = await ModelsStorage.getAllModels();
    const sessions = await SessionsStorage.getAllSessions();

    const stats = {
      totalModels: models.length,
      trainedModels: models.filter(m => m.classifier).length,
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => !s.completed).length,
      totalSamples: models.reduce((sum, m) => sum + (m.samples?.length || 0), 0),
      practiceSessions: models.reduce((sum, m) => sum + (m.practiceStats?.totalPracticeSessions || 0), 0)
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB' });
    }
  }

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📈 Statistics: http://localhost:${PORT}/api/stats`);
  console.log(`🎯 Practice mode enabled`);
});