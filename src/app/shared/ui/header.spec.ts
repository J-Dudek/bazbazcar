import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Auth } from '../../core/auth/auth';
import { MembresEnAttente } from '../../core/membres/membres-en-attente';
import { Profile } from '../models/profile';
import { Header } from './header';

const admin: Profile = {
  id: 'admin-1',
  nom: 'Dupont',
  prenom: 'Chef',
  email: 'admin@exemple.fr',
  role: 'admin',
  statut: 'valide',
  created_at: '2026-09-18T00:00:00Z',
};

async function monter(profil: Profile, enAttente: number): Promise<HTMLElement> {
  TestBed.configureTestingModule({
    imports: [Header],
    providers: [
      provideRouter([]),
      {
        provide: Auth,
        useValue: {
          session: signal({ user: { id: profil.id } }),
          profile: signal(profil),
          initialized: Promise.resolve(),
          signOut: vi.fn(),
        },
      },
      { provide: MembresEnAttente, useValue: { nombre: signal(enAttente) } },
    ],
  });

  const fixture = TestBed.createComponent(Header);
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('Header : pastille des membres en attente', () => {
  it('affiche la pastille sur « Gérer les membres » quand des comptes attendent', async () => {
    const header = await monter(admin, 2);

    const lien = header.querySelector('a[href="/admin/membres"]');
    expect(lien).toBeTruthy();

    const pastille = lien?.querySelector('.pastille-attention');
    expect(pastille).toBeTruthy();
    // Décorative : l'information passe par le texte masqué, pas par la couleur.
    expect(pastille?.getAttribute('aria-hidden')).toBe('true');
    expect(lien?.querySelector('.j6n-sr-only')?.textContent).toContain('2 en attente');
  });

  it('affiche aussi la pastille sur le bouton du menu mobile', async () => {
    const header = await monter(admin, 1);

    const bouton = header.querySelector('.j6n-nav__toggle');
    expect(bouton?.querySelector('.pastille-attention--menu')).toBeTruthy();
    // Le bouton garde son nom accessible d'origine.
    expect(bouton?.getAttribute('aria-label')).toBe('Ouvrir le menu');
  });

  it("n'affiche aucune pastille quand personne n'attend", async () => {
    const header = await monter(admin, 0);

    expect(header.querySelector('a[href="/admin/membres"]')).toBeTruthy();
    expect(header.querySelector('.pastille-attention')).toBeNull();
    expect(header.querySelector('.j6n-sr-only')).toBeNull();
  });

  it('ne montre ni le lien ni la pastille à un simple membre', async () => {
    const header = await monter({ ...admin, role: 'membre' }, 0);

    expect(header.querySelector('a[href="/admin/membres"]')).toBeNull();
    expect(header.querySelector('.pastille-attention')).toBeNull();
  });
});
