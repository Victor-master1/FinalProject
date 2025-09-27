const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class ModelStorage {
  constructor() {
    this.modelsDir = path.join(__dirname, '..', 'data', 'models');
    this.init();
  }

  async init() {
    try {
      await fs.mkdir(this.modelsDir, { recursive: true });
    } catch (error) {
      console.error('Error creating models directory:', error);
    }
  }

  async saveModel(modelData) {
    const modelId = uuidv4();
    const model = {
      id: modelId,
      ...modelData,
      createdAt: new Date().toISOString(),
      samples: modelData.samples || [],
      practiceStats: {
        totalPracticeSessions: 0,
        averagePracticeAccuracy: 0,
        signsPracticed: []
      }
    };

    const filePath = path.join(this.modelsDir, `${modelId}.json`);
    await fs.writeFile(filePath, JSON.stringify(model, null, 2));
    return model;
  }

  async getModel(modelId) {
    try {
      const filePath = path.join(this.modelsDir, `${modelId}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  async getAllModels() {
    try {
      const files = await fs.readdir(this.modelsDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      const models = await Promise.all(
        jsonFiles.map(async (file) => {
          const filePath = path.join(this.modelsDir, file);
          const data = await fs.readFile(filePath, 'utf-8');
          return JSON.parse(data);
        })
      );

      return models.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (error) {
      return [];
    }
  }

  async updateModel(modelId, updateData) {
    const model = await this.getModel(modelId);
    if (!model) return null;

    const updatedModel = {
      ...model,
      ...updateData,
      updatedAt: new Date().toISOString()
    };

    const filePath = path.join(this.modelsDir, `${modelId}.json`);
    await fs.writeFile(filePath, JSON.stringify(updatedModel, null, 2));
    return updatedModel;
  }

  async deleteModel(modelId) {
    try {
      const filePath = path.join(this.modelsDir, `${modelId}.json`);
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  async addSamplesToModel(modelId, newSamples) {
    const model = await this.getModel(modelId);
    if (!model) return null;

    const existingSamples = model.samples || [];
    const updatedSamples = [...existingSamples, ...newSamples];

    return await this.updateModel(modelId, { samples: updatedSamples });
  }

  async updatePracticeStats(modelId, practiceData) {
    const model = await this.getModel(modelId);
    if (!model) return null;

    const currentStats = model.practiceStats || {
      totalPracticeSessions: 0,
      averagePracticeAccuracy: 0,
      signsPracticed: []
    };

    const updatedStats = {
      totalPracticeSessions: currentStats.totalPracticeSessions + 1,
      averagePracticeAccuracy: (currentStats.averagePracticeAccuracy * currentStats.totalPracticeSessions + practiceData.accuracy) / (currentStats.totalPracticeSessions + 1),
      signsPracticed: [...new Set([...currentStats.signsPracticed, practiceData.sign])]
    };

    return await this.updateModel(modelId, { practiceStats: updatedStats });
  }
}

module.exports = new ModelStorage();