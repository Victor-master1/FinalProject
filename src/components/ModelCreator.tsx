import React, { useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FiCheck, FiLoader, FiPlus } from 'react-icons/fi';
import { api } from '../utils/api';

interface ModelCreatorProps {
  onModelCreated: (model: any) => void;
}

const ModelCreator: React.FC<ModelCreatorProps> = ({ onModelCreated }) => {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [modelName, setModelName] = useState<string>('');
  const [customSigns, setCustomSigns] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const templates = [
    {
      id: 'vowels',
      name: 'Vocales',
      description: 'Reconocimiento de vocales A, E, I, O, U',
      signs: ['A', 'E', 'I', 'O', 'U'],
      gradient: 'from-pink-500 to-rose-500',
      icon: '🔤'
    },
    {
      id: 'alphabet',
      name: 'Abecedario',
      description: 'Todas las letras del alfabeto',
      signs: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'],
      gradient: 'from-blue-500 to-cyan-500',
      icon: '🔠'
    },
    {
      id: 'numbers',
      name: 'Números',
      description: 'Números del 0-9 y operaciones básicas',
      signs: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '-', 'x', '/'],
      gradient: 'from-green-500 to-emerald-500',
      icon: '🔢'
    },
    {
      id: 'greetings',
      name: 'Saludos',
      description: 'Saludos y expresiones comunes',
      signs: ['HOLA', 'ADIOS', 'GRACIAS', 'POR FAVOR', 'BIEN', 'MAL'],
      gradient: 'from-purple-500 to-indigo-500',
      icon: '👋'
    },
    {
      id: 'custom',
      name: 'Personalizado',
      description: 'Define tus propias señas',
      signs: [],
      gradient: 'from-orange-500 to-red-500',
      icon: '⚙️'
    }
  ];

  const handleCreateModel = async () => {
    if (!modelName || !selectedTemplate) {
      toast.error('Completa todos los campos requeridos');
      return;
    }

    setLoading(true);
    try {
      let signs = [];
      if (selectedTemplate === 'custom') {
        signs = customSigns.split(',').map(s => s.trim()).filter(s => s);
        if (signs.length === 0) {
          toast.error('Agrega al menos una seña personalizada');
          setLoading(false);
          return;
        }
      } else {
        const template = templates.find(t => t.id === selectedTemplate);
        signs = template?.signs || [];
      }

      const modelData = {
        name: modelName,
        template: selectedTemplate,
        signs,
        createdAt: new Date().toISOString()
      };

      const response = await api.post('/models/create', modelData);
      onModelCreated(response.data);
      
      setModelName('');
      setSelectedTemplate('');
      setCustomSigns('');
      
      toast.success('¡Modelo creado exitosamente!', {
        icon: '🎉',
        duration: 3000,
      });
    } catch (error) {
      toast.error('Error al crear el modelo');
    } finally {
      setLoading(false);
    }
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
          className="text-4xl font-bold text-gray-800 mb-3 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
        >
          Crear Nuevo Modelo
        </motion.h2>
        <p className="text-gray-600 text-lg">
          Selecciona una plantilla o crea un modelo personalizado
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {templates.map((template, index) => (
          <motion.div
            key={template.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.02, y: -5 }}
            onClick={() => setSelectedTemplate(template.id)}
            className={`relative p-6 rounded-2xl cursor-pointer transition-all duration-300 border-2 ${
              selectedTemplate === template.id
                ? 'border-blue-500 shadow-2xl shadow-blue-500/25 bg-gradient-to-br from-blue-50 to-indigo-50'
                : 'border-gray-200 hover:border-blue-300 hover:shadow-xl bg-white'
            }`}
          >
            {selectedTemplate === template.id && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center"
              >
                <FiCheck className="text-white text-sm" />
              </motion.div>
            )}

            <div className="text-center">
              <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br ${template.gradient} flex items-center justify-center text-2xl shadow-lg`}>
                {template.icon}
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                {template.name}
              </h3>
              <p className="text-gray-600 text-sm mb-4">
                {template.description}
              </p>

              {template.signs.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center">
                  {template.signs.slice(0, 6).map((sign, idx) => (
                    <span 
                      key={idx} 
                      className="px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-700 font-medium"
                    >
                      {sign}
                    </span>
                  ))}
                  {template.signs.length > 6 && (
                    <span className="px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-700 font-medium">
                      +{template.signs.length - 6}
                    </span>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {selectedTemplate && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.3 }}
          className="bg-gradient-to-br from-gray-50 to-gray-100 p-8 rounded-2xl border border-gray-200 shadow-inner"
        >
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Nombre del Modelo
              </label>
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white"
                placeholder="Ej: Mi modelo de vocales"
              />
            </div>

            {selectedTemplate === 'custom' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Señas Personalizadas (separadas por comas)
                </label>
                <textarea
                  value={customSigns}
                  onChange={(e) => setCustomSigns(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white"
                  rows={4}
                  placeholder="Ej: CASA, CARRO, AGUA, COMIDA, TRABAJO, ESCUELA"
                />
                {customSigns && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {customSigns.split(',').map((sign, idx) => sign.trim() && (
                      <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                        {sign.trim()}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleCreateModel}
              disabled={loading || !modelName}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <FiLoader className="animate-spin" />
                  Creando modelo...
                </>
              ) : (
                <>
                  <FiPlus />
                  Crear Modelo
                </>
              )}
            </motion.button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default ModelCreator;