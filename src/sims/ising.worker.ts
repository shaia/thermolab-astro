/**
 * The temperature sweep's worker: one lattice size, an annealing ladder, a point posted per temperature so
 * the figure can draw as the run goes. One worker per size, so the sizes run side by side on separate cores.
 */

import { temperatureScan, uniform, type IsingObservables } from '~/physics/ising';

export interface SweepRequest {
  size: number;
  seed: number;
  /** the ladder, hot to cold */
  temps: number[];
  sweeps: number;
  burnIn: number;
}

export type SweepMessage = { type: 'point'; size: number; index: number; obs: IsingObservables } | { type: 'done'; size: number };

const scope = self as unknown as { onmessage: ((e: MessageEvent<SweepRequest>) => void) | null; postMessage: (m: SweepMessage) => void };

scope.onmessage = (e) => {
  const { size, seed, temps, sweeps, burnIn } = e.data;
  temperatureScan(size, temps, sweeps, uniform(seed), {
    burnIn,
    onPoint: (_t, obs, index) => scope.postMessage({ type: 'point', size, index, obs }),
  });
  scope.postMessage({ type: 'done', size });
};
