import { runMonteCarloWithProgress, MonteCarloInput, MonteCarloWorkerMessage } from './monteCarlo';

self.onmessage = (event: MessageEvent<MonteCarloInput>) => {
  try {
    const simulation = runMonteCarloWithProgress(event.data);
    let state = simulation.next();

    while (!state.done) {
      const progress: MonteCarloWorkerMessage = { type: 'progress', progress: state.value };
      self.postMessage(progress);
      state = simulation.next();
    }

    const message: MonteCarloWorkerMessage = { type: 'complete', result: state.value };
    self.postMessage(message);
  } catch (error) {
    const message: MonteCarloWorkerMessage = {
      type: 'error',
      message: error instanceof Error ? error.message : 'Simulation failed unexpectedly.',
    };
    self.postMessage(message);
  }
};
