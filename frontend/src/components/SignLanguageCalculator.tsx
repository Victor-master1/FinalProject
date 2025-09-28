import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  XCircle as XIcon,
  CheckCircle as CheckIcon,
  RefreshCw as RefreshIcon,
  Power as PowerIcon,
  Zap as ZapIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { Results } from "@mediapipe/hands";
import { api } from "../utils/api";
import { MediaPipeHandler, createMediaPipeHandler } from "../utils/mediapipe";

const safeEvaluateExpression = (expr: string): string => {
  const sanitized = expr.replace(/[^0-9+\-*/.]/g, "");
  if (!sanitized) return "0";
  try {
    // eslint-disable-next-line no-new-func
    const val = Function(`"use strict"; return (${sanitized});`)();
    if (typeof val === "number" && isFinite(val)) return String(val);
    return "Error";
  } catch {
    return "Error";
  }
};

interface SignLanguageCalculatorProps {
  modelId?: string;
}

interface CalculationState {
  num1: string;
  operator: string;
  num2: string;
  result: string;
  activeBlock: "num1" | "operator" | "num2" | "complete";
}

const InputBlock: React.FC<{ title: string; value: string; isActive: boolean; dark?: boolean }> = ({ title, value, isActive, dark }) => {
  const base = "p-4 rounded-xl font-bold text-center border-2 transition-all duration-300 shadow-md";
  const bg = dark ? "bg-gray-800" : "bg-white";
  const border = isActive ? "border-indigo-400 ring-4 ring-indigo-500/30" : dark ? "border-gray-600" : "border-gray-300";
  const text = dark ? "text-white" : "text-gray-900";
  const titleColor = dark ? "text-gray-400" : "text-gray-600";

  return (
    <motion.div
      className={`${base} ${bg} ${border}`}
      animate={{ scale: isActive ? 1.03 : 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      <p className={`text-sm uppercase tracking-wider ${titleColor}`}>{title}</p>
      <div className={`text-3xl mt-1 ${text}`}>{value || (isActive ? "✋" : "—")}</div>
    </motion.div>
  );
};

const SignLanguageCalculator: React.FC<SignLanguageCalculatorProps> = ({ modelId }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mpHandler = useRef<MediaPipeHandler | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [handsDetected, setHandsDetected] = useState(false);
  const [isAutoRecognizing, setIsAutoRecognizing] = useState(true);
  const [isPredicting, setIsPredicting] = useState(false);

  const [calcState, setCalcState] = useState<CalculationState>({
    num1: "",
    operator: "",
    num2: "",
    result: "",
    activeBlock: "num1",
  });

  const lastPredictionRef = useRef<string | null>(null);
  const currentLandmarksRef = useRef<any[] | null>(null);
  const recognitionIntervalRef = useRef<number | null>(null);

  const isDarkMode = useMemo(() => document.body.classList.contains("dark"), []);

  // MODELOS
  const [models, setModels] = useState<any[]>([]);
  // Usar el modelId recibido como valor inicial
  const [selectedModelId, setSelectedModelId] = useState<string>(modelId || "");

  useEffect(() => {
    api.get("/models")
      .then(res => setModels(res.data))
      .catch(() => setModels([]));
  }, []);

  const onResults = useCallback((results: Results) => {
    const hasHands = !!(results.multiHandLandmarks && results.multiHandLandmarks.length > 0);
    setHandsDetected(hasHands);

    if (hasHands) {
      let chosen = results.multiHandLandmarks[0];
      if (results.multiHandedness && results.multiHandedness.length > 0) {
        const rightIndex = results.multiHandedness.findIndex((h: any) => h.label?.toLowerCase?.() === "right");
        if (rightIndex >= 0 && results.multiHandLandmarks[rightIndex]) {
          chosen = results.multiHandLandmarks[rightIndex];
        }
      }
      if (chosen && chosen.length === 21) {
        currentLandmarksRef.current = chosen.map((l: any) => ({ x: l.x, y: l.y, z: l.z }));
      } else {
        currentLandmarksRef.current = null;
      }
    } else {
      currentLandmarksRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) {
      toast.error("No se encontró video/canvas");
      return;
    }
    setIsInitializing(true);
    try {
      if (mpHandler.current) mpHandler.current.stop();
      mpHandler.current = createMediaPipeHandler();
      const ok = await mpHandler.current.initialize(videoRef.current, canvasRef.current, onResults);
      if (!ok) throw new Error("Error inicializando MediaPipe");
      setCameraActive(true);
      setIsAutoRecognizing(true);
      toast.success("Cámara iniciada");
    } catch (err) {
      console.error(err);
      toast.error("No se pudo iniciar la cámara");
    } finally {
      setIsInitializing(false);
    }
  }, [onResults]);

  const stopCamera = useCallback(() => {
    if (mpHandler.current) mpHandler.current.stop();
    setCameraActive(false);
    setIsAutoRecognizing(false);
    setHandsDetected(false);
    currentLandmarksRef.current = null;
    lastPredictionRef.current = null;
    if (recognitionIntervalRef.current !== null) {
      clearInterval(recognitionIntervalRef.current);
      recognitionIntervalRef.current = null;
    }
    toast.success("Cámara detenida");
  }, []);

  const resetCalculator = useCallback(() => {
    setCalcState({ num1: "", operator: "", num2: "", result: "", activeBlock: "num1" });
  }, []);

  // Cálculo automático y mantiene la operación hasta limpiar
  const processPrediction = useCallback((prediction: string) => {
    setCalcState((prev) => {
      if (prediction === "clear") {
        return { num1: "", operator: "", num2: "", result: "", activeBlock: "num1" };
      }

      if (!isNaN(Number(prediction))) {
        if (prev.activeBlock === "num1") {
          return { ...prev, num1: prev.num1 + prediction, activeBlock: "operator" };
        }
        if (prev.activeBlock === "num2") {
          const newNum2 = prev.num2 + prediction;
          // Cálculo automático aquí
          if (prev.num1 && prev.operator && newNum2) {
            const expr = `${prev.num1}${prev.operator}${newNum2}`;
            const safe = safeEvaluateExpression(expr);
            if (safe === "Error") {
              toast.error("Expresión inválida");
              return { ...prev, num2: newNum2, result: "Error", activeBlock: "complete" };
            }
            // Mantén toda la operación y muestra el resultado
            return { ...prev, num2: newNum2, result: safe, activeBlock: "complete" };
          }
          return { ...prev, num2: newNum2, activeBlock: "complete" };
        }
        return prev;
      }

      if (["+", "-", "*", "/"].includes(prediction)) {
        if (prev.num1 && prev.activeBlock === "operator") {
          return { ...prev, operator: prediction, activeBlock: "num2" };
        }
        return prev;
      }

      if (prediction === "equal") {
        if (prev.num1 && prev.operator && prev.num2) {
          const expr = `${prev.num1}${prev.operator}${prev.num2}`;
          const safe = safeEvaluateExpression(expr);
          if (safe === "Error") {
            toast.error("Expresión inválida");
            return { ...prev, result: "Error" };
          }
          // Si usas "equal", puedes limpiar o dejar igual, aquí lo dejamos igual
          return { ...prev, result: safe, activeBlock: "complete" };
        }
        toast.error("Faltan valores para calcular");
        return prev;
      }

      return prev;
    });
  }, []);

  const recognizeSign = useCallback(
    async (isAuto = false) => {
      if (!currentLandmarksRef.current) {
        if (!isAuto) toast.error("No se detecta la mano");
        return;
      }
      if (isPredicting) return;
      if (!selectedModelId) {
        toast.error("Selecciona un modelo primero");
        return;
      }
      setIsPredicting(true);

      try {
        const payload = {
          modelId: selectedModelId,
          landmarks: currentLandmarksRef.current,
        };

        const response = await api.post("/prediction/predict", payload);
        const { prediction, confidence } = response.data;

        if (confidence < 0.7) {
          if (!isAuto) toast.error("Seña no clara");
          lastPredictionRef.current = null;
          return;
        }

        if (isAuto && prediction === lastPredictionRef.current) {
          return;
        }
        lastPredictionRef.current = prediction;

        processPrediction(prediction);
      } catch (err) {
        console.error("Error en predict:", err);
        if (!isAuto) toast.error("Error comunicando con el modelo");
      } finally {
        setIsPredicting(false);
      }
    },
    [selectedModelId, isPredicting, processPrediction]
  );

  useEffect(() => {
    if (cameraActive && isAutoRecognizing) {
      if (recognitionIntervalRef.current !== null) {
        clearInterval(recognitionIntervalRef.current);
      }
      const id = window.setInterval(() => {
        if (currentLandmarksRef.current) recognizeSign(true);
      }, 650);
      recognitionIntervalRef.current = id as unknown as number;
      return () => {
        if (recognitionIntervalRef.current !== null) {
          clearInterval(recognitionIntervalRef.current);
          recognitionIntervalRef.current = null;
        }
      };
    } else {
      if (recognitionIntervalRef.current !== null) {
        clearInterval(recognitionIntervalRef.current);
        recognitionIntervalRef.current = null;
      }
    }
  }, [cameraActive, isAutoRecognizing, recognizeSign]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-8 p-4">
      {/* SIDEBAR */}
      <aside className="md:col-span-1 space-y-6">
        <div className={`rounded-2xl shadow-xl p-5 ${isDarkMode ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-200"}`}>
          <h3 className={`font-extrabold text-xl mb-4 ${isDarkMode ? "text-white" : "text-gray-900"}`}>Controles</h3>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Selecciona un modelo</label>
            <select
              value={selectedModelId}
              onChange={e => setSelectedModelId(e.target.value)}
              className="w-full px-4 py-2 border rounded"
            >
              <option value="">Elige un modelo</option>
              {models.map(model => (
                <option key={model.id} value={model.id}>{model.name || model.id}</option>
              ))}
            </select>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={cameraActive ? stopCamera : startCamera}
            disabled={isInitializing}
            className={`w-full px-4 py-3 rounded-xl font-bold text-white transition-all duration-300 flex items-center justify-center gap-2 shadow-lg ${
              isInitializing ? "bg-gray-500 cursor-not-allowed" : cameraActive ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {isInitializing ? <RefreshIcon className="animate-spin w-5 h-5" /> : <PowerIcon className="w-5 h-5" />}
            {isInitializing ? "Inicializando..." : cameraActive ? "Detener Cámara" : "Iniciar Cámara"}
          </motion.button>
          {cameraActive && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsAutoRecognizing((p) => !p)}
              className={`mt-3 w-full px-4 py-3 rounded-xl font-bold text-white transition-all duration-300 flex items-center justify-center gap-2 shadow-lg ${
                isAutoRecognizing ? "bg-purple-600 hover:bg-purple-700" : "bg-yellow-600 hover:bg-yellow-700"
              }`}
            >
              <ZapIcon className={`w-5 h-5 ${isAutoRecognizing ? "animate-pulse" : ""}`} />
              {isAutoRecognizing ? "Reconocimiento Automático ON" : "Activar Reconocimiento"}
            </motion.button>
          )}
          {cameraActive && !isAutoRecognizing && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => recognizeSign(false)}
              disabled={isPredicting || !handsDetected}
              className={`mt-3 w-full px-4 py-3 rounded-xl font-bold text-white transition-all duration-300 flex items-center justify-center gap-2 ${
                isPredicting ? "bg-indigo-400 cursor-wait" : "bg-indigo-600 hover:bg-indigo-700"
              } disabled:opacity-50`}
            >
              {isPredicting ? <RefreshIcon className="animate-spin w-5 h-5" /> : "✋"}
              Reconocer Seña (Manual)
            </motion.button>
          )}
          {(calcState.num1 || calcState.operator || calcState.num2) && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={resetCalculator}
              className="mt-3 w-full px-4 py-3 rounded-xl font-bold text-white transition-all duration-300 flex items-center justify-center gap-2 bg-pink-600 hover:bg-pink-700 shadow-lg"
            >
              <RefreshIcon className="w-5 h-5" />
              Limpiar Calculadora
            </motion.button>
          )}
        </div>
        <div className={`rounded-2xl shadow-xl p-5 ${isDarkMode ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-200"}`}>
          <h3 className={`font-extrabold text-xl mb-2 ${isDarkMode ? "text-white" : "text-gray-900"}`}>Estado del Sistema</h3>
          <p className="flex items-center gap-2 font-medium">
            {handsDetected ? (
              <span className="text-green-500 flex items-center gap-2">
                <CheckIcon className="w-5 h-5" /> Mano detectada
              </span>
            ) : (
              <span className="text-red-500 flex items-center gap-2">
                <XIcon className="w-5 h-5" /> Esperando mano
              </span>
            )}
          </p>
          {isAutoRecognizing && (
            <p className="flex items-center gap-2 mt-2 text-purple-500 font-medium">
              <ZapIcon className="w-5 h-5" /> Reconocimiento Automático Activo
            </p>
          )}
        </div>
      </aside>
      <section className="md:col-span-3 space-y-6">
        <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`text-3xl font-extrabold text-center ${isDarkMode ? "text-blue-300" : "text-gray-800"}`}>
          Calculadora con Lenguaje de Señas
        </motion.h2>
        <div className="relative bg-black rounded-2xl overflow-hidden shadow-2xl mx-auto max-w-2xl aspect-video">
          <video ref={videoRef as any} className="hidden" autoPlay muted playsInline />
          <canvas ref={canvasRef as any} width={640} height={480} className="w-full h-full object-cover" />
          {!cameraActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90 text-white p-4">
              <PowerIcon className="w-10 h-10 mb-3 text-red-400" />
              <p className="text-lg font-medium">Pulsa "Iniciar Cámara" para comenzar.</p>
              {isInitializing && <p className="mt-2 text-sm text-gray-400 flex items-center gap-2"><RefreshIcon className="w-5 h-5 animate-spin" /> Cargando...</p>}
            </div>
          )}
        </div>
        <div className="max-w-2xl mx-auto p-4 rounded-2xl shadow-2xl space-y-6">
          <div className="grid grid-cols-5 gap-4 items-center">
            <div className="col-span-2">
              <InputBlock title="NÚMERO 1" value={calcState.num1} isActive={calcState.activeBlock === "num1"} dark={isDarkMode} />
            </div>
            <div className="col-span-1">
              <InputBlock title="SEÑA" value={calcState.operator} isActive={calcState.activeBlock === "operator"} dark={isDarkMode} />
            </div>
            <div className="col-span-2">
              <InputBlock title="NÚMERO 2" value={calcState.num2} isActive={calcState.activeBlock === "num2"} dark={isDarkMode} />
            </div>
          </div>
          <div className={`w-full p-6 rounded-2xl shadow-inner transition-colors duration-300 ${isDarkMode ? "bg-gray-800 border-2 border-indigo-600" : "bg-white border-2 border-indigo-400"}`}>
            <p className={`text-right text-sm uppercase font-semibold ${isDarkMode ? "text-indigo-400" : "text-indigo-600"}`}>Resultado</p>
            <div className={`text-right text-6xl font-extrabold mt-1 transition-colors duration-300 ${isDarkMode ? "text-white" : "text-gray-900"}`}>
              <motion.span key={calcState.result} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.3 }}>
                {calcState.result || "0"}
              </motion.span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SignLanguageCalculator;