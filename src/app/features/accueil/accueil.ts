import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Auth } from '../../core/auth/auth';
import { Header } from '../../shared/ui/header';

@Component({
  selector: 'app-accueil',
  imports: [RouterLink, Header],
  templateUrl: './accueil.html',
})
export class Accueil {
  protected readonly auth = inject(Auth);
}
