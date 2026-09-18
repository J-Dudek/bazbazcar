import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '../../core/auth/auth';

@Component({
  selector: 'app-header',
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
