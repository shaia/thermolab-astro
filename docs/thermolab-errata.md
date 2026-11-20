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

- `data/co2-isotherm-280k.csv` (and its two notebook copies) is hand-built: its own header says "Hand-constructed
  for this course … this is not a live pull from NIST" and "illustrative", and the page and notebook call it
  "representative published values". The mislabelling is in the headings and labels: "The NIST CO2 isotherm" (page
  and notebook Part 5), the legend "NIST (measured)", and the quiz Q-02-4/5 feedback ("NIST CO2 isotherm data").
  Three of its five stated NIST reference values are wrong (T_c = 304.13 K and P_c = 7.3773 MPa are right). NIST
  Chemistry WebBook (fluid.cgi, CO₂, 280 K): P_sat = 4.1607 MPa (CSV 4.1663), saturated vapour 121.74 kg/m³ (CSV
  114.8), saturated liquid 883.58 kg/m³ (CSV 827). So the plateau runs from 361.5 to 49.8 cm³/mol, not 383.4 to
  53.2. The vapour rows have round Z (0.97, 0.94, 0.90, 0.85, 0.80, 0.75, 0.71); the first two lie 0.2–0.4% below
  NIST's isotherm at the same molar volume and the other five 1.7–2.9% above (NIST: 0.45248, 0.87907, 1.71725,
  2.41651, 3.01643, 3.42834 and 3.82865 MPa at the seven volumes; for example 1.2e-3 m³/mol: 1.746 against 1.717
  MPa; 4.2e-4: 3.935 against 3.829 MPa). The row 5.0e-5 m³/mol at 6.5 MPa is inside NIST's two-phase region (880
  kg/m³ < 883.58), so it should be 4.16 MPa. The port quotes NIST's isotherm.
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
- Quiz Q-02-8's discussion: the non-monotonic region "cannot exist without both ingredients: setting either a or b to
  zero removes the critical point entirely", with a described as pulling the pressure down "at larger v". With b = 0
  and a > 0, (∂P/∂v)_T = −k_BT/v² + 2a/v³ is positive for every v < 2a/(k_BT), at every temperature (numerically,
  a = 1e-48 Pa m⁶, T = 1000 K: rising up to 1.448e-28 m³ against 2a/(k_BT) = 1.449e-28 m³): attraction alone folds
  every isotherm and the fold never closes, which is why there is no critical point (T_c = 8a/(27k_Bb) → ∞). Only
  a = 0 removes the fold. And the attraction wins at intermediate v; at large v both corrections fade, and the slope
  is the ideal −k_BT/v².
- Quiz Q-02-1's example of two independent intensive variables is "say P and T". On the condensation plateau they are
  not independent: NIST's CO₂ at 280 K and 4.1607 MPa has any molar volume from 49.8 to 361.5 cm³/mol. An
  imprecision; the port's question uses T and v.
- Problem set, problem 1(d): argon's b = 5.317e-29 m³; from b_m = 3.201e-5 m³/mol it is 5.3154e-29 (with N_A =
  6.022e23, 5.3155e-29). The "measured" T_c = 150.9 K, P_c = 4.87 MPa are not NIST's 150.687 K, 4.8630 MPa, and the
  part asks to compare all three computed critical constants with them, though T_c and P_c come back by construction
  (the constants were made from 150.87 K, 4.898 MPa); only V_c tests the model, as in Q-02-6.
