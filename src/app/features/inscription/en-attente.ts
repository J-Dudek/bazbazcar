import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '../../core/auth/auth';
import { Header } from '../../shared/ui/header';

@Component({
  selector: 'app-en-attente',
  imports: [Header],
  templateUrl: './en-attente.html',
})
export class EnAttente implements OnInit {
  protected readonly auth = inject(Auth);
  private readonly router = inject(Router);

  ngOnInit(): void {
    // Cette page n'a d'intérêt que pour un compte non encore validé — un
    // compte déjà valide qui y accède directement (URL, historique...) est
    // renvoyé vers l'accueil plutôt que de voir un message "compte validé"
    // sans autre contenu.
    if (this.auth.profile()?.statut === 'valide') {
      this.router.navigateByUrl('/accueil');
    }
  }
}
