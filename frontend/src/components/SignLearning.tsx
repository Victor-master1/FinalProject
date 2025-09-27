import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiBook, FiPlay, FiCheck, FiX, FiStar, FiTrendingUp, FiClock, FiTarget, FiAward, FiEye, FiZap, FiRefreshCw, FiUser, FiCamera, FiCameraOff } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { api } from '../utils/api';
import { MediaPipeHandler, createMediaPipeHandler } from '../utils/mediapipe';
import { Results } from '@mediapipe/hands';

interface SignLearningProps {
  models: any[];
}

const SignLearning: React.FC<SignLearningProps> = ({ models }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaPipeHandler = useRef<MediaPipeHandler | null>(null);
  const currentLandmarksRef = useRef<any[] | null>(null);
  const practiceIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [selectedModel, setSelectedModel] = useState<string>('');
  const [learningStats, setLearningStats] = useState<any>(null);
  const [currentSign, setCurrentSign] = useState<string>('');
  const [showQuiz, setShowQuiz] = useState<boolean>(false);
  const [quizOptions, setQuizOptions] = useState<string[]>([]);
  const [correctAnswer, setCorrectAnswer] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [studyMode, setStudyMode] = useState<'learn' | 'quiz' | 'practice' | 'review'>('learn');
  const [sessionTime, setSessionTime] = useState<number>(0);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [handsDetected, setHandsDetected] = useState<boolean>(false);
  const [practiceResult, setPracticeResult] = useState<any>(null);
  const [practiceAttempts, setPracticeAttempts] = useState<number>(0);
  const [practiceSuccess, setPracticeSuccess] = useState<number>(0);
  const [practiceConfidence, setPracticeConfidence] = useState<number>(0);
  const [practiceInProgress, setPracticeInProgress] = useState<boolean>(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (selectedModel && studyMode !== 'review') {
      interval = setInterval(() => {
        setSessionTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [selectedModel, studyMode]);

  useEffect(() => {
    if (selectedModel) {
      loadLearningStats();
    }
    loadLeaderboard();
  }, [selectedModel]);

  useEffect(() => {
    return () => {
      if (mediaPipeHandler.current) {
        mediaPipeHandler.current.stop();
      }
      if (practiceIntervalRef.current) {
        clearInterval(practiceIntervalRef.current);
      }
    };
  }, []);

  const onResults = useCallback((results: Results): void => {
    const hasHands = results.multiHandLandmarks && results.multiHandLandmarks.length > 0;
    setHandsDetected(hasHands);
    
    if (hasHands) {
      const landmarks = results.multiHandLandmarks[0];
      if (landmarks && landmarks.length === 21) {
        currentLandmarksRef.current = landmarks;
      }
    } else {
      currentLandmarksRef.current = null;
    }
  }, []);

  const checkPracticeSign = useCallback(async (): Promise<void> => {
    if (!practiceInProgress || !selectedModel || !currentSign || !currentLandmarksRef.current) {
      return;
    }

    try {
      const response = await api.post('/prediction/predict', {
        modelId: selectedModel,
        landmarks: currentLandmarksRef.current.map((l: any) => ({ x: l.x, y: l.y, z: l.z }))
      });

      const { prediction, confidence } = response.data;
      setPracticeConfidence(confidence);

      if (prediction === currentSign && confidence >= 0.7) {
        setPracticeResult({
          success: true,
          prediction,
          confidence,
          message: '¡Excelente! Estás haciendo la seña correctamente'
        });
        setPracticeSuccess(prev => prev + 1);
        
        setTimeout(() => {
          setPracticeResult(null);
        }, 2000);
      } else if (confidence >= 0.5) {
        setPracticeResult({
          success: false,
          prediction,
          confidence,
          message: `Detecté "${prediction}" pero esperaba "${currentSign}". Intenta de nuevo`
        });
      } else {
        setPracticeResult({
          success: false,
          prediction: 'INCIERTO',
          confidence,
          message: 'No puedo reconocer la seña claramente. Asegúrate de que tu mano esté bien visible'
        });
      }
      
      setPracticeAttempts(prev => prev + 1);
    } catch (error) {
      console.error('Error checking practice sign:', error);
    }
  }, [practiceInProgress, selectedModel, currentSign]);

  useEffect(() => {
    if (practiceInProgress && studyMode === 'practice') {
      practiceIntervalRef.current = setInterval(checkPracticeSign, 1000);
    } else if (practiceIntervalRef.current) {
      clearInterval(practiceIntervalRef.current);
      practiceIntervalRef.current = null;
    }

    return () => {
      if (practiceIntervalRef.current) {
        clearInterval(practiceIntervalRef.current);
        practiceIntervalRef.current = null;
      }
    };
  }, [practiceInProgress, studyMode, checkPracticeSign]);

  const loadLearningStats = async () => {
    if (!selectedModel) return;
    setLoading(true);
    try {
      const response = await api.get(`/learning/stats/${selectedModel}`);
      setLearningStats(response.data);
    } catch (error) {
      console.error('Error loading learning stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLeaderboard = async () => {
    try {
      const response = await api.get('/learning/leaderboard');
      setLeaderboard(response.data);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    }
  };

  const updateProgress = async (sign: string, action: string, correct?: boolean, time?: number) => {
    try {
      await api.post('/learning/progress', {
        modelId: selectedModel,
        sign,
        action,
        correct,
        time
      });
      await loadLearningStats();
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  };

  const startCamera = async (): Promise<void> => {
    console.log('Intentando iniciar cámara...');
    console.log('videoRef.current:', videoRef.current);
    console.log('canvasRef.current:', canvasRef.current);

    if (!videoRef.current || !canvasRef.current) {
      console.error('Referencias de video no disponibles');
      toast.error('Error: No se encontraron los elementos de video. Recarga la página.');
      return;
    }

    setIsInitializing(true);
    
    try {
      if (mediaPipeHandler.current) {
        mediaPipeHandler.current.stop();
      }
      
      mediaPipeHandler.current = createMediaPipeHandler();
      
      const success = await mediaPipeHandler.current.initialize(
        videoRef.current,
        canvasRef.current,
        onResults
      );
      
      if (success) {
        setCameraActive(true);
        toast.success('Cámara iniciada correctamente');
      } else {
        toast.error('Error al inicializar la cámara');
      }
    } catch (error) {
      console.error('Error starting camera:', error);
      toast.error('Error al acceder a la cámara. Verifica los permisos.');
    } finally {
      setIsInitializing(false);
    }
  };

  const stopCamera = (): void => {
    if (mediaPipeHandler.current) {
      mediaPipeHandler.current.stop();
      setCameraActive(false);
      setHandsDetected(false);
      setPracticeInProgress(false);
      currentLandmarksRef.current = null;
      toast.success('Cámara detenida');
    }
  };

  const startLearning = (sign: string) => {
    setCurrentSign(sign);
    setStudyMode('learn');
    updateProgress(sign, 'view');
  };

  const startPractice = (sign: string) => {
    if (!cameraActive) {
      toast.error('Primero inicia la cámara para practicar');
      return;
    }
    
    setCurrentSign(sign);
    setStudyMode('practice');
    setPracticeAttempts(0);
    setPracticeSuccess(0);
    setPracticeResult(null);
    setPracticeInProgress(true);
    updateProgress(sign, 'practice_start');
  };

  const stopPractice = async () => {
    setPracticeInProgress(false);
    
    if (practiceAttempts > 0) {
      const accuracy = (practiceSuccess / practiceAttempts) * 100;
      const isSuccessful = accuracy >= 70;
      
      await updateProgress(currentSign, 'practice_complete', isSuccessful, practiceAttempts);
      
      toast.success(`Práctica completada: ${practiceSuccess}/${practiceAttempts} intentos exitosos (${accuracy.toFixed(1)}%)`);
    }
    
    setCurrentSign('');
    setStudyMode('learn');
  };

  const startQuiz = (sign?: string) => {
    const model = models.find((m: any) => m.id === selectedModel);
    if (!model) return;

    const targetSign = sign || model.signs[Math.floor(Math.random() * model.signs.length)];
    const incorrectOptions = model.signs.filter((s: string) => s !== targetSign);
    const shuffledIncorrect = incorrectOptions.sort(() => 0.5 - Math.random()).slice(0, 3);
    const allOptions = [targetSign, ...shuffledIncorrect].sort(() => 0.5 - Math.random());

    setCurrentSign(targetSign);
    setCorrectAnswer(targetSign);
    setQuizOptions(allOptions);
    setShowQuiz(true);
    setStudyMode('quiz');
  };

  const handleQuizAnswer = async (selectedAnswer: string) => {
    const correct = selectedAnswer === correctAnswer;
    if (correct) {
      toast.success('¡Correcto!');
    } else {
      toast.error(`Incorrecto. La respuesta era: ${correctAnswer}`);
    }

    await updateProgress(currentSign, 'quiz', correct);
    setShowQuiz(false);
    setCurrentSign('');
  };

  const getSignProgress = (sign: string) => {
    if (!learningStats) return null;
    return learningStats.signStats.find((s: any) => s.sign === sign)?.progress;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const selectedModelData = models.find((m: any) => m.id === selectedModel);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="text-center">
        <motion.h2
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-bold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent mb-3"
        >
          Aprender Señas
        </motion.h2>
        <p className="text-gray-600 text-lg">
          Domina las señas de tus modelos con práctica interactiva en tiempo real
        </p>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-1 space-y-6"
        >
          <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
            <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FiBook className="text-indigo-500" />
              Seleccionar Modelo
            </h3>

            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all mb-4"
            >
              <option value="">Elige un modelo para estudiar</option>
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={cameraActive ? stopCamera : startCamera}
                disabled={isInitializing}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold transition-all ${
                  cameraActive
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                } disabled:opacity-50 shadow-lg text-sm`}
              >
                {isInitializing ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }}>
                    <FiCamera />
                  </motion.div>
                ) : cameraActive ? (
                  <>
                    <FiCameraOff />
                    Detener
                  </>
                ) : (
                  <>
                    <FiCamera />
                    Cámara
                  </>
                )}
              </motion.button>
              
              {cameraActive && (
                <div className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold ${
                  handsDetected 
                    ? 'bg-green-500 text-white' 
                    : 'bg-yellow-500 text-white'
                }`}>
                  {handsDetected ? (
                    <>
                      <FiCheck />
                      Detectado
                    </>
                  ) : (
                    <>
                      <FiEye />
                      Sin mano
                    </>
                  )}
                </div>
              )}
            </div>

            {cameraActive && studyMode === 'practice' && currentSign && (
              <div className="space-y-3">
                <div className={`p-4 rounded-xl border-2 ${
                  practiceResult?.success 
                    ? 'bg-green-50 border-green-200' 
                    : practiceResult
                      ? 'bg-red-50 border-red-200'
                      : 'bg-blue-50 border-blue-200'
                }`}>
                  <div className="text-center">
                    <div className="text-lg font-bold mb-2">Practicando: {currentSign}</div>
                    <div className="text-sm mb-2">
                      Intentos: {practiceSuccess}/{practiceAttempts}
                    </div>
                    <div className="text-sm mb-2">
                      Confianza: {(practiceConfidence * 100).toFixed(0)}%
                    </div>
                    {practiceResult && (
                      <div className={`text-sm font-medium ${
                        practiceResult.success ? 'text-green-700' : 'text-red-700'
                      }`}>
                        {practiceResult.message}
                      </div>
                    )}
                  </div>
                </div>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={stopPractice}
                  className="w-full bg-red-500 text-white py-3 px-4 rounded-xl hover:bg-red-600 transition-colors font-semibold"
                >
                  Terminar Práctica
                </motion.button>
              </div>
            )}

            {learningStats && (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-xl">
                  <h4 className="font-semibold text-indigo-800 mb-3">Progreso General</h4>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Completado</span>
                        <span>{learningStats.totalProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-gradient-to-r from-indigo-500 to-purple-500 h-3 rounded-full transition-all duration-500"
                          style={{ width: `${learningStats.totalProgress}%` }}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="text-center p-2 bg-green-50 rounded-lg">
                        <div className="font-bold text-green-600">{learningStats.completedSigns}</div>
                        <div className="text-green-800">Dominadas</div>
                      </div>
                      <div className="text-center p-2 bg-blue-50 rounded-lg">
                        <div className="font-bold text-blue-600">{learningStats.totalSigns}</div>
                        <div className="text-blue-800">Total</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Tiempo de sesión</span>
                    <span className="font-mono text-indigo-600">{formatTime(sessionTime)}</span>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setStudyMode('learn')}
                      className={`p-3 rounded-lg font-semibold text-sm transition-all ${
                        studyMode === 'learn'
                          ? 'bg-indigo-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <FiBook className="mx-auto mb-1" />
                      Aprender
                    </motion.button>
                    
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setStudyMode('practice')}
                      disabled={!cameraActive}
                      className={`p-3 rounded-lg font-semibold text-sm transition-all ${
                        studyMode === 'practice'
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      } disabled:opacity-50`}
                    >
                      <FiTarget className="mx-auto mb-1" />
                      Practicar
                    </motion.button>
                    
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setStudyMode('quiz')}
                      className={`p-3 rounded-lg font-semibold text-sm transition-all ${
                        studyMode === 'quiz'
                          ? 'bg-purple-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <FiUser className="mx-auto mb-1" />
                      Quiz
                    </motion.button>
                    
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setStudyMode('review')}
                      className={`p-3 rounded-lg font-semibold text-sm transition-all ${
                        studyMode === 'review'
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <FiTrendingUp className="mx-auto mb-1" />
                      Repasar
                    </motion.button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {leaderboard.length > 0 && (
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FiAward className="text-yellow-500" />
                Clasificación
              </h3>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {leaderboard.slice(0, 5).map((entry, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        index === 0 ? 'bg-yellow-100 text-yellow-800' :
                        index === 1 ? 'bg-gray-100 text-gray-800' :
                        index === 2 ? 'bg-orange-100 text-orange-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium text-gray-800 text-sm">{entry.modelName}</div>
                        <div className="text-xs text-gray-600">{entry.completedSigns}/{entry.totalSigns} señas</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-indigo-600">{entry.totalProgress}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-3 space-y-6"
        >
          <div className="relative bg-black rounded-2xl overflow-hidden shadow-2xl">
            <video
              ref={videoRef}
              className="hidden"
              autoPlay
              muted
              playsInline
            />
            <canvas
              ref={canvasRef}
              className="w-full h-auto"
              width={640}
              height={480}
            />
            
            {!cameraActive && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-90 backdrop-blur-sm">
                <div className="text-white text-center">
                  <div className="text-8xl mb-6">📹</div>
                  <p className="text-xl mb-4">Vista de la cámara</p>
                  <p className="text-gray-300">Inicia la cámara para practicar señas</p>
                </div>
              </div>
            )}
            
            {currentSign && cameraActive && (
              <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg backdrop-blur-sm">
                <div className="font-bold text-xl">{studyMode === 'practice' ? 'Practica' : 'Seña'}: {currentSign}</div>
              </div>
            )}
            
            {studyMode === 'practice' && practiceResult && (
              <div className={`absolute top-4 right-4 px-4 py-2 rounded-lg backdrop-blur-sm ${
                practiceResult.success 
                  ? 'bg-green-600 text-white' 
                  : 'bg-red-600 text-white'
              }`}>
                {practiceResult.success ? (
                  <div className="flex items-center gap-2">
                    <FiCheck />
                    ¡Correcto!
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <FiX />
                    Intenta de nuevo
                  </div>
                )}
              </div>
            )}
          </div>

          <AnimatePresence mode="wait">
            {showQuiz ? (
              <motion.div
                key="quiz"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100"
              >
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">¿Qué seña es esta?</h3>
                  <div className="text-6xl mb-6 p-8 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl border-2 border-dashed border-purple-300">
                    {currentSign}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                  {quizOptions.map((option, index) => (
                    <motion.button
                      key={index}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleQuizAnswer(option)}
                      className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 border-2 border-indigo-200 rounded-xl font-semibold text-indigo-800 transition-all"
                    >
                      {option}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            ) : selectedModelData ? (
              <motion.div
                key="learning"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-bold text-gray-800">
                    Señas de {selectedModelData.name}
                  </h3>
                  <div className="flex gap-3">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => startQuiz()}
                      disabled={!selectedModelData.signs.length}
                      className="flex items-center gap-2 bg-purple-500 text-white py-2 px-4 rounded-lg hover:bg-purple-600 disabled:opacity-50 transition-all font-semibold"
                    >
                      <FiZap />
                      Quiz Aleatorio
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={loadLearningStats}
                      className="flex items-center gap-2 bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-all"
                    >
                      <FiRefreshCw />
                    </motion.button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {selectedModelData.signs.map((sign: string, index: number) => {
                    const progress = getSignProgress(sign);
                    const mastered = progress?.mastered || false;
                    const viewed = progress?.viewed || 0;
                    const correct = progress?.correct || 0;
                    const incorrect = progress?.incorrect || 0;
                    const practiceAttempts = progress?.practiceAttempts || 0;
                    const practiceSuccess = progress?.practiceSuccess || 0;
                    const accuracy = correct + incorrect > 0 ? (correct / (correct + incorrect)) * 100 : 0;
                    const practiceAccuracy = practiceAttempts > 0 ? (practiceSuccess / practiceAttempts) * 100 : 0;

                    return (
                      <motion.div
                        key={sign}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={`relative p-6 rounded-2xl shadow-lg border-2 transition-all duration-300 ${
                          mastered
                            ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200'
                            : viewed > 0
                              ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200'
                              : 'bg-white border-gray-200 hover:border-indigo-300'
                        }`}
                      >
                        {mastered && (
                          <div className="absolute -top-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                            <FiCheck className="text-white text-sm" />
                          </div>
                        )}

                        <div className="text-center mb-4">
                          <div className="text-4xl font-bold text-gray-800 mb-2 p-4 bg-gray-50 rounded-xl">
                            {sign}
                          </div>
                          
                          {progress && (
                            <div className="space-y-2">
                              <div className="flex justify-center gap-4 text-xs">
                                <span className="flex items-center gap-1 text-blue-600">
                                  <FiEye /> {viewed}
                                </span>
                                {correct > 0 && (
                                  <span className="flex items-center gap-1 text-green-600">
                                    <FiCheck /> {correct}
                                  </span>
                                )}
                                {incorrect > 0 && (
                                  <span className="flex items-center gap-1 text-red-600">
                                    <FiX /> {incorrect}
                                  </span>
                                )}
                                {practiceAttempts > 0 && (
                                  <span className="flex items-center gap-1 text-purple-600">
                                    <FiTarget /> {practiceSuccess}/{practiceAttempts}
                                  </span>
                                )}
                              </div>
                              
                              {(accuracy > 0 || practiceAccuracy > 0) && (
                                <div className="space-y-1">
                                  {accuracy > 0 && (
                                    <div>
                                      <div className="text-xs text-gray-600">Quiz: {accuracy.toFixed(0)}%</div>
                                      <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                          className={`h-2 rounded-full transition-all duration-500 ${
                                            accuracy >= 80 ? 'bg-green-500' :
                                            accuracy >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                                          }`}
                                          style={{ width: `${accuracy}%` }}
                                        />
                                      </div>
                                    </div>
                                  )}
                                  
                                  {practiceAccuracy > 0 && (
                                    <div>
                                      <div className="text-xs text-gray-600">Práctica: {practiceAccuracy.toFixed(0)}%</div>
                                      <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                          className={`h-2 rounded-full transition-all duration-500 ${
                                            practiceAccuracy >= 80 ? 'bg-purple-500' :
                                            practiceAccuracy >= 60 ? 'bg-orange-500' : 'bg-pink-500'
                                          }`}
                                          style={{ width: `${practiceAccuracy}%` }}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => startLearning(sign)}
                            className="flex items-center justify-center gap-1 bg-indigo-500 text-white py-2 px-2 rounded-lg hover:bg-indigo-600 transition-all text-xs font-semibold"
                          >
                            <FiBook />
                            Estudiar
                          </motion.button>
                          
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => startPractice(sign)}
                            disabled={!cameraActive}
                            className="flex items-center justify-center gap-1 bg-green-500 text-white py-2 px-2 rounded-lg hover:bg-green-600 disabled:opacity-50 transition-all text-xs font-semibold"
                          >
                            <FiTarget />
                            Practicar
                          </motion.button>
                          
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => startQuiz(sign)}
                            className="flex items-center justify-center gap-1 bg-purple-500 text-white py-2 px-2 rounded-lg hover:bg-purple-600 transition-all text-xs font-semibold"
                          >
                            <FiUser />
                            Quiz
                          </motion.button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gradient-to-br from-indigo-50 to-purple-50 p-12 rounded-2xl border border-indigo-200 text-center"
              >
                <div className="text-6xl mb-6">📚</div>
                <h3 className="text-2xl font-bold text-gray-800 mb-4">
                  Selecciona un Modelo para Comenzar
                </h3>
                <p className="text-gray-600 text-lg">
                  Elige un modelo desde el panel lateral para empezar a aprender sus señas
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {currentSign && studyMode === 'learn' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100"
            >
              <div className="text-center">
                <h3 className="text-2xl font-bold text-gray-800 mb-4">Estudiando: {currentSign}</h3>
                <div className="text-8xl mb-8 p-12 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border-2 border-dashed border-indigo-300">
                  {currentSign}
                </div>
                
                <div className="max-w-2xl mx-auto space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 p-4 rounded-xl">
                      <FiEye className="text-blue-500 text-2xl mx-auto mb-2" />
                      <div className="font-semibold text-blue-800">Observa</div>
                      <div className="text-sm text-blue-600">La forma de la seña</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-xl">
                      <FiTarget className="text-green-500 text-2xl mx-auto mb-2" />
                      <div className="font-semibold text-green-800">Practica</div>
                      <div className="text-sm text-green-600">Los movimientos</div>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-xl">
                      <FiUser className="text-purple-500 text-2xl mx-auto mb-2" />
                      <div className="font-semibold text-purple-800">Memoriza</div>
                      <div className="text-sm text-purple-600">La posición</div>
                    </div>
                  </div>
                  
                  <div className="flex justify-center gap-4">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        updateProgress(currentSign, 'study', undefined, 30);
                        toast.success('¡Tiempo de estudio registrado!');
                      }}
                      className="flex items-center gap-2 bg-green-500 text-white py-3 px-6 rounded-xl hover:bg-green-600 transition-all font-semibold"
                    >
                      <FiCheck />
                      Marcar como Estudiada
                    </motion.button>
                    
                    {cameraActive && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => startPractice(currentSign)}
                        className="flex items-center gap-2 bg-green-600 text-white py-3 px-6 rounded-xl hover:bg-green-700 transition-all font-semibold"
                      >
                        <FiTarget />
                        Practicar Seña
                      </motion.button>
                    )}
                    
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => startQuiz(currentSign)}
                      className="flex items-center gap-2 bg-purple-500 text-white py-3 px-6 rounded-xl hover:bg-purple-600 transition-all font-semibold"
                    >
                      <FiUser />
                      Hacer Quiz
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
};

export default SignLearning;