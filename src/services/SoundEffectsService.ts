export class SoundEffectsService {
  /** Master toggle — gates every sound. Set from settings. */
  public static enabled: boolean = true;

  public static setEnabled(enabled: boolean): void {
    SoundEffectsService.enabled = enabled;
  }

  private audioContext: AudioContext | null = null;

  constructor() {
    this.initAudioContext();
  }

  private initAudioContext() {
    try {
      this.audioContext = new AudioContext();
    } catch (err) {
      console.warn('AudioContext not available — sound effects will be disabled:', err);
    }
  }

  /**
   * Plays a short beep at the given frequency and duration.
   */
  public playBeep(frequency: number = 800, duration: number = 100) {
    if (!SoundEffectsService.enabled || !this.audioContext) return;

    // Resume context if suspended (browsers suspend AudioContext until user gesture)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);

    gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + duration / 1000);
  }

  public playStartupSound() {
    if (!this.audioContext) return;

    const frequencies = [400, 800, 1200];
    frequencies.forEach((freq, index) => {
      setTimeout(() => {
        this.playBeep(freq, 150);
      }, index * 200);
    });
  }

  public playModemSound() {
    if (!this.audioContext) return;

    const frequencies = [1200, 2400, 1800, 1200, 2400];
    const durations = [100, 100, 150, 100, 200];

    frequencies.forEach((freq, index) => {
      setTimeout(() => {
        this.playBeep(freq, durations[index]);
      }, index * 150);
    });
  }

  public playShutdownSound() {
    if (!this.audioContext) return;

    const frequencies = [1200, 800, 400];
    frequencies.forEach((freq, index) => {
      setTimeout(() => {
        this.playBeep(freq, 150);
      }, index * 200);
    });
  }
}
