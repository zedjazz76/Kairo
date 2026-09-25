export const TESSERACT_ENGINE = 'tesseract';
export const WINDOWS_ENGINE = 'windows';

export function createOcrEngineRoster(probe = null) {
  const engines = [
    { id: TESSERACT_ENGINE, label: 'Tesseract (packaged WASM)', available: true, reason: '' },
    { id: WINDOWS_ENGINE, label: 'Windows OCR (Helper)', available: false, reason: 'WINDOWS_OCR_NOT_PACKAGED' },
  ];
  return {
    async refresh() {
      if (typeof probe !== 'function') return this.list();
      try {
        const remote = await probe();
        const windows = Array.isArray(remote?.engines)
          ? remote.engines.find((item) => item.id === WINDOWS_ENGINE)
          : null;
        const slot = engines.find((item) => item.id === WINDOWS_ENGINE);
        if (slot && windows) {
          slot.available = windows.available === true;
          slot.reason = windows.available ? '' : (windows.reason || 'WINDOWS_OCR_UNAVAILABLE');
        }
      } catch {
        const slot = engines.find((item) => item.id === WINDOWS_ENGINE);
        if (slot) {
          slot.available = false;
          slot.reason = 'WINDOWS_OCR_PROBE_FAILED';
        }
      }
      return this.list();
    },
    list() {
      return engines.map((item) => ({ ...item }));
    },
    select(id) {
      const engine = engines.find((item) => item.id === id);
      if (!engine) throw new Error('OCR_ENGINE_UNKNOWN');
      if (!engine.available) throw new Error(engine.reason || 'OCR_ENGINE_UNAVAILABLE');
      return engine.id;
    },
  };
}
