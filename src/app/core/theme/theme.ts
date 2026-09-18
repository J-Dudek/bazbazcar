import { Injectable, signal } from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'auto';

const STORAGE_KEY = 'j6n-theme';

@Injectable({ providedIn: 'root' })
export class Theme {
  readonly preference = signal<ThemePreference>(this.lireStockage());

  constructor() {
    this.appliquer(this.preference());
  }

  definir(preference: ThemePreference): void {
    this.preference.set(preference);
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // stockage indisponible (navigation privée…) — la préférence reste active pour la session en cours
    }
    this.appliquer(preference);
  }

  private lireStockage(): ThemePreference {
    try {
      const valeur = localStorage.getItem(STORAGE_KEY);
      if (valeur === 'light' || valeur === 'dark' || valeur === 'auto') {
        return valeur;
      }
    } catch {
      // ignore
    }
    return 'auto';
  }

  private appliquer(preference: ThemePreference): void {
    // design-j6n : [data-theme="dark"|"light"] force le mode, l'absence de
    // l'attribut suit prefers-color-scheme (= "auto").
    if (preference === 'auto') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', preference);
    }
  }
}