- Advanced: "At low T, B(T) < 0 — attraction dominates and Z < 1; at high T, B(T) > 0 — excluded volume dominates and
  Z > 1." The sign of B fixes the sign of Z − 1 only in the dilute limit. Below T_B a van der Waals gas has Z < 1 only
  for v > b/(1 − T/T_B) and Z > 1 denser (T_r = 1.2: Z returns to 1 at v_r = 0.517). Real nitrogen at 300 K has
  B of about −4.5 cm³/mol (a fit to NIST's 0.05–1 MPa isotherm gives −4.0 to −4.6, depending on the fit) and
  Z = 1.057 at 20 MPa. An imprecision.
- Problem set, problem 5 is tagged OBJ-02-2 (the doubling test) as well as OBJ-02-4. The tag is weak rather than
  baseless (OBJ-02-2 includes forming per-particle densities, which 5(a)'s per-molecule b loosely touches), but no
  part asks to classify a quantity as extensive or intensive. The port's version (workbook W-2.1-07) adds one, on b
  and Nb.

## Module 03: probability and emergence

- Verify, "What the collapse measures" (English line 392, Hebrew 361): the distances at n = 256, heavy-tailed 0.004,
  uniform 0.012, coin 0.029, are one seed's (seed 17 of `test_standardized_sums_converge_onto_one_gaussian` gives
  0.0043, 0.0121, 0.0292). Over 8 seeds of 20,000 sums: heavy-tailed 0.0061 ± 0.0004, uniform 0.0060 ± 0.0006, coin
  0.0285 ± 0.0007, against a floor of 0.0064 ± 0.0003. The uniform steps' 0.012 is a fluctuation to twice the floor
  and contradicts the box's own "two distributions have reached the sampling floor"; the 0.004 is below it by chance.
- Derive, the de Moivre–Laplace box (English line 288, Hebrew 266): "the terms discarded are of relative size
  1/√n" holds only for p ≠ 1/2. For the fair coin, the page's only case, the cubic term vanishes by symmetry and the
  error is of order 1/n: 1/(4n) at the peak, the page's own 0.25% at n = 100, where 1/√n would be 10%. From the
  exact pmf, the largest gap within 3σ falls as n^(−1.48) at p = 1/2 and n^(−1.01) at p = 0.2 (n = 25 to 1600).
- Epistemic labels (English lines 411, 429, 458; Hebrew 378, 396, 424). "What simulation can and cannot settle here"
  is labelled *open-question*, but it states the scope of numerical evidence, which is not open (as in module 01).
  "Independence is a hypothesis, not a decoration" is labelled *model-assumption*, but what it states is a numerical
  observation (the distance stalls) and a theorem about the persistent walk (the factor (1 + q)/(1 − q)).
  "Why 'Gaussian' turns up everywhere" is labelled *definition*; it defines nothing. It is the central limit
  theorem's consequence, and its "regardless of what the contributions look like" needs the theorem's hypotheses
  (independent contributions of finite variance, none dominant).
- Transfer (English line 449, Hebrew 414): "a drop of ink takes minutes to cross a centimetre and years to cross a
  metre". By diffusion, a small dye molecule in water (D ≈ 4·10⁻¹⁰ m²/s) spreads 1 cm in L²/(2D) ≈ 1.3·10⁵ s, a day
  and a half, and 1 m in about 40 years. The ratio 10⁴ is right; minutes is what convection takes.
- Transfer (English line 455, Hebrew 421): a poll of 1000 has a margin near 3% "because 1/√1000 ≈ 0.032". The
  standard error of a proportion near 1/2 is √(0.25/1000) = 0.016; the 3% is the 95% margin, 1.96 × 0.016 = 0.031,
  and matches 1/√1000 only because 1.96 × 0.5 ≈ 1. On a page that separates deviation from error, an imprecision
  worth fixing.
- The puzzle (English line 41–43, Hebrew 41): ten thousand walkers' histogram is "the same to a precision you can set
  your watch by … reproducible to three figures". Its width at t = 1000 scatters by 0.6% from seed to seed (31.67,
  scatter 0.19, 8 seeds; 1/√(2N) = 0.7% expected): two figures. Three need about a million walkers.
- Quiz Q-03-2 (feedback on "About −30", English line 37) and Q-03-7 (feedback on "Growing", line 160): the ensemble
  mean stays at zero "because walkers who stray right are matched by walkers who stray left". That is the compensation
  across walkers that Q-03-9's last distractor rejects ("no walker can compensate for another"). The mean is zero
  because each walker's expected displacement is μ₁t = 0; a finite cloud's mean is not matched to zero but scatters by
  σ₁√(t/N) (0.57 measured against 0.60 predicted for 2500 walkers at t = 900, 64 seeds).
- Quiz Q-03-5 (English lines 103–120): "stays far too wide at every n" and "the true variance is t(1+q)/(1−q) = 19t"
  are long-time statements. At n = 1 the persistent walk is the coin (variance 1), and at q = 0.9 the exact Var(x_n)/n
  is 1.9 at n = 2, 9.8 at n = 16 and 18.3 at n = 256 (from Var = t(1+q)/(1−q) − 2q(1−q^t)/(1−q)², checked against the
  direct sum of covariances). "Too wide, and stays too wide as n grows" is what holds; the distance from the Gaussian
  stalls at 0.35 (n = 16) and 0.31 (n = 256), 8 seeds of 20,000 sums. "Collapse perfectly", for the sums standardised
  by the true variance, overstates a distance that falls with n (the module's own repair numbers).
- Quiz Q-03-9: the question asks where a "smooth, reproducible" histogram comes from, and the correct choice gives only
  the shape (more step sequences end near the middle, and only for coin steps). The reproducibility is the other half:
  each bar is the mean of N independent yes-or-no draws and scatters by √(f(1 − f)/N) (relative scatter 1.85%
  measured against 2.0% predicted for f = 0.198, N = 10,000, 64 runs). The port's correct choice names both.
- Problem set, problem 6(a) (English line 117, Hebrew 114): "show that ⟨r_t²⟩ = 2σ₁²t", under the page's own preamble
  that steps have mean μ₁, holds only for μ₁ = 0. With x and y steps of mean μ₁ each, ⟨r_t²⟩ = 2σ₁²t + 2μ₁²t²; for
  the biased step (μ₁ = 0.2, σ₁² = 0.96) at t = 1000 that is 1920 + 80,000. The spread about the mean, which
  `walker_spread` measures in (b), is what equals 2σ₁²t; state μ₁ = 0, or ask for ⟨|r_t − ⟨r_t⟩|²⟩.
