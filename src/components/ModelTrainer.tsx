import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Chart as ChartJS, CategoryScale, LinearScale, LineElement, PointElement, Title, Tooltip, Legend } from 'chart.js/auto';
import { Line } from 'react-chartjs-2';
import { FiCamera, FiCameraOff, FiPlay, FiSquare, FiTrash2, FiZap, FiEye, FiEyeOff } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { MediaPipeHandler, createMediaPipeHandler } from '../utils/mediapipe';
import { Results } from '@mediapipe/hands';
import { api } from '../utils/api';

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Title, Tooltip, Legend);

interface ModelTrainerProps {
  models: any[];
}

const ModelTrainer: React.FC<ModelTrainerProps> = ({ models }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaPipeHandler = useRef<MediaPipeHandler | null>(null);
  const lastCaptureTime = useRef<number>(0);
  const currentLandmarksRef = useRef<any[] | null>(null);
  const isRecordingRef = useRef<boolean>(false);
  const currentSignRef = useRef<string>('');

  const [selectedModel, setSelectedModel] = useState<string>('');
  const [currentSign, setCurrentSign] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordedSamples, setRecordedSamples] = useState<any[]>([]);
  const [trainingProgress, setTrainingProgress] = useState<any>(null);
  const [isTraining, setIsTraining] = useState<boolean>(false);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [sampleCounts, setSampleCounts] = useState<{[key: string]: number}>({});
  const [captureCount, setCaptureCount] = useState<number>(0);
  const [handsDetected, setHandsDetected] = useState<boolean>(false);
  const [showPreview, setShowPreview] = useState<boolean>(true);
  const [autoCapture, setAutoCapture] = useState<boolean>(true);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    currentSignRef.current = currentSign;
  }, [currentSign]);

  useEffect(() => {
    loadModelSamples();
    return () => {
      if (mediaPipeHandler.current) {
        mediaPipeHandler.current.stop();
      }
    };
  }, [selectedModel]);

  const loadModelSamples = async () => {
    if (!selectedModel) {
      setSampleCounts({});
      return;
    }

    try {
      const response = await api.get(`/models/${selectedModel}`);
      const model = response.data;
     
      if (model.samples && model.samples.length > 0) {
        const counts: {[key: string]: number} = {};
        model.samples.forEach((sample: any) => {
          counts[sample.sign] = (counts[sample.sign] || 0) + 1;
        });
        setSampleCounts(counts);
      } else {
        setSampleCounts({});
      }
    } catch (error) {
      console.error('Error loading model samples:', error);
      setSampleCounts({});
    }
  };

  const captureHandData = useCallback((): void => {
    const landmarks = currentLandmarksRef.current;
    const recording = isRecordingRef.current;
    const sign = currentSignRef.current;

    if (!landmarks || !recording || !sign || !autoCapture) {
      return;
    }

    const now = Date.now();
    if (now - lastCaptureTime.current < 300) {
      return;
    }

    lastCaptureTime.current = now;

    const sample = {
      landmarks: landmarks.map(l => ({ x: l.x, y: l.y, z: l.z })),
      sign: sign,
      timestamp: now
    };

    setRecordedSamples(prev => {
      const newSamples = [...prev, sample];
      return newSamples;
    });

    setSampleCounts(prev => {
      const newCount = (prev[sign] || 0) + 1;
      return {
        ...prev,
        [sign]: newCount
      };
    });

    setCaptureCount(prev => prev + 1);
  }, [autoCapture]);

  const onResults = useCallback((results: Results): void => {
    const hasHands = results.multiHandLandmarks && results.multiHandLandmarks.length > 0;
    setHandsDetected(hasHands);
   
    if (hasHands) {
      const landmarks = results.multiHandLandmarks[0];
      if (landmarks && landmarks.length === 21) {
        currentLandmarksRef.current = landmarks;
        if (isRecordingRef.current && currentSignRef.current) {
          captureHandData();
        }
      }
    } else {
      currentLandmarksRef.current = null;
    }
  }, [captureHandData]);

  const startCamera = async (): Promise<void> => {
    if (!videoRef.current || !canvasRef.current) {
      toast.error('Elementos de video no disponibles');
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
      toast.error('Error al acceder a la cámara');
    } finally {
      setIsInitializing(false);
    }
  };

  const stopCamera = (): void => {
    if (mediaPipeHandler.current) {
      mediaPipeHandler.current.stop();
      setCameraActive(false);
      setIsRecording(false);
      setHandsDetected(false);
      currentLandmarksRef.current = null;
      toast.success('Cámara detenida');
    }
  };

  const toggleRecording = (): void => {
    if (!currentSign) {
      toast.error('Selecciona una seña para grabar');
      return;
    }
    if (!cameraActive) {
      toast.error('Primero inicia la cámara');
      return;
    }
   
    const newRecordingState = !isRecording;
    setIsRecording(newRecordingState);
   
    if (newRecordingState) {
      setCaptureCount(0);
      lastCaptureTime.current = 0;
      toast.success(`Grabando seña: ${currentSign}`);
    } else {
      toast.success(`Grabación detenida. ${captureCount} muestras capturadas`);
    }
  };

  const manualCapture = (): void => {
    if (!currentSign || !handsDetected || !currentLandmarksRef.current) {
      toast.error('Necesitas una seña seleccionada y una mano detectada');
      return;
    }

    const sample = {
      landmarks: currentLandmarksRef.current.map(l => ({ x: l.x, y: l.y, z: l.z })),
      sign: currentSign,
      timestamp: Date.now()
    };

    setRecordedSamples(prev => [...prev, sample]);
    setSampleCounts(prev => ({
      ...prev,
      [currentSign]: (prev[currentSign] || 0) + 1
    }));
    setCaptureCount(prev => prev + 1);
    
    toast.success('Muestra capturada manualmente');
  };

  const clearCurrentSamples = () => {
    setRecordedSamples([]);
    setCaptureCount(0);
    loadModelSamples();
    toast.success('Muestras limpiadas');
  };

  const trainModel = async (): Promise<void> => {
    if (!selectedModel) {
      toast.error('Selecciona un modelo');
      return;
    }

    const totalSamples = recordedSamples.length;
    if (totalSamples < 5) {
      toast.error(`Necesitas al menos 5 muestras. Tienes ${totalSamples} muestras.`);
      return;
    }

    setIsTraining(true);
    
    const loadingToast = toast.loading('Entrenando modelo...');
    
    try {
      const response = await api.post('/training/train', {
        modelId: selectedModel,
        samples: recordedSamples
      });
      
      setTrainingProgress(response.data.progress);
      setRecordedSamples([]);
      setCaptureCount(0);
      loadModelSamples();
      
      toast.success(`Entrenamiento completado con ${totalSamples} muestras!`, { id: loadingToast });
    } catch (error: any) {
      console.error('Training error:', error);
      const errorMessage = error.response?.data?.error || 'Error durante el entrenamiento';
      toast.error(errorMessage, { id: loadingToast });
    } finally {
      setIsTraining(false);
    }
  };

  const selectedModelData = models.find(m => m.id === selectedModel);

  const chartData = trainingProgress ? {
    labels: trainingProgress.epochs.map((_: any, idx: number) => `Época ${idx + 1}`),
    datasets: [
      {
        label: 'Precisión',
        data: trainingProgress.accuracy,
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.4,
      },
      {
        label: 'Pérdida',
        data: trainingProgress.loss,
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.4,
      }
    ]
  } : null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="text-center">
        <h2 className="text-4xl font-bold text-gray-800 mb-3 bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
          Entrenar Modelo
        </h2>
        <p className="text-gray-600 text-lg">
          Graba muestras de señas y entrena tu modelo con IA
        </p>
      </div>
     
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Configuración</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seleccionar Modelo
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Seña Actual
                  </label>
                  <select
                    value={currentSign}
                    onChange={(e) => setCurrentSign(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                  >
                    <option value="">Selecciona una seña</option>
                    {selectedModelData.signs.map((sign: string) => (
                      <option key={sign} value={sign}>
                        {sign}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={autoCapture}
                    onChange={(e) => setAutoCapture(e.target.checked)}
                    className="w-4 h-4 text-orange-500 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">Captura automática</span>
                </label>
                
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex items-center gap-2 px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  {showPreview ? <FiEye /> : <FiEyeOff />}
                  <span className="text-sm">{showPreview ? 'Ocultar' : 'Mostrar'}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={cameraActive ? stopCamera : startCamera}
              disabled={isInitializing}
              className={`flex items-center justify-center gap-3 py-4 px-6 rounded-xl font-semibold transition-all ${
                cameraActive
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              } disabled:opacity-50 shadow-lg`}
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
                  Iniciar Cámara
                </>
              )}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={toggleRecording}
              disabled={!cameraActive || !currentSign}
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

          {!autoCapture && cameraActive && currentSign && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={manualCapture}
              disabled={!handsDetected}
              className="w-full bg-purple-500 text-white py-3 px-6 rounded-xl font-semibold hover:bg-purple-600 disabled:opacity-50 transition-all shadow-lg flex items-center justify-center gap-3"
            >
              <FiZap />
              Capturar Manualmente
            </motion.button>
          )}

          <AnimatePresence>
            {cameraActive && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`p-4 rounded-xl border-2 ${
                  handsDetected 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-yellow-50 border-yellow-200'
                }`}
              >
                <div className="text-center">
                  <div className={`font-semibold ${
                    handsDetected ? 'text-green-600' : 'text-yellow-600'
                  }`}>
                    {handsDetected ? '✅ Mano detectada' : '⚠️ Pon tu mano frente a la cámara'}
                  </div>
                  {handsDetected && isRecording && autoCapture && (
                    <div className="text-sm text-green-500 mt-1">
                      Capturando automáticamente cada 300ms
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isRecording && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-red-50 border-2 border-red-200 rounded-xl p-4"
              >
                <div className="text-center">
                  <div className="text-red-600 font-semibold flex items-center justify-center gap-2">
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="w-3 h-3 bg-red-500 rounded-full"
                    />
                    GRABANDO: {currentSign}
                  </div>
                  <div className="text-sm text-red-500 mt-1">
                    Muestras capturadas: {captureCount}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-800">Estado de Muestras</h3>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={clearCurrentSamples}
                disabled={recordedSamples.length === 0}
                className="flex items-center gap-2 text-sm bg-red-100 hover:bg-red-200 disabled:bg-gray-100 disabled:text-gray-400 px-3 py-2 rounded-lg transition-colors"
              >
                <FiTrash2 />
                Limpiar ({recordedSamples.length})
              </motion.button>
            </div>

            <div className="mb-4 p-3 bg-blue-50 rounded-xl">
              <div className="text-sm font-medium text-blue-800">
                Muestras nuevas: {recordedSamples.length}
              </div>
              {recordedSamples.length > 0 && (
                <div className="text-xs text-blue-600 mt-1">
                  Última: {currentSign} ({recordedSamples[recordedSamples.length - 1]?.landmarks?.length || 0} puntos)
                </div>
              )}
            </div>

            <div className="space-y-3 max-h-64 overflow-y-auto">
              {selectedModelData && selectedModelData.signs.map((sign: string) => {
                const totalSamples = sampleCounts[sign] || 0;
                const newSamples = recordedSamples.filter(s => s.sign === sign).length;
                return (
                  <div key={sign} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium text-gray-700">{sign}</span>
                    <div className="flex gap-2">
                      <span className={`px-3 py-1 rounded-full text-sm ${
                        totalSamples >= 10
                          ? 'bg-green-100 text-green-800'
                          : totalSamples >= 5
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        DB: {totalSamples}
                      </span>
                      {newSamples > 0 && (
                        <span className="px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                          +{newSamples}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={trainModel}
            disabled={isTraining || recordedSamples.length < 5}
            className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-4 px-6 rounded-xl font-semibold hover:from-orange-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg flex items-center justify-center gap-3"
          >
            {isTraining ? (
              <>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }}>
                  <FiZap />
                </motion.div>
                Entrenando...
              </>
            ) : (
              <>
                <FiZap />
                Entrenar Modelo ({recordedSamples.length} nuevas)
              </>
            )}
          </motion.button>

          {recordedSamples.length < 5 && recordedSamples.length > 0 && (
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm text-orange-600 text-center bg-orange-50 p-3 rounded-xl"
            >
              Necesitas {5 - recordedSamples.length} muestras más para entrenar
            </motion.p>
          )}
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
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
                {isRecording && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute top-4 left-4 bg-red-600 text-white px-3 py-2 rounded-full text-sm font-semibold flex items-center gap-2"
                  >
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="w-2 h-2 bg-white rounded-full"
                    />
                    REC - {captureCount}
                  </motion.div>
                )}

                {cameraActive && currentSign && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute bottom-4 left-4 bg-black bg-opacity-70 text-white px-3 py-2 rounded-lg backdrop-blur-sm"
                  >
                    Seña: {currentSign}
                  </motion.div>
                )}

                {handsDetected && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute top-4 right-4 bg-green-600 text-white px-3 py-2 rounded-full text-sm font-semibold"
                  >
                    ✅ Detectado
                  </motion.div>
                )}
              </AnimatePresence>

              {!cameraActive && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-80 backdrop-blur-sm">
                  <div className="text-white text-center">
                    <div className="text-6xl mb-4">📹</div>
                    <p className="text-lg">Inicia la cámara para comenzar</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {trainingProgress && chartData && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100"
            >
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Progreso del Entrenamiento
              </h3>
              <div className="h-64">
                <Line data={chartData} options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'top' as const,
                    },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                    },
                  },
                }} />
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
};

export default ModelTrainer;