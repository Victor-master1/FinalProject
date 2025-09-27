const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class SessionStorage {
  constructor() {
    this.sessionsDir = path.join(__dirname, '..', 'data', 'sessions');
    this.init();
  }

  async init() {
    try {
      await fs.mkdir(this.sessionsDir, { recursive: true });
    } catch (error) {
      console.error('Error creating sessions directory:', error);
    }
  }

  async createSession(sessionData) {
    const sessionId = uuidv4();
    const session = {
      id: sessionId,
      ...sessionData,
      createdAt: new Date().toISOString()
    };

    const filePath = path.join(this.sessionsDir, `${sessionId}.json`);
    await fs.writeFile(filePath, JSON.stringify(session, null, 2));

    return session;
  }

  async getSession(sessionId) {
    try {
      const filePath = path.join(this.sessionsDir, `${sessionId}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  async updateSession(sessionId, updateData) {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    const updatedSession = {
      ...session,
      ...updateData,
      updatedAt: new Date().toISOString()
    };

    const filePath = path.join(this.sessionsDir, `${sessionId}.json`);
    await fs.writeFile(filePath, JSON.stringify(updatedSession, null, 2));

    return updatedSession;
  }

  async getAllSessions() {
    try {
      const files = await fs.readdir(this.sessionsDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      const sessions = await Promise.all(
        jsonFiles.map(async (file) => {
          const filePath = path.join(this.sessionsDir, file);
          const data = await fs.readFile(filePath, 'utf-8');
          return JSON.parse(data);
        })
      );

      return sessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (error) {
      return [];
    }
  }

  async getSessionsByModel(modelId) {
    const sessions = await this.getAllSessions();
    return sessions.filter(session => session.modelId === modelId);
  }

  async deleteSession(sessionId) {
    try {
      const filePath = path.join(this.sessionsDir, `${sessionId}.json`);
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  async cleanOldSessions(daysOld = 30) {
    try {
      const sessions = await this.getAllSessions();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const oldSessions = sessions.filter(session => 
        new Date(session.createdAt) < cutoffDate
      );

      for (const session of oldSessions) {
        await this.deleteSession(session.id);
      }

      return oldSessions.length;
    } catch (error) {
      console.error('Error cleaning old sessions:', error);
      return 0;
    }
  }
}

module.exports = new SessionStorage();