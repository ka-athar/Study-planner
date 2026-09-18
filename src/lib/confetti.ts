import confetti from 'canvas-confetti';

/**
 * Triggers a rich, multi-burst celebratory confetti animation
 * when a student achieves their daily study goal or completes all tasks.
 */
export const triggerStudyGoalConfetti = () => {
  try {
    // 1. Initial center firework burst
    confetti({
      particleCount: 90,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#10B981', '#6B705C', '#F59E0B', '#DDBEA9', '#6366F1', '#34D399', '#FBBF24'],
      ticks: 250,
      gravity: 1.1,
      scalar: 1.1,
      shapes: ['square', 'circle']
    });

    // 2. Left corner cannon
    setTimeout(() => {
      confetti({
        particleCount: 55,
        angle: 60,
        spread: 60,
        origin: { x: 0.12, y: 0.7 },
        colors: ['#10B981', '#059669', '#F59E0B', '#6B705C', '#34D399'],
        ticks: 200,
        gravity: 1.2
      });
    }, 180);

    // 3. Right corner cannon
    setTimeout(() => {
      confetti({
        particleCount: 55,
        angle: 120,
        spread: 60,
        origin: { x: 0.88, y: 0.7 },
        colors: ['#10B981', '#059669', '#F59E0B', '#6B705C', '#34D399'],
        ticks: 200,
        gravity: 1.2
      });
    }, 360);

    // 4. Subtle star shower finale
    setTimeout(() => {
      confetti({
        particleCount: 40,
        spread: 100,
        origin: { y: 0.4 },
        colors: ['#FBBF24', '#F59E0B', '#34D399', '#A7F3D0'],
        ticks: 300,
        shapes: ['circle'],
        scalar: 0.9
      });
    }, 550);
  } catch (error) {
    console.error('Error firing confetti animation:', error);
  }
};
