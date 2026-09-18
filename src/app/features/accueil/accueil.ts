import { Component, inject } from '@angular/core';
import { Auth } from '../../core/auth/auth';
import { Header } from '../../shared/ui/header';

@Component({
  selector: 'app-accueil',
  imports: [Header],
  templateUrl: './accueil.html',
})
export class Accueil {
  protected readonly auth = inject(Auth);
}
