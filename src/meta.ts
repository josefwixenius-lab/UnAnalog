/**
 * App-metadata. Byt OWNER till ditt namn så uppdateras både
 * footer och manualens credit-sektion automatiskt.
 */
export const APP_META = {
  name: 'UnAnalog Sequencer',
  version: '0.5.1',
  year: 2026,
  owner: 'Josef Wixenius', // ← byt till exakt det namn du vill ha på copyright-raden
  /**
   * Licenstext som visas i manualen. Alternativ:
   * - 'Alla rättigheter förbehållna.' (privat, default)
   * - 'MIT-licens. Fri att använda och modifiera.'
   * - 'CC BY-NC 4.0 — fri icke-kommersiell användning med angivet upphov.'
   */
  license: 'Alla rättigheter förbehållna.',
} as const;
