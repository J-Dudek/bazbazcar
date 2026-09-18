import { TestBed } from '@angular/core/testing';
import { PwaInstall } from './pwa-install';

const JOUR_MS = 24 * 60 * 60 * 1000;

function creerService(): PwaInstall {
  TestBed.resetTestingModule();
  return TestBed.inject(PwaInstall);
}

/** Simule l'événement Chromium `beforeinstallprompt`. */
function emettreBeforeInstallPrompt(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const evenement = new Event('beforeinstallprompt', { cancelable: true });
  const prompt = vi.fn(() => Promise.resolve());
  Object.assign(evenement, { prompt, userChoice: Promise.resolve({ outcome }) });
  window.dispatchEvent(evenement);
  return { evenement, prompt };
}

describe('PwaInstall', () => {
  let stockage: Map<string, string>;

  beforeEach(() => {
    stockage = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (cle: string) => stockage.get(cle) ?? null,
      setItem: (cle: string, valeur: string) => stockage.set(cle, valeur),
    });
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("ne propose rien tant que le navigateur n'a pas signalé que l'app est installable", () => {
    expect(creerService().mode()).toBeNull();
  });

  it('propose l’installation native une fois beforeinstallprompt reçu, sans mini-barre du navigateur', () => {
    const service = creerService();
    const { evenement } = emettreBeforeInstallPrompt();

    expect(evenement.defaultPrevented).toBe(true);
    expect(service.mode()).toBe('natif');
  });

  it("ne propose rien si l'app tourne déjà en mode installé (standalone)", () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(display-mode: standalone)',
      media: query,
    }));
    const service = creerService();
    emettreBeforeInstallPrompt();

    expect(service.mode()).toBeNull();
  });

  it("ne propose plus rien une fois l'app installée (appinstalled)", () => {
    const service = creerService();
    emettreBeforeInstallPrompt();
    window.dispatchEvent(new Event('appinstalled'));

    expect(service.mode()).toBeNull();
  });

  it("explique la marche à suivre sur iOS, où aucune API d'installation n'existe", () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
    );

    expect(creerService().mode()).toBe('ios');
  });

  it('installer() lance prompt() une seule fois puis ne propose plus rien', async () => {
    const service = creerService();
    const { prompt } = emettreBeforeInstallPrompt('accepted');

    await service.installer();
    await service.installer();

    expect(prompt).toHaveBeenCalledTimes(1);
    expect(service.mode()).toBeNull();
  });

  it('reporter() masque la proposition pendant 30 jours, sur cet appareil', () => {
    const service = creerService();
    emettreBeforeInstallPrompt();
    service.reporter();
    expect(service.mode()).toBeNull();

    // Nouvelle visite, quelques jours plus tard : toujours reportée.
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 29 * JOUR_MS);
    const revenu = creerService();
    emettreBeforeInstallPrompt();
    expect(revenu.mode()).toBeNull();
  });

  it('propose de nouveau une fois le délai de report écoulé', () => {
    creerService().reporter();

    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 31 * JOUR_MS);
    const revenu = creerService();
    emettreBeforeInstallPrompt();
    expect(revenu.mode()).toBe('natif');
  });
});
