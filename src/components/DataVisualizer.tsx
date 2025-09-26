import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement, RadialLinearScale, ChartOptions} from 'chart.js';
import { Line, Bar, Scatter, Doughnut, Radar } from 'react-chartjs-2';
import { FiTrendingUp, FiPieChart, FiMap, FiTarget, FiDownload, FiRefreshCw, FiInfo, FiActivity, FiBarChart, FiFilter } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { api } from '../utils/api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement, RadialLinearScale);

interface DataVisualizerProps {
  models: any[];
}

const DataVisualizer: React.FC<DataVisualizerProps> = ({ models }) => {
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [visualizationData, setVisualizationData] = useState<any>(null);
  const [activeChart, setActiveChart] = useState<string>('distribution');
  const [loading, setLoading] = useState<boolean>(false);
  const [filterByConfidence, setFilterByConfidence] = useState<boolean>(false);
  const [minConfidence, setMinConfidence] = useState<number>(0.7);
  const [showAnimations, setShowAnimations] = useState<boolean>(true);

  useEffect(() => {
    if (selectedModel) {
      loadVisualizationData();
    }
  }, [selectedModel, filterByConfidence, minConfidence]);

  const loadVisualizationData = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/models/${selectedModel}/visualization`, {
        params: { filterByConfidence, minConfidence }
      });
      setVisualizationData(response.data);
    } catch (error) {
      console.error('Error loading visualization data:', error);
      toast.error('Error al cargar los datos de visualización');
    } finally {
      setLoading(false);
    }
  };

  const chartTypes = [
    { id: 'distribution', name: 'Distribución', icon: FiPieChart, color: 'from-blue-500 to-indigo-500' },
    { id: 'landmarks', name: 'Landmarks', icon: FiMap, color: 'from-green-500 to-emerald-500' },
    { id: 'training', name: 'Entrenamiento', icon: FiTrendingUp, color: 'from-purple-500 to-violet-500' },
    { id: 'accuracy', name: 'Precisión', icon: FiTarget, color: 'from-orange-500 to-red-500' },
    { id: 'performance', name: 'Rendimiento', icon: FiActivity, color: 'from-cyan-500 to-blue-500' }
  ];

  const getDistributionChart = () => {
    if (!visualizationData?.distribution) return null;

    const colors = [
      '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', 
      '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF',
      '#4BC0C0', '#FF6384'
    ];

    return {
      labels: Object.keys(visualizationData.distribution),
      datasets: [{
        label: 'Muestras',
        data: Object.values(visualizationData.distribution),
        backgroundColor: colors.slice(0, Object.keys(visualizationData.distribution).length),
        borderColor: colors.slice(0, Object.keys(visualizationData.distribution).length).map(color => color + 'DD'),
        borderWidth: 2,
        hoverOffset: 10
      }]
    };
  };

  const getLandmarksChart = () => {
    if (!visualizationData?.landmarks) return null;

    const datasets = Object.keys(visualizationData.landmarks).map((sign, index) => ({
      label: sign,
      data: visualizationData.landmarks[sign].slice(0, 50).map((point: any) => ({
        x: point.x,
        y: point.y
      })),
      backgroundColor: `hsla(${index * 60}, 70%, 50%, 0.6)`,
      borderColor: `hsla(${index * 60}, 70%, 50%, 1)`,
      pointRadius: 3,
      pointHoverRadius: 5
    }));

    return { datasets };
  };

  const getTrainingChart = () => {
    if (!visualizationData?.training) return null;

    return {
      labels: visualizationData.training.epochs.map((epoch: number) => `Época ${epoch}`),
      datasets: [
        {
          label: 'Precisión',
          data: visualizationData.training.accuracy,
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: 'rgb(34, 197, 94)',
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        },
        {
          label: 'Pérdida',
          data: visualizationData.training.loss,
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          fill: true,
          tension: 0.4,
          yAxisID: 'y1',
          pointBackgroundColor: 'rgb(239, 68, 68)',
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        }
      ]
    };
  };

  const getAccuracyChart = () => {
    if (!visualizationData?.accuracy) return null;

    const data = Object.entries(visualizationData.accuracy).sort(([,a], [,b]) => (b as number) - (a as number));

    return {
      labels: data.map(([sign]) => sign),
      datasets: [{
        label: 'Precisión (%)',
        data: data.map(([, accuracy]) => (accuracy as number) * 100),
        backgroundColor: data.map((_, index) => `hsla(${120 - (index * 15)}, 70%, 50%, 0.8)`),
        borderColor: data.map((_, index) => `hsla(${120 - (index * 15)}, 70%, 40%, 1)`),
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false
      }]
    };
  };

  const getPerformanceChart = () => {
    if (!visualizationData?.performance) return null;

    return {
      labels: ['Velocidad', 'Precisión', 'Estabilidad', 'Consistencia'],
      datasets: [{
        label: 'Métricas de Rendimiento',
        data: [
          visualizationData.performance.speed * 100,
          visualizationData.performance.accuracy * 100,
          visualizationData.performance.stability * 100,
          visualizationData.performance.consistency * 100
        ],
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(34, 197, 94, 0.8)', 
          'rgba(168, 85, 247, 0.8)',
          'rgba(251, 146, 60, 0.8)'
        ],
        borderColor: [
          'rgba(59, 130, 246, 1)',
          'rgba(34, 197, 94, 1)',
          'rgba(168, 85, 247, 1)', 
          'rgba(251, 146, 60, 1)'
        ],
        borderWidth: 2,
        pointBackgroundColor: '#fff',
        pointBorderWidth: 3,
        pointRadius: 6
      }]
    };
  };

  const renderChart = () => {
    if (!visualizationData) return null;

    const commonOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
          labels: {
            usePointStyle: true,
            padding: 20,
            font: { size: 12, weight: 'bold' }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: '#374151',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 12
        }
      },
      animation: {
        duration: showAnimations ? 1000 : 0,
        easing: 'easeOutCubic'
      }
    };

    switch (activeChart) {
      case 'distribution':
        const distributionData = getDistributionChart();
        return distributionData ? (
          <Doughnut
            data={distributionData}
            options={{
              ...commonOptions,
              cutout: '50%',
              plugins: {
                ...commonOptions.plugins,
                legend: {
                  ...commonOptions.plugins.legend,
                  position: 'right'
                }
              }
            } as ChartOptions<'doughnut'>}
          />
        ) : null;

      case 'landmarks':
        const landmarksData = getLandmarksChart();
        return landmarksData ? (
          <Scatter
            data={landmarksData}
            options={{
              ...commonOptions,
              scales: {
                x: {
                  title: { display: true, text: 'Coordenada X', font: { weight: 'bold' } },
                  grid: { color: 'rgba(0, 0, 0, 0.1)' }
                },
                y: {
                  title: { display: true, text: 'Coordenada Y', font: { weight: 'bold' } },
                  grid: { color: 'rgba(0, 0, 0, 0.1)' }
                }
              }
            } as ChartOptions<'scatter'>}
          />
        ) : null;

      case 'training':
        const trainingData = getTrainingChart();
        return trainingData ? (
          <Line
            data={trainingData}
            options={{
              ...commonOptions,
              scales: {
                y: {
                  type: 'linear',
                  display: true,
                  position: 'left',
                  title: { display: true, text: 'Precisión', font: { weight: 'bold' } },
                  grid: { color: 'rgba(34, 197, 94, 0.1)' }
                },
                y1: {
                  type: 'linear',
                  display: true,
                  position: 'right',
                  title: { display: true, text: 'Pérdida', font: { weight: 'bold' } },
                  grid: { drawOnChartArea: false, color: 'rgba(239, 68, 68, 0.1)' }
                },
                x: {
                  grid: { color: 'rgba(0, 0, 0, 0.1)' }
                }
              }
            } as ChartOptions<'line'>}
          />
        ) : null;

      case 'accuracy':
        const accuracyData = getAccuracyChart();
        return accuracyData ? (
          <Bar
            data={accuracyData}
            options={{
              ...commonOptions,
              scales: {
                y: {
                  beginAtZero: true,
                  max: 100,
                  title: { display: true, text: 'Precisión (%)', font: { weight: 'bold' } },
                  grid: { color: 'rgba(0, 0, 0, 0.1)' }
                },
                x: {
                  grid: { display: false }
                }
              }
            } as ChartOptions<'bar'>}
          />
        ) : null;

      case 'performance':
        const performanceData = getPerformanceChart();
        return performanceData ? (
          <Radar
            data={performanceData}
            options={{
              ...commonOptions,
              scales: {
                r: {
                  beginAtZero: true,
                  max: 100,
                  grid: { color: 'rgba(0, 0, 0, 0.1)' },
                  pointLabels: { font: { weight: 'bold' } }
                }
              },
              elements: {
                line: { borderWidth: 3 },
                point: { radius: 6 }
              }
            } as ChartOptions<'radar'>}
          />
        ) : null;

      default:
        return null;
    }
  };

  const exportData = () => {
    if (!visualizationData) return;

    const exportData = {
      model: selectedModel,
      data: visualizationData,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${selectedModel}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Datos exportados correctamente');
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
          className="text-4xl font-bold bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent mb-3"
        >
          Analytics Avanzado
        </motion.h2>
        <p className="text-gray-600 text-lg">
          Análisis profundo del rendimiento y distribución de datos
        </p>
      </div>

      <div className="max-w-7xl mx-auto space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-1 space-y-6"
          >
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
              <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FiFilter className="text-cyan-500" />
                Configuración
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Modelo a Analizar
                  </label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
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
                  <div className="bg-gradient-to-br from-cyan-50 to-blue-50 p-4 rounded-xl border border-cyan-200">
                    <h4 className="font-semibold text-cyan-800 mb-2">Información del Modelo</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-cyan-700">Plantilla:</span>
                        <span className="font-medium text-cyan-900">{selectedModelData.template}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-cyan-700">Señas:</span>
                        <span className="font-medium text-cyan-900">{selectedModelData.signs?.length || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-cyan-700">Creado:</span>
                        <span className="font-medium text-cyan-900">
                          {new Date(selectedModelData.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">
                      Filtrar por Confianza
                    </label>
                    <input
                      type="checkbox"
                      checked={filterByConfidence}
                      onChange={(e) => setFilterByConfidence(e.target.checked)}
                      className="w-4 h-4 text-cyan-500 rounded focus:ring-cyan-500"
                    />
                  </div>
                  
                  {filterByConfidence && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Confianza Mínima: {(minConfidence * 100).toFixed(0)}%
                      </label>
                      <input
                        type="range"
                        min="0.3"
                        max="0.95"
                        step="0.05"
                        value={minConfidence}
                        onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">
                      Animaciones
                    </label>
                    <input
                      type="checkbox"
                      checked={showAnimations}
                      onChange={(e) => setShowAnimations(e.target.checked)}
                      className="w-4 h-4 text-cyan-500 rounded focus:ring-cyan-500"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={loadVisualizationData}
                    disabled={!selectedModel || loading}
                    className="flex-1 flex items-center justify-center gap-2 bg-cyan-500 text-white py-3 px-4 rounded-xl hover:bg-cyan-600 disabled:opacity-50 transition-colors font-semibold"
                  >
                    <FiRefreshCw className={loading ? 'animate-spin' : ''} />
                    {loading ? 'Cargando...' : 'Actualizar'}
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={exportData}
                    disabled={!visualizationData}
                    className="flex items-center justify-center gap-2 bg-green-500 text-white py-3 px-4 rounded-xl hover:bg-green-600 disabled:opacity-50 transition-colors"
                  >
                    <FiDownload />
                  </motion.button>
                </div>
              </div>
            </div>

            {visualizationData && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100"
              >
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <FiInfo className="text-blue-500" />
                  Resumen Estadístico
                </h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {visualizationData.totalSamples || 0}
                    </div>
                    <div className="text-xs text-blue-800">Muestras</div>
                  </div>
                  
                  <div className="bg-green-50 p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {visualizationData.uniqueSigns || 0}
                    </div>
                    <div className="text-xs text-green-800">Señas</div>
                  </div>
                  
                  <div className="bg-purple-50 p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {visualizationData.averageAccuracy ? 
                        `${(visualizationData.averageAccuracy * 100).toFixed(1)}%` : 'N/A'}
                    </div>
                    <div className="text-xs text-purple-800">Precisión</div>
                  </div>
                  
                  <div className="bg-orange-50 p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {visualizationData.modelHealth ? 
                        `${(visualizationData.modelHealth * 100).toFixed(0)}%` : 'N/A'}
                    </div>
                    <div className="text-xs text-orange-800">Salud</div>
                  </div>
                </div>

                {visualizationData.insights && (
                  <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <h4 className="font-semibold text-yellow-800 mb-2">Insights</h4>
                    <ul className="text-sm text-yellow-700 space-y-1">
                      {visualizationData.insights.map((insight: string, index: number) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-yellow-600 mt-1">•</span>
                          {insight}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-3 space-y-6"
          >
            {selectedModel && (
              <>
                <motion.nav
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="flex flex-wrap gap-3">
                    {chartTypes.map((chart, index) => (
                      <motion.button
                        key={chart.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.1 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setActiveChart(chart.id)}
                        className={`flex items-center gap-3 px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
                          activeChart === chart.id
                            ? `bg-gradient-to-r ${chart.color} text-white shadow-lg`
                            : 'bg-white text-gray-700 hover:bg-gray-50 shadow-md border border-gray-200'
                        }`}
                      >
                        <chart.icon className="text-lg" />
                        {chart.name}
                      </motion.button>
                    ))}
                  </div>
                </motion.nav>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeChart}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100"
                  >
                    {loading ? (
                      <div className="text-center py-20">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                          className="w-12 h-12 mx-auto mb-4 border-4 border-cyan-200 border-t-cyan-600 rounded-full"
                        />
                        <p className="text-gray-600 text-lg">Procesando datos...</p>
                      </div>
                    ) : visualizationData ? (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                            {React.createElement(chartTypes.find(c => c.id === activeChart)?.icon || FiBarChart, {
                              className: `text-3xl bg-gradient-to-r ${chartTypes.find(c => c.id === activeChart)?.color} bg-clip-text text-transparent`
                            })}
                            {chartTypes.find(c => c.id === activeChart)?.name}
                          </h3>
                          
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            En tiempo real
                          </div>
                        </div>
                        
                        <div className="h-96 w-full">
                          {renderChart()}
                        </div>

                        {activeChart === 'distribution' && visualizationData.distribution && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
                            {Object.entries(visualizationData.distribution).map(([sign, count]) => (
                              <div key={sign} className="text-center p-3 bg-gray-50 rounded-lg">
                                <div className="font-bold text-lg text-gray-800">{count as number}</div>
                                <div className="text-sm text-gray-600">{sign}</div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {((count as number) / visualizationData.totalSamples * 100).toFixed(1)}%
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-20">
                        <div className="text-6xl mb-6 opacity-50">📊</div>
                        <h3 className="text-xl font-semibold text-gray-700 mb-2">
                          Sin datos de visualización
                        </h3>
                        <p className="text-gray-500 mb-6">
                          No hay datos disponibles para este modelo
                        </p>
                        <button
                          onClick={loadVisualizationData}
                          className="px-6 py-3 bg-cyan-500 text-white rounded-xl hover:bg-cyan-600 transition-colors font-semibold"
                        >
                          Generar Datos de Prueba
                        </button>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </>
            )}

            {!selectedModel && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gradient-to-br from-cyan-50 to-blue-50 p-12 rounded-2xl border border-cyan-200 text-center"
              >
                <div className="text-6xl mb-6">🎯</div>
                <h3 className="text-2xl font-bold text-gray-800 mb-4">
                  Selecciona un Modelo para Comenzar
                </h3>
                <p className="text-gray-600 text-lg">
                  Elige un modelo desde el panel de configuración para ver análisis detallados
                </p>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

export default DataVisualizer;