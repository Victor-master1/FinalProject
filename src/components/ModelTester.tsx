import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiCamera, FiCameraOff, FiPlay, FiSquare, FiMic, FiMicOff, FiDownload, FiTrash2, FiVolume2, FiEye, FiEyeOff, FiTarget, FiZap, FiSettings } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { MediaPipeHandler, createMediaPipeHandler } from '../utils/mediapipe';
import { Results } from '@mediapipe/hands';
import { api } from '../utils/api';

interface ModelTesterProps {
  models: any[];
}

const ModelTester: React.FC<ModelTesterProps> = ({ models }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaPipeHandler = useRef<MediaPipeHandler | null>(null);
  const predictionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentLandmarksRef = useRef<any[] | null>(null);

  const [selectedModel, setSelectedModel] = useState<string>('');
  const [isActive, setIsActive] = useState<boolean>(false);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [currentPrediction, setCurrentPrediction] = useState<string>('');
  const [confidence, setConfidence] = useState<number>(0);
  const [detectedText, setDetectedText] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [handsDetected, setHandsDetected] = useState<boolean>(false);
  const [showPreview, setShowPreview] = useState<boolean>(true);
  const [autoSpeak, setAutoSpeak] = useState<boolean>(false);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.7);
  const [predictionDelay, setPredictionDelay] = useState<number>(500);
  const [sessionStats, setSessionStats] = useState({
    totalPredictions: 0,
    avgConfidence: 0,
    highConfidencePredictions: 0,
    sessionDuration: 0
  });
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [wordBuffer, setWordBuffer] = useState<string[]>([]);

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

  const predictSign = useCallback(async (): Promise<void> => {
    if (!isActive || !selectedModel || !currentLandmarksRef.current) {
      return;
    }

    try {
      const response = await api.post('/prediction/predict', {
        modelId: selectedModel,
        landmarks: currentLandmarksRef.current.map((l: any) => ({ x: l.x, y: l.y, z: l.z }))
      });

      const { prediction, confidence: conf } = response.data;

      if (conf >= confidenceThreshold) {
        const newPrediction = {
          sign: prediction,
          confidence: conf,
          timestamp: Date.now()
        };

        setCurrentPrediction(prediction);
        setConfidence(conf);
        setPredictions(prev => [...prev.slice(-19), newPrediction]);

        setSessionStats(prev => {
          const newTotal = prev.totalPredictions + 1;
          const newAvg = (prev.avgConfidence * prev.totalPredictions + conf) / newTotal;
          const newHigh = conf >= confidenceThreshold ? prev.highConfidencePredictions + 1 : prev.highConfidencePredictions;

          return {
            ...prev,
            totalPredictions: newTotal,
            avgConfidence: newAvg,
            highConfidencePredictions: newHigh
          };
        });

        addToWordBuffer(prediction);

        if (autoSpeak) {
          speakText(prediction);
        }
      }
    } catch (error) {
      console.error('Error predicting sign:', error);
    }
  }, [isActive, selectedModel, confidenceThreshold, autoSpeak]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive && sessionStartTime) {
      interval = setInterval(() => {
        const duration = Math.floor((Date.now() - sessionStartTime) / 1000);
        setSessionStats(prev => ({ ...prev, sessionDuration: duration }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, sessionStartTime]);

  useEffect(() => {
    if (isActive && selectedModel) {
      predictionIntervalRef.current = setInterval(predictSign, predictionDelay);
    } else if (predictionIntervalRef.current) {
      clearInterval(predictionIntervalRef.current);
      predictionIntervalRef.current = null;
    }

    return () => {
      if (predictionIntervalRef.current) {
        clearInterval(predictionIntervalRef.current);
        predictionIntervalRef.current = null;
      }
    };
  }, [isActive, selectedModel, predictionDelay, predictSign]);

  useEffect(() => {
    return () => {
      if (mediaPipeHandler.current) {
        mediaPipeHandler.current.stop();
      }
      if (predictionIntervalRef.current) {
        clearInterval(predictionIntervalRef.current);
      }
    };
  }, []);

  const addToWordBuffer = (word: string) => {
    setWordBuffer(prev => {
      const newBuffer = [...prev, word];
      if (newBuffer.length > 20) {
        newBuffer.shift();
      }
      const sentence = newBuffer.join(' ');
      setDetectedText(sentence);
      return newBuffer;
    });
  };

  const startDetection = async (): Promise<void> => {
    if (!selectedModel) {
      toast.error('Selecciona un modelo primero');
      return;
    }

    setIsInitializing(true);
    try {
      if (!mediaPipeHandler.current) {
        mediaPipeHandler.current = createMediaPipeHandler();
      }

      const success = await mediaPipeHandler.current.initialize(
        videoRef.current!,
        canvasRef.current!,
        onResults
      );

      if (success) {
        setIsActive(true);
        setSessionStartTime(Date.now());
        setSessionStats({ totalPredictions: 0, avgConfidence: 0, highConfidencePredictions: 0, sessionDuration: 0 });
        toast.success('Detección iniciada');
      } else {
        toast.error('Error al inicializar la cámara');
      }
    } catch (error) {
      toast.error('Error al iniciar la detección');
    } finally {
      setIsInitializing(false);
    }
  };

  const stopDetection = (): void => {
    if (mediaPipeHandler.current) {
      mediaPipeHandler.current.stop();
      setIsActive(false);
      setSessionStartTime(null);
      setHandsDetected(false);
      currentLandmarksRef.current = null;
      
      if (predictionIntervalRef.current) {
        clearInterval(predictionIntervalRef.current);
        predictionIntervalRef.current = null;
      }
      
      toast.success('Detección detenida');
    }
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      toast.success('Grabación iniciada');
    } else {
      toast.success(`Grabación guardada: "${detectedText}"`);
    }
  };

  const clearText = (): void => {
    setDetectedText('');
    setPredictions([]);
    setWordBuffer([]);
    setCurrentPrediction('');
    setConfidence(0);
  };

  const speakText = (text: string = detectedText): void => {
    if (text && 'speechSynthesis' in window) {
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-ES';
      utterance.rate = 0.8;
      utterance.pitch = 1;
      speechSynthesis.speak(utterance);
    }
  };

  const downloadSession = () => {
    const sessionData = {
      modelId: selectedModel,
      detectedText,
      predictions,
      stats: sessionStats,
      timestamp: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const selectedModelData = models.find(m => m.id === selectedModel);

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
          className="text-4xl font-bold bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent mb-3"
        >
          Usar Modelo
        </motion.h2>
        <p className="text-gray-600 text-lg">
          Detecta señas en tiempo real con IA avanzada
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="xl:col-span-1 space-y-6"
        >
          <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
            <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FiSettings className="text-blue-500" />
              Configuración
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Modelo
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="">Selecciona un modelo</option>
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedModelData && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="text-sm text-blue-800 font-medium mb-1">
                    Señas disponibles:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {selectedModelData.signs.slice(0, 8).map((sign: string) => (
                      <span key={sign} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                        {sign}
                      </span>
                    ))}
                    {selectedModelData.signs.length > 8 && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                        +{selectedModelData.signs.length - 8}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Umbral de Confianza: {(confidenceThreshold * 100).toFixed(0)}%
                </label>
                <input
                  type="range"
                  min="0.3"
                  max="0.95"
                  step="0.05"
                  value={confidenceThreshold}
                  onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Delay de Predicción: {predictionDelay}ms
                </label>
                <input
                  type="range"
                  min="100"
                  max="1000"
                  step="50"
                  value={predictionDelay}
                  onChange={(e) => setPredictionDelay(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={autoSpeak}
                    onChange={(e) => setAutoSpeak(e.target.checked)}
                    className="w-4 h-4 text-blue-500 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Hablar automáticamente</span>
                </label>

                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex items-center gap-1 px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm"
                >
                  {showPreview ? <FiEye /> : <FiEyeOff />}
                  {showPreview ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={isActive ? stopDetection : startDetection}
              disabled={!selectedModel || isInitializing}
              className={`flex items-center justify-center gap-3 py-4 px-6 rounded-xl font-semibold transition-all ${
                isActive
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              } disabled:opacity-50 shadow-lg`}
            >
              {isInitializing ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }}>
                  <FiCamera />
                </motion.div>
              ) : isActive ? (
                <>
                  <FiCameraOff />
                  Detener
                </>
              ) : (
                <>
                  <FiCamera />
                  Iniciar
                </>
              )}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={toggleRecording}
              disabled={!isActive}
              className={`flex items-center justify-center gap-3 py-4 px-6 rounded-xl font-semibold transition-all ${
                isRecording
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-green-500 text-white hover:bg-green-600'
              } disabled:opacity-50 shadow-lg`}
            >
              {isRecording ? (
                <>
                  <FiSquare />
                  Parar
                </>
              ) : (
                <>
                  <FiPlay />
                  Grabar
                </>
              )}
            </motion.button>
          </div>

          {isActive && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100"
            >
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FiTarget className="text-blue-500" />
                Estadísticas de Sesión
              </h3>

              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {sessionStats.totalPredictions}
                  </div>
                  <div className="text-xs text-blue-800">Predicciones</div>
                </div>

                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {(sessionStats.avgConfidence * 100).toFixed(0)}%
                  </div>
                  <div className="text-xs text-green-800">Confianza Prom.</div>
                </div>

                <div className="bg-purple-50 p-3 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {sessionStats.highConfidencePredictions}
                  </div>
                  <div className="text-xs text-purple-800">Alta Confianza</div>
                </div>

                <div className="bg-orange-50 p-3 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {formatTime(sessionStats.sessionDuration)}
                  </div>
                  <div className="text-xs text-orange-800">Tiempo</div>
                </div>
              </div>
            </motion.div>
          )}

          <AnimatePresence>
            {currentPrediction && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`p-6 rounded-2xl border-2 ${
                  confidence >= confidenceThreshold
                    ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200'
                    : confidence >= 0.5
                    ? 'bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200'
                    : 'bg-gradient-to-br from-red-50 to-pink-50 border-red-200'
                }`}
              >
                <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <FiZap className="text-blue-500" />
                  Detección Actual
                </h3>

                <div className="text-center">
                  <div className="text-5xl font-bold text-gray-800 mb-3">
                    {currentPrediction}
                  </div>
                  <div className={`text-sm font-medium ${
                    confidence >= confidenceThreshold ? 'text-green-600' : 'text-orange-600'
                  }`}>
                    Confianza: {(confidence * 100).toFixed(1)}%
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 mt-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-300 ${
                        confidence >= confidenceThreshold ? 'bg-green-500' : 'bg-orange-500'
                      }`}
                      style={{ width: `${confidence * 100}%` }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="xl:col-span-2 space-y-6"
        >
          {showPreview && (
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

              <AnimatePresence>
                {isActive && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute top-4 left-4 bg-green-600 text-white px-3 py-2 rounded-full text-sm font-semibold flex items-center gap-2"
                  >
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="w-2 h-2 bg-white rounded-full"
                    />
                    EN VIVO
                  </motion.div>
                )}

                {isRecording && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute top-4 right-4 bg-red-600 text-white px-3 py-2 rounded-full text-sm font-semibold flex items-center gap-2"
                  >
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="w-2 h-2 bg-white rounded-full"
                    />
                    REC
                  </motion.div>
                )}

                {handsDetected && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute bottom-4 right-4 bg-blue-600 text-white px-3 py-2 rounded-full text-sm font-semibold"
                  >
                    ✋ Detectado
                  </motion.div>
                )}

                {currentPrediction && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute bottom-4 left-4 bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg backdrop-blur-sm"
                  >
                    <div className="font-bold text-xl">{currentPrediction}</div>
                    <div className="text-sm opacity-80">
                      {(confidence * 100).toFixed(0)}% confianza
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {!isActive && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-90 backdrop-blur-sm">
                  <div className="text-white text-center">
                    <div className="text-8xl mb-6">🎬</div>
                    <p className="text-xl mb-4">Listo para detectar señas</p>
                    <p className="text-gray-300">Inicia la detección para comenzar</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-800 text-lg">
                  Texto Detectado
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => speakText()}
                    disabled={!detectedText}
                    className="flex items-center gap-1 bg-blue-100 hover:bg-blue-200 disabled:bg-gray-100 disabled:text-gray-400 px-3 py-2 rounded-lg transition-colors text-sm"
                  >
                    <FiVolume2 />
                    Hablar
                  </button>
                  <button
                    onClick={downloadSession}
                    disabled={!detectedText}
                    className="flex items-center gap-1 bg-green-100 hover:bg-green-200 disabled:bg-gray-100 disabled:text-gray-400 px-3 py-2 rounded-lg transition-colors text-sm"
                  >
                    <FiDownload />
                    Descargar
                  </button>
                  <button
                    onClick={clearText}
                    className="flex items-center gap-1 bg-red-100 hover:bg-red-200 px-3 py-2 rounded-lg transition-colors text-sm"
                  >
                    <FiTrash2 />
                    Limpiar
                  </button>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl min-h-32 text-gray-700 leading-relaxed">
                {detectedText || 'El texto detectado aparecerá aquí...'}
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
              <h3 className="font-semibold text-gray-800 mb-4 text-lg">
                Historial de Predicciones
              </h3>

              <div className="space-y-2 max-h-80 overflow-y-auto">
                {predictions.slice(-10).reverse().map((pred, idx) => (
                  <motion.div
                    key={`${pred.timestamp}-${idx}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex justify-between items-center bg-gray-50 p-3 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-lg text-gray-800">
                        {pred.sign}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(pred.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        pred.confidence >= confidenceThreshold
                          ? 'bg-green-100 text-green-800'
                          : pred.confidence >= 0.5
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {(pred.confidence * 100).toFixed(0)}%
                      </span>
                      <div className={`w-3 h-3 rounded-full ${
                        pred.confidence >= confidenceThreshold
                          ? 'bg-green-500'
                          : 'bg-yellow-500'
                      }`} />
                    </div>
                  </motion.div>
                ))}
                {predictions.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    No hay predicciones aún
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default ModelTester;