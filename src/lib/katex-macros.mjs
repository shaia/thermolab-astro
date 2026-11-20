// ThermoLab's project-wide TeX macros (content/en/myst.yml, project.math), so formulas carry over from
// ThermoLab unchanged. \dbar is the inexact differential, which ThermoLab prints as δ (δQ, δW).
// Plain .mjs so astro.config.mjs can import it as well as the TypeScript code. KaTeX may add to a macros
// object it is given, so every render gets a fresh copy: katexMacros().
const MACROS = {
  '\\dbar': '\\delta',
  '\\Won': 'W_{\\mathrm{on}}',
  '\\kB': 'k_{\\mathrm{B}}',
};

export const katexMacros = () => ({ ...MACROS });
