const { NlpManager } = require('node-nlp');

class SignLanguageNLP {
  constructor() {
    this.manager = new NlpManager({ languages: ['es'], forceNER: true });
    this.setupIntents();
    this.trainModel();
  }

  setupIntents() {
    this.manager.addDocument('es', 'hola', 'greeting');
    this.manager.addDocument('es', 'buenos días', 'greeting');
    this.manager.addDocument('es', 'buenas tardes', 'greeting');
    this.manager.addDocument('es', 'buenas noches', 'greeting');

    this.manager.addDocument('es', 'adiós', 'farewell');
    this.manager.addDocument('es', 'hasta luego', 'farewell');
    this.manager.addDocument('es', 'nos vemos', 'farewell');

    this.manager.addDocument('es', 'gracias', 'gratitude');
    this.manager.addDocument('es', 'muchas gracias', 'gratitude');

    this.manager.addDocument('es', 'por favor', 'request');
    this.manager.addDocument('es', 'ayuda', 'help');

    this.manager.addAnswer('es', 'greeting', '¡Hola! Es un gusto verte.');
    this.manager.addAnswer('es', 'greeting', '¡Buenos días! ¿Cómo estás?');
    this.manager.addAnswer('es', 'farewell', '¡Hasta luego! Que tengas un buen día.');
    this.manager.addAnswer('es', 'gratitude', '¡De nada! Siempre es un placer ayudar.');
    this.manager.addAnswer('es', 'request', 'Por supuesto, estoy aquí para ayudarte.');
    this.manager.addAnswer('es', 'help', '¿En qué puedo ayudarte hoy?');
  }

  async trainModel() {
    await this.manager.train();
    this.manager.save();
  }

  async generateResponse(text, context = {}) {
    try {
      const response = await this.manager.process('es', text.toLowerCase());
      
      if (response.answer) {
        return response.answer;
      }

      const words = text.toLowerCase().split(' ');
      const signWords = this.processSignLanguageText(words);
      
      if (signWords.length > 0) {
        return this.constructSentence(signWords);
      }

      return `Has expresado: ${text}`;
    } catch (error) {
      console.error('NLP Error:', error);
      return `Mensaje recibido: ${text}`;
    }
  }

  processSignLanguageText(words) {
    const signDictionary = {
      'a': 'la letra A',
      'b': 'la letra B',
      'c': 'la letra C',
      'd': 'la letra D',
      'e': 'la letra E',
      'i': 'la letra I',
      'o': 'la letra O',
      'u': 'la letra U',
      '1': 'el número uno',
      '2': 'el número dos',
      '3': 'el número tres',
      '4': 'el número cuatro',
      '5': 'el número cinco',
      '+': 'más',
      '-': 'menos',
      'x': 'por',
      '/': 'dividido',
      'hola': 'hola',
      'adios': 'adiós',
      'gracias': 'gracias'
    };

    return words.map(word => signDictionary[word] || word);
  }

  constructSentence(words) {
    if (words.length === 1) {
      return `Has expresado ${words[0]}.`;
    }

    if (words.length === 2) {
      return `Has expresado ${words[0]} y ${words[1]}.`;
    }

    const lastWord = words.pop();
    return `Has expresado ${words.join(', ')} y ${lastWord}.`;
  }
}

const nlpInstance = new SignLanguageNLP();

const generateResponse = async (text, context) => {
  return await nlpInstance.generateResponse(text, context);
};

module.exports = {
  generateResponse,
  SignLanguageNLP
};