import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiUpload, FiFile, FiCheck, FiX, FiDownload, FiInfo, FiEye, FiLoader, FiAlertCircle, FiDatabase } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { api } from '../utils/api';

interface DataImporterProps {
  onDataImported: (data: any) => void;
}

const DataImporter: React.FC<DataImporterProps> = ({ onDataImported }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [modelName, setModelName] = useState<string>('');
  const [importing, setImporting] = useState<boolean>(false);
  const [importedData, setImportedData] = useState<any>(null);
  const [previewMode, setPreviewMode] = useState<boolean>(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState<boolean>(false);

  const validateData = (data: any): string[] => {
    const errors: string[] = [];

    if (!data.samples || !Array.isArray(data.samples)) {
      errors.push('El archivo debe contener un array de "samples"');
      return errors;
    }

    if (data.samples.length === 0) {
      errors.push('No se encontraron muestras en el archivo');
      return errors;
    }

    data.samples.forEach((sample: any, index: number) => {
      if (!sample.sign) {
        errors.push(`Muestra ${index + 1}: Falta el campo "sign"`);
      }

      if (!sample.landmarks || !Array.isArray(sample.landmarks)) {
        errors.push(`Muestra ${index + 1}: Falta el array "landmarks"`);
      } else if (sample.landmarks.length !== 21) {
        errors.push(`Muestra ${index + 1}: Debe contener exactamente 21 landmarks, encontrados ${sample.landmarks.length}`);
      } else {
        sample.landmarks.forEach((landmark: any, lIndex: number) => {
          if (typeof landmark.x !== 'number' || typeof landmark.y !== 'number' || typeof landmark.z !== 'number') {
            errors.push(`Muestra ${index + 1}, landmark ${lIndex + 1}: Coordenadas x, y, z deben ser números`);
          }
        });
      }
    });

    return errors.slice(0, 10);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === 'application/json') {
        setFile(droppedFile);
        setModelName(droppedFile.name.replace('.json', ''));
      } else {
        toast.error('Solo se aceptan archivos JSON');
      }
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/json') {
      setFile(selectedFile);
      setModelName(selectedFile.name.replace('.json', ''));
      setImportedData(null);
      setValidationErrors([]);
    } else {
      toast.error('Por favor selecciona un archivo JSON válido');
    }
  };

  const previewData = async () => {
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      const errors = validateData(data);
      setValidationErrors(errors);
      
      if (errors.length === 0) {
        setImportedData(data);
        setPreviewMode(true);
        toast.success('Archivo validado correctamente');
      } else {
        toast.error(`Se encontraron ${errors.length} errores en el archivo`);
      }
    } catch (error) {
      toast.error('Error al leer el archivo JSON. Verifica el formato.');
      setValidationErrors(['Archivo JSON inválido o corrupto']);
    }
  };

  const importData = async () => {
    if (!file || !modelName || !importedData) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    setImporting(true);
    try {
      const response = await api.post('/models/import', {
        name: modelName,
        data: importedData
      });

      onDataImported(response.data);
      toast.success(`Modelo "${modelName}" importado exitosamente con ${importedData.samples.length} muestras`);
      
      setFile(null);
      setModelName('');
      setImportedData(null);
      setPreviewMode(false);
      setValidationErrors([]);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Error al importar los datos';
      toast.error(errorMessage);
    } finally {
      setImporting(false);
    }
  };

  const downloadSampleFile = () => {
    const sampleData = {
      samples: [
        {
          sign: "A",
          landmarks: Array.from({ length: 21 }, (_, i) => ({
            x: Math.random(),
            y: Math.random(),
            z: Math.random() * 0.1
          })),
          timestamp: Date.now()
        },
        {
          sign: "B", 
          landmarks: Array.from({ length: 21 }, (_, i) => ({
            x: Math.random(),
            y: Math.random(),
            z: Math.random() * 0.1
          })),
          timestamp: Date.now()
        }
      ]
    };

    const blob = new Blob([JSON.stringify(sampleData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample-data.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const getUniqueSignsArray = () => {
    if (!importedData?.samples) return [];
    const signs = importedData.samples.map((s: any) => s.sign);
    return Array.from(new Set(signs)) as string[];
  };

  const getSampleDistribution = () => {
    if (!importedData?.samples) return {};
    const distribution: { [key: string]: number } = {};
    importedData.samples.forEach((sample: any) => {
      distribution[sample.sign] = (distribution[sample.sign] || 0) + 1;
    });
    return distribution;
  };

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
          className="text-4xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent mb-3"
        >
          Importar Datos
        </motion.h2>
        <p className="text-gray-600 text-lg">
          Importa conjuntos de datos de landmarks de manos desde archivos JSON
        </p>
      </div>

      <div className="max-w-4xl mx-auto space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                  <FiUpload className="text-purple-500" />
                  Seleccionar Archivo
                </h3>
                <button
                  onClick={downloadSampleFile}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors text-sm"
                >
                  <FiDownload />
                  Ejemplo
                </button>
              </div>

              <div
                className={`relative border-2 border-dashed rounded-2xl p-8 transition-all ${
                  dragActive 
                    ? 'border-purple-400 bg-purple-50' 
                    : file 
                    ? 'border-green-400 bg-green-50' 
                    : 'border-gray-300 bg-gray-50 hover:border-purple-400'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                
                <div className="text-center">
                  {file ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center justify-center w-16 h-16 mx-auto bg-green-100 rounded-full">
                        <FiCheck className="text-2xl text-green-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800">{file.name}</h4>
                        <p className="text-sm text-gray-600">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-center w-16 h-16 mx-auto bg-purple-100 rounded-full">
                        <FiFile className="text-2xl text-purple-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800">
                          Arrastra tu archivo JSON aquí
                        </h4>
                        <p className="text-sm text-gray-600">
                          o haz clic para seleccionar
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {file && !previewMode && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 flex gap-3"
                >
                  <button
                    onClick={previewData}
                    className="flex-1 bg-blue-500 text-white py-3 px-6 rounded-xl hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 font-semibold"
                  >
                    <FiEye />
                    Validar y Vista Previa
                  </button>
                  <button
                    onClick={() => {
                      setFile(null);
                      setImportedData(null);
                      setValidationErrors([]);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl transition-colors"
                  >
                    <FiX />
                  </button>
                </motion.div>
              )}
            </motion.div>

            <AnimatePresence>
              {validationErrors.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-50 border border-red-200 rounded-2xl p-6"
                >
                  <h3 className="text-lg font-semibold text-red-800 mb-4 flex items-center gap-2">
                    <FiAlertCircle />
                    Errores de Validación
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {validationErrors.map((error, index) => (
                      <div key={index} className="flex items-start gap-2 text-sm text-red-700">
                        <FiX className="text-red-500 mt-0.5 flex-shrink-0" />
                        <span>{error}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {previewMode && importedData && validationErrors.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100"
                >
                  <h3 className="text-xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
                    <FiDatabase className="text-green-500" />
                    Configurar Importación
                  </h3>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nombre del Modelo *
                      </label>
                      <input
                        type="text"
                        value={modelName}
                        onChange={(e) => setModelName(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                        placeholder="Ej: Modelo de Vocales Importado"
                      />
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={importData}
                      disabled={importing || !modelName.trim()}
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 px-6 rounded-xl font-semibold hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-3"
                    >
                      {importing ? (
                        <>
                          <FiLoader className="animate-spin" />
                          Importando...
                        </>
                      ) : (
                        <>
                          <FiUpload />
                          Importar Modelo
                        </>
                      )}
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-200"
            >
              <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center gap-2">
                <FiInfo />
                Formato Requerido
              </h3>
              <div className="bg-white p-4 rounded-xl border border-blue-200">
                <pre className="text-xs text-gray-700 overflow-x-auto">
{`{
  "samples": [
    {
      "sign": "A",
      "landmarks": [
        {"x": 0.1, "y": 0.2, "z": 0.3},
        {"x": 0.4, "y": 0.5, "z": 0.6},
        // ... 19 landmarks más
      ],
      "timestamp": 1640995200000
    }
  ]
}`}
                </pre>
              </div>
            </motion.div>

            <AnimatePresence>
              {importedData && validationErrors.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100"
                >
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    Resumen de Datos
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 bg-purple-50 rounded-xl">
                        <div className="text-2xl font-bold text-purple-600">
                          {importedData.samples?.length || 0}
                        </div>
                        <div className="text-sm text-purple-800">Muestras</div>
                      </div>
                      <div className="text-center p-4 bg-blue-50 rounded-xl">
                        <div className="text-2xl font-bold text-blue-600">
                          {getUniqueSignsArray().length}
                        </div>
                        <div className="text-sm text-blue-800">Señas</div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-700 mb-3">
                        Distribución de Señas:
                      </h4>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {Object.entries(getSampleDistribution()).map(([sign, count]) => (
                          <div key={sign} className="flex justify-between items-center text-sm">
                            <span className="font-medium text-gray-700">{sign}</span>
                            <span className="px-2 py-1 bg-gray-100 rounded text-gray-600">
                              {count}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-200">
              <h3 className="font-semibold text-yellow-800 mb-2">
                Recomendaciones
              </h3>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• Mínimo 21 landmarks por muestra</li>
                <li>• Al menos 50 muestras por seña</li>
                <li>• Coordenadas normalizadas (0-1)</li>
                <li>• Formato JSON válido</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default DataImporter;