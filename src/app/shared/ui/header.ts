import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../core/auth/auth';

@Component({
  selector: 'app-header',
  imports: [RouterLink],
  templateUrl: './header.html',
})
export class Header {
  protected readonly auth = inject(Auth);
  private readonly router = inject(Router);

  async seDeconnecter(): Promise<void> {
    await this.auth.signOut();
    this.router.navigateByUrl('/connexion');
  }
}
