# Errors found in ThermoLab while porting

Each line is something wrong in ThermoLab (`../thermolab`) that the port found and corrected
here. ThermoLab is fixed separately, from this list; mark a line **fixed** with the ThermoLab PR
when it is.

## Module 04: pressure

- The relative pressure fluctuation of a mole: 4·10⁻¹³ → 1.3·10⁻¹². **Fixed** (thermolab #23).
- The lesson explains a steady gauge by the N^(-1/2) spread between gases. A gauge is steady
  because it averages an astronomical number of impacts, a different count, and its jitter
  depends on temperature and mass.

## Module 15: Ising

- Hysteresis loop areas 2.20 / 1.48 / 1.18 → 1.82 / 1.33 / 1.08 (64 seeds; ThermoLab's Python
  agrees).
- Quiz Q-15-6: the variance at 2.5 J is about 0.060, not 0.0049.
- A 16×16 lattice at 2.0 J does sometimes reverse in 10⁵ sweeps (0–3 times over 8 seeds).
- τ at T_c for L = 16: 10.5 sweeps, not 9.6.
- The extrapolated T_c from the quoted peaks: 2.268, not 2.272.
- Worked example 3's sixth iterate: 0.762, not 0.763.
- The hook: bulk iron cooled in zero field breaks into domains and is not magnetized.
- Peierls: the argument, made rigorous, does prove that the square lattice orders.
