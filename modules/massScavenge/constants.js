(function () {
  'use strict';

  const ROOT = (window.DSTools ||= {});
  const NS = (ROOT.massScavenge ||= {});

  NS.constants = {
    LS_KEY_SETTINGS: 'DSMassScavengerSettings',
    MASS_ITER_LIMIT: 50,
    MASS_STEP_DELAY_MS: 1500,
    // Für Debug-Ausgaben (z.B. findAllInactiveCells)
    DEBUG: true,
  };
})();
