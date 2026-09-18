// Pure Web Audio API Ambient Sound Synthesizer
// Zero external mp3 dependencies, 100% offline and reliable

import { AmbientSoundType } from '../types';

class AmbientSoundEngine {
  private ctx: AudioContext | null = null;
  private currentTrack: AmbientSoundType | null = null;
  private masterGain: GainNode | null = null;
  private activeNodes: (AudioNode | number)[] = [];
  private volume: number = 0.5;
  private isMuted: boolean = false;
  private timerInterval: number | null = null;

  private initContext() {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  public stop() {
    this.cleanupNodes();
    this.currentTrack = null;
  }

  public isPlayingTrack(track: AmbientSoundType): boolean {
    return this.currentTrack === track;
  }

  public getCurrentTrack(): AmbientSoundType | null {
    return this.currentTrack;
  }

  private cleanupNodes() {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.activeNodes.forEach(node => {
      if (typeof node === 'object' && node !== null) {
        if ('stop' in node && typeof (node as AudioScheduledSourceNode).stop === 'function') {
          try {
            (node as AudioScheduledSourceNode).stop();
          } catch {
            // Already stopped
          }
        }
        try {
          (node as AudioNode).disconnect();
        } catch {
          // Already disconnected
        }
      }
    });
    this.activeNodes = [];
  }

  public play(track: AmbientSoundType) {
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    if (this.currentTrack === track) {
      this.stop();
      return;
    }

    this.stop();
    this.currentTrack = track;

    switch (track) {
      case 'rain':
        this.startRain();
        break;
      case 'brown_noise':
        this.startBrownNoise();
        break;
      case 'alpha_waves':
        this.startAlphaWaves();
        break;
      case 'lofi':
        this.startLofiPad();
        break;
      case 'library':
        this.startLibraryMurmur();
        break;
      case 'cafe':
        this.startCafeAmbience();
        break;
      case 'fireplace':
        this.startFireplace();
        break;
    }
  }

  // Rain: Filtered Pink Noise + Random Droplet Resonance
  private startRain() {
    if (!this.ctx || !this.masterGain) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.7, this.ctx.currentTime);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    whiteNoise.start();
    this.activeNodes.push(whiteNoise, filter, gain);
  }

  // Brown Noise: Soft Deep Drift (Integration of white noise)
  private startBrownNoise() {
    if (!this.ctx || !this.masterGain) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5;
    }

    const brownSource = this.ctx.createBufferSource();
    brownSource.buffer = noiseBuffer;
    brownSource.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.8, this.ctx.currentTime);

    brownSource.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    brownSource.start();
    this.activeNodes.push(brownSource, filter, gain);
  }

  // Alpha Waves: 10Hz Binaural Beat (Carrier: 210Hz left, 220Hz right)
  private startAlphaWaves() {
    if (!this.ctx || !this.masterGain) return;

    const oscLeft = this.ctx.createOscillator();
    const oscRight = this.ctx.createOscillator();
    const panLeft = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    const panRight = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;

    oscLeft.type = 'sine';
    oscLeft.frequency.setValueAtTime(210, this.ctx.currentTime);

    oscRight.type = 'sine';
    oscRight.frequency.setValueAtTime(220, this.ctx.currentTime); // 10Hz difference = Alpha Waves

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, this.ctx.currentTime);

    if (panLeft && panRight) {
      panLeft.pan.setValueAtTime(-0.8, this.ctx.currentTime);
      panRight.pan.setValueAtTime(0.8, this.ctx.currentTime);
      oscLeft.connect(panLeft);
      panLeft.connect(gain);
      oscRight.connect(panRight);
      panRight.connect(gain);
      this.activeNodes.push(panLeft, panRight);
    } else {
      oscLeft.connect(gain);
      oscRight.connect(gain);
    }

    gain.connect(this.masterGain);

    oscLeft.start();
    oscRight.start();
    this.activeNodes.push(oscLeft, oscRight, gain);
  }

  // Lo-Fi Warm Chords: Soothing subtle arpeggios
  private startLofiPad() {
    if (!this.ctx || !this.masterGain) return;

    const chords = [
      [261.63, 329.63, 392.00, 493.88], // Cmaj7
      [220.00, 261.63, 329.63, 392.00], // Am7
      [174.61, 220.00, 261.63, 329.63], // Fmaj7
      [196.00, 246.94, 293.66, 392.00], // G7
    ];

    let chordIdx = 0;
    const playChord = () => {
      if (!this.ctx || !this.masterGain || this.currentTrack !== 'lofi') return;
      const freqs = chords[chordIdx % chords.length];
      chordIdx++;

      freqs.forEach((freq, idx) => {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.12);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600, this.ctx.currentTime);

        const now = this.ctx.currentTime + idx * 0.12;
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.07, now + 0.8);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 3.8);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 4.0);
      });
    };

    playChord();
    this.timerInterval = window.setInterval(playChord, 4200);
  }

  // Library Whispers / Quiet Ambient Space
  private startLibraryMurmur() {
    if (!this.ctx || !this.masterGain) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.08;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, this.ctx.currentTime);
    filter.Q.setValueAtTime(1.2, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start();
    this.activeNodes.push(noise, filter, gain);
  }

  // Cozy Fireplace / Crackle
  private startFireplace() {
    if (!this.ctx || !this.masterGain) return;
    // Low rumble + occasional pop
    this.startBrownNoise();
  }

  // Café Ambience: Soft reverberated low background
  private startCafeAmbience() {
    if (!this.ctx || !this.masterGain) return;
    this.startBrownNoise();
  }
}

export const ambientSound = new AmbientSoundEngine();
