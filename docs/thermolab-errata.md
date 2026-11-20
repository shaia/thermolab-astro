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

## Module 00: orientation

- Independence is defined as ⟨XY⟩ = ⟨X⟩⟨Y⟩, and the covariance is said to vanish "exactly when" X and Y
  are independent, "and then — and only then —" do variances add. That is uncorrelatedness: independence
  implies it, not conversely (X uniform on {−1, 0, 1}, Y = X²: Cov = 0, yet Y is fixed by X), and variances
  add whenever the covariance vanishes. The lesson defines independence by factorized joint probabilities.
- Math refresher: "(∂U/∂T)_V and (∂U/∂T)_P … are the heat capacities at constant volume and at constant
  pressure". C_P is (∂H/∂T)_P; for a monatomic ideal gas (∂U/∂T)_P = (3/2)Nk_B = C_V, while C_P = (5/2)Nk_B.
- Conventions, epistemic labels: Stirling's relative error does not fall as ln N / N. The error is
  ½ ln(2πN), so the relative error is ln(2πN)/[2N(ln N − 1)], of order 1/N: 8.9·10⁻³ at N = 100
  (ln N / N = 4.6·10⁻²) and 6.1·10⁻⁷ at N = 10⁶ (ln N / N = 1.4·10⁻⁵). It approaches 1/(2N) only
  logarithmically slowly (1.8 times it at N = 100, 1.2 times at 10⁶).
- Hebrew conventions page: its dice model specification drops "and the deterministic chaos that is the
  actual reason a throw looks random" from *Ignored* and "beyond its distribution" from *Failure modes*;
  the English page and both module pages have them.
- Quiz Q-00-2: "if you got 17.5 you forgot to subtract the square of the mean". 17.5 is Σ(k − 3.5)², the
  squared deviations not divided by 6; forgetting to subtract μ² gives ⟨X²⟩ = 91/6 = 15.17.

## Module 01: thermal equilibrium

- The hop model's implicit conductance is κ = k_B n_A n_B / ((n_A + n_B) Q) per step, not k_B/Q (Advanced
  section, English line 427 and Hebrew line 395; `equilibrium.relaxation_time` docstring). With C = nk_B,
  Newton's τ = C_A C_B / (κ(C_A + C_B)) equals the model's τ ≈ Q only for that κ; it also follows directly from
  the mean drift, C_A ⟨ΔT_A⟩ = −(ε/Q)(q_A − pQ) = (k_B/Q) · n_A n_B/(n_A + n_B) · (T_B − T_A). For n_A = 100,
  n_B = 300, Q = 700 it is 0.107 k_B per step, against k_B/Q = 0.0014 k_B.
- Transfer section, module 12 bullet: the canonical Einstein solid does not give "the same number" as
  T = qε/(nk_B). Its partition function gives k_BT = ε/ln(1 + n/q), which approaches ε(q/n + 1/2) only at high
  temperature: 1.44 ε at one quantum per oscillator, 25.50 ε at 25 (the notebook's bodies), against 1 ε and 25 ε.
