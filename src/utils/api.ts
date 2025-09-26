import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export const practiceApi = {
  predictPractice: async (modelId: string, landmarks: any[], expectedSign: string, settings?: any) => {
    return api.post('/prediction/practice-predict', {
      modelId,
      landmarks,
      expectedSign,
      settings
    });
  },
  
  updatePracticeProgress: async (modelId: string, sign: string, action: string, correct?: boolean, attempts?: number) => {
    return api.post('/learning/progress', {
      modelId,
      sign,
      action,
      correct,
      attempts
    });
  }
};