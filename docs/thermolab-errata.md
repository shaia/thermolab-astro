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
  temperature: 1.44 ε at one quantum per oscillator, against 1 ε; and 25.50 ε at 25 quanta per oscillator (the
  notebook's hot body), against 25 ε. The notebook's cold body holds 12.5 and reads 12.99 ε, against 12.5 ε.
  ThermoLab's own module 12 (lines 701–711) says "equipartition's reading plus half a quantum", which
  contradicts module 01's "the same number".
- Two epistemic labels are wrong (English lines 267 and 300, Hebrew 249 and 278). "The discrete simulation
  realises exactly this law" is labelled *numerical-observation*, but what it states, that the mean gap follows
  (1 − 1/Q)^n exactly, is a theorem about the model, proved in the Advanced section; and "A caution about what
  the simulation proves" is labelled *open-question*, but it states the scope of the evidence, which is not open.
  The same box says the ODE derivation "proves the law"; it derives the exponential from Newton's law, which is
  itself empirical (the page's own label).
- Line 425 says the result "becomes the continuous exponential e^{−n/τ} once Q ≫ 1, with τ = −1/ln(1 − 1/Q) → Q".
  With that τ, (1 − 1/Q)^n = e^{−n/τ} exactly for every Q ≥ 2; only τ ≈ Q − 1/2 needs Q ≫ 1. An imprecision, not
  an error; the port states it correctly.

## Module 02: equations of state

- `data/co2-isotherm-280k.csv` (and its two notebook copies) is presented as NIST data ("the NIST CO2 isotherm",
  "NIST (measured)") but is hand-built, and its stated NIST reference values are wrong. NIST Chemistry WebBook
  (fluid.cgi, CO₂, 280 K): P_sat = 4.1607 MPa (CSV 4.1663), saturated vapour 121.74 kg/m³ (CSV 114.8), saturated
  liquid 883.58 kg/m³ (CSV 827). So the plateau runs from 361.5 to 49.8 cm³/mol, not 383.4 to 53.2. The vapour rows
  have round Z (0.97, 0.94, 0.90, 0.85, 0.80, 0.75, 0.71) and lie 0.8–2.9% above NIST's isotherm at the same molar
  volume (1.2e-3 m³/mol: 1.746 against 1.718 MPa; 4.2e-4: 3.935 against 3.828 MPa). The row 5.0e-5 m³/mol at 6.5 MPa
  is inside NIST's two-phase region (880 kg/m³ < 883.58), so it should be 4.16 MPa. The port quotes NIST's isotherm.
- Explore, alt text of `gases-surface.mp4`: the fold is "a region where the surface is no longer single-valued in
  pressure for a given volume and temperature". P(v, T) of the van der Waals equation is single-valued everywhere;
  it is v at given (P, T) that has three values below T_c.
- Model specification (page, notebook, `gases.py` docstring), *Valid when*: "moderate densities near and above T_c"
  for the van der Waals sheet. Near T_c is where it is quantitatively worst: Z_c = 3/8 against 0.275 for CO₂ (NIST
  T_c = 304.1282 K, P_c = 7.3773 MPa, ρ_c = 467.6 kg/m³) and 0.290 for argon, and its v_c = 3b is 1.37 times CO₂'s
  measured critical volume (128.5 against 94.1 cm³/mol).
- Quiz Q-02-6 calls the CO₂ constants a_m = 0.3640, b_m = 4.267e-5 "independently published … not fit from its
  critical point", and finds T_c within 0.1% "even though". Tabulated van der Waals constants are computed from the
  critical point: T_c = 304.2 K, P_c = 7.41 MPa give a_m = 0.3642, b_m = 4.267e-5 (argon's 0.1355, 3.201e-5 likewise
  come from 150.87 K, 4.898 MPa). The agreement is circular; only v_c is a test.
- Quiz Q-02-8's discussion cites "Problem 5(d) on the problem set"; problem 5 has parts (a)–(c).
- Derive: the van der Waals equation is "not a consequence of the state postulate the way the ideal gas law can be
  read as one". The state postulate says a surface exists and implies no particular equation, the ideal one
  included; the page's own box labels the ideal gas law empirical.
- Advanced: at the Boyle temperature "the two corrections cancel to leading order in 1/v at every density
  simultaneously". They cancel only in the 1/v term; for van der Waals Z = 1 + b²/v² + … there (Z = 1.005 at
  v_r = 5, T_r = 27/8). An imprecision.
- Quiz Q-02-7's correct choice: "any van der Waals substance at a given (T_r, P_r) has the same reduced volume v_r".
  Below T_c a given (T_r, P_r) on the loop's range has three v_r; the law fixes P_r from (T_r, v_r). An imprecision.
