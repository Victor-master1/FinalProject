import { Hands, Results } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

export class MediaPipeHandler {
  private hands: Hands | null = null;
  private camera: Camera | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private onResultsCallback: ((results: Results) => void) | null = null;
  private stream: MediaStream | null = null;
  private animationId: number | null = null;

  async initialize(
    videoElement: HTMLVideoElement,
    canvasElement: HTMLCanvasElement,
    onResults: (results: Results) => void
  ): Promise<boolean> {
    try {
      this.videoElement = videoElement;
      this.canvasElement = canvasElement;
      this.onResultsCallback = onResults;

      console.log('Inicializando MediaPipe...');

      this.hands = new Hands({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
      });

      this.hands.setOptions({
        maxNumHands: 2, // 👈 ahora soporta dos manos
        modelComplexity: 1,
        minDetectionConfidence: 0.8,
        minTrackingConfidence: 0.7
      });

      this.hands.onResults((results: Results) => {
        this.handleResults(results);
      });

      await this.startCamera();

      console.log('MediaPipe inicializado correctamente (dos manos)');
      return true;

    } catch (error) {
      console.error('Error initializing MediaPipe:', error);
      return false;
    }
  }

  private async startCamera(): Promise<void> {
    if (!this.videoElement || !this.hands) return;

    try {
      console.log('Iniciando cámara...');
     
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });

      this.videoElement.srcObject = this.stream;

      return new Promise((resolve, reject) => {
        if (!this.videoElement) {
          reject(new Error('Video element not available'));
          return;
        }

        this.videoElement.onloadedmetadata = () => {
          if (!this.videoElement || !this.hands) {
            reject(new Error('Required elements not available'));
            return;
          }

          this.videoElement.play().then(() => {
            if (this.canvasElement && this.videoElement) {
              this.canvasElement.width = this.videoElement.videoWidth || 640;
              this.canvasElement.height = this.videoElement.videoHeight || 480;
            }

            console.log('Video cargado, iniciando procesamiento...');
            this.startProcessing();
            resolve();
          }).catch(reject);
        };

        this.videoElement.onerror = () => {
          reject(new Error('Error loading video'));
        };
      });

    } catch (error) {
      console.error('Error starting camera:', error);
      throw error;
    }
  }

  private startProcessing(): void {
    const processFrame = async () => {
      if (this.hands && this.videoElement && this.videoElement.readyState === 4) {
        try {
          await this.hands.send({ image: this.videoElement });
        } catch (error) {
          console.error('Error processing frame:', error);
        }
      }
     
      if (this.hands) {
        this.animationId = requestAnimationFrame(processFrame);
      }
    };

    processFrame();
  }

  private handleResults(results: Results): void {
    if (!this.canvasElement || !this.onResultsCallback) return;

    const ctx = this.canvasElement.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);

    if (this.videoElement) {
      ctx.drawImage(this.videoElement, 0, 0, this.canvasElement.width, this.canvasElement.height);
    }

    // 👇 soporta múltiples manos
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      results.multiHandLandmarks.forEach((landmarks, i) => {
        const handedness = results.multiHandedness?.[i]?.label || "Desconocida";
        console.log(`Mano detectada: ${handedness}`);
        this.drawLandmarks(ctx, landmarks, handedness);
      });
    }

    ctx.restore();

    if (this.onResultsCallback) {
      this.onResultsCallback(results);
    }
  }

  private drawLandmarks(ctx: CanvasRenderingContext2D, landmarks: any[], handedness: string): void {
    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [0, 5], [5, 6], [6, 7], [7, 8],
      [5, 9], [9, 10], [10, 11], [11, 12],
      [9, 13], [13, 14], [14, 15], [15, 16],
      [13, 17], [17, 18], [18, 19], [19, 20],
      [0, 17]
    ];

    // 👇 cada mano tiene color distinto
    ctx.strokeStyle = handedness === "Left" ? '#00FF00' : '#00FF00';
    ctx.lineWidth = 3;

    connections.forEach(([start, end]) => {
      const startPoint = landmarks[start];
      const endPoint = landmarks[end];
      ctx.beginPath();
      ctx.moveTo(startPoint.x * ctx.canvas.width, startPoint.y * ctx.canvas.height);
      ctx.lineTo(endPoint.x * ctx.canvas.width, endPoint.y * ctx.canvas.height);
      ctx.stroke();
    });

    ctx.fillStyle = handedness === "Left" ? '#FF0000' : '#FFA500';
    landmarks.forEach((landmark) => {
      const x = landmark.x * ctx.canvas.width;
      const y = landmark.y * ctx.canvas.height;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fill();
    });
  }

  stop(): void {
    console.log('Deteniendo MediaPipe...');
   
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    if (this.hands) {
      this.hands.close();
      this.hands = null;
    }

    if (this.stream) {
      const tracks = this.stream.getTracks();
      tracks.forEach(track => track.stop());
      this.stream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
  }

  isInitialized(): boolean {
    return this.hands !== null;
  }
}

export const createMediaPipeHandler = (): MediaPipeHandler => {
  return new MediaPipeHandler();
};
