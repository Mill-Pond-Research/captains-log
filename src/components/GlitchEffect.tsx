import React, { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import styles from './GlitchEffect.module.css';

interface GlitchEffectProps {
  children: ReactNode;
  minInterval?: number;
  maxInterval?: number;
}

export const GlitchEffect: React.FC<GlitchEffectProps> = ({
  children,
  minInterval = 5000,  // minimum 5 seconds between glitches
  maxInterval = 15000  // maximum 15 seconds between glitches
}) => {
  const [isGlitching, setIsGlitching] = useState(false);

  useEffect(() => {
    const scheduleNextGlitch = () => {
      // Random time between minInterval and maxInterval
      const nextGlitchDelay = Math.random() * (maxInterval - minInterval) + minInterval;
      
      const glitchTimeout = setTimeout(() => {
        setIsGlitching(true);
        
        // Reset glitch after 300ms
        setTimeout(() => {
          setIsGlitching(false);
          scheduleNextGlitch();
        }, 300);
      }, nextGlitchDelay);

      return () => clearTimeout(glitchTimeout);
    };

    const cleanup = scheduleNextGlitch();
    return cleanup;
  }, [minInterval, maxInterval]);

  return (
    <span className={`${styles.glitchContainer} ${isGlitching ? styles.glitchActive : ''}`}>
      <span className={styles.glitchText}>{children}</span>
      <div className={styles.scanline} />
    </span>
  );
};

export default GlitchEffect; 