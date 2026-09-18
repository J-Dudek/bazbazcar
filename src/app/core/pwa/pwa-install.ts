import { Injectable, computed, signal } from '@angular/core';

/** Événement Chromium `beforeinstallprompt` (absent de lib.dom). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * `natif` : le navigateur (Chrome, Edge, Android…) sait lancer l'installation.
 * `ios` : Safari n'a aucune API d'installation, on ne peut qu'expliquer la marche à suivre.
 */
export type ModeInstallation = 'natif' | 'ios';

const STORAGE_KEY = 'pwa-installation-reportee';
const DELAI_RELANCE_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class PwaInstall {
  private readonly evenement = signal<BeforeInstallPromptEvent | null>(null);
  private readonly installee = signal(this.estInstallee());
  private readonly reportee = signal(this.lireReport());
  private readonly ios = this.estIos();

  /**
   * Façon de proposer l'installation sur cet appareil, ou `null` s'il n'y a rien
   * à proposer : app déjà installée, proposition reportée récemment, ou
   * navigateur qui ne permet pas l'installation.
   */
  readonly mode = computed<ModeInstallation | null>(() => {
    if (this.installee() || this.reportee()) {
      return null;
    }
    if (this.evenement()) {
      return 'natif';
    }
    return this.ios ? 'ios' : null;
  });

  constructor() {
    // Chromium l'émet dès que l'app est installable, donc en général avant la
    // connexion : on le garde de côté (et on bloque sa mini-barre native) pour
    // proposer l'installation nous-mêmes au bon moment.
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.evenement.set(event as BeforeInstallPromptEvent);
    });
    window.addEventListener('appinstalled', () => {
      this.installee.set(true);
      this.evenement.set(null);
    });
  }

  /** À appeler depuis un clic : `prompt()` n'est autorisé que pendant un geste utilisateur. */
  async installer(): Promise<void> {
    const evenement = this.evenement();
    if (!evenement) {
      return;
    }
    // Un événement ne sert qu'une seule fois, même si le membre refuse.
    this.evenement.set(null);
    await evenement.prompt();
    const { outcome } = await evenement.userChoice;
    if (outcome === 'accepted') {
      this.installee.set(true);
    }
  }

  /** Ne plus proposer l'installation pendant `DELAI_RELANCE_MS` (par appareil). */
  reporter(): void {
    this.reportee.set(true);
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      // stockage indisponible (navigation privée…) — reporté pour la session en cours seulement
    }
  }

  private estInstallee(): boolean {
    // `navigator.standalone` : Safari iOS, qui n'expose pas display-mode partout.
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  }

  private estIos(): boolean {
    const ua = navigator.userAgent;
    // iPadOS se présente comme un Mac : seul le tactile le distingue.
    return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  }

  private lireReport(): boolean {
    try {
      const depuis = Number(localStorage.getItem(STORAGE_KEY));
      return depuis > 0 && Date.now() - depuis < DELAI_RELANCE_MS;
    } catch {
      return false;
    }
  }
}
