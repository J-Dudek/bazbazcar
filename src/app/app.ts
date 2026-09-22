import { Component, afterEveryRender, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from './shared/ui/header';
import { InstallationPwaPopin } from './shared/ui/installation-pwa-popin';
import { ThemeToggle } from './shared/ui/theme-toggle';
import { NouvelEvenementPopin } from './shared/ui/nouvel-evenement-popin';
import { PwaUpdate } from './core/pwa/pwa-update';

@Component({
  imports: [RouterOutlet, Header, ThemeToggle, NouvelEvenementPopin, InstallationPwaPopin],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  // `providedIn: 'root'` ne suffit pas à démarrer le service : Angular ne crée
  // une instance qu'à la première injection, il faut donc l'injecter quelque
  // part pour que son constructeur (abonnement aux mises à jour) s'exécute.
  private readonly pwaUpdate = inject(PwaUpdate);

  constructor() {
    // theme.js (design-j6n) ne s'auto-initialise qu'au DOMContentLoaded, avant
    // qu'Angular n'ait rendu la moindre route : sans ce hook, aucun comportement
    // JS (menu mobile, modales, dropdowns…) ne s'active jamais. Un hook sur
    // NavigationEnd seul ne suffit pas non plus : du contenu apparu après un
    // chargement async (ex. le bouton "Proposer un trajet", affiché seulement
    // une fois l'événement chargé) arrive après la navigation, donc jamais lié.
    // `afterEveryRender` retourne après CHAQUE rendu (async ou non) ; `j6n.init`
    // est idempotent (guard data-j6nBound), donc l'appeler souvent est sans risque.
    afterEveryRender(() => j6n.init(document));
  }
}
