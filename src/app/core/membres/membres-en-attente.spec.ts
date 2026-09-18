import { WritableSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { Profile } from '../../shared/models/profile';
import { Auth } from '../auth/auth';
import { SupabaseService } from '../supabase/supabase.service';
import { MembresEnAttente } from './membres-en-attente';

interface Reponse {
  count: number | null;
  error: { message: string } | null;
}

const admin: Profile = {
  id: 'admin-1',
  nom: 'Dupont',
  prenom: 'Chef',
  email: 'admin@exemple.fr',
  role: 'admin',
  statut: 'valide',
  created_at: '2026-09-18T00:00:00Z',
};

function definirVisibilite(etat: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => etat });
}

describe('MembresEnAttente', () => {
  let profile: WritableSignal<Profile | null>;
  let navigation: Subject<unknown>;
  let eq: ReturnType<typeof vi.fn>;
  let select: ReturnType<typeof vi.fn>;
  let from: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    profile = signal<Profile | null>(admin);
    navigation = new Subject();
    eq = vi.fn(() => Promise.resolve<Reponse>({ count: 3, error: null }));
    select = vi.fn(() => ({ eq }));
    from = vi.fn(() => ({ select }));

    // Supabase est simulé : ces tests ne doivent jamais joindre un vrai projet
    // (environment.ts pointe vers la production).
    TestBed.configureTestingModule({
      providers: [
        { provide: Auth, useValue: { profile } },
        { provide: SupabaseService, useValue: { client: { from } } },
        { provide: Router, useValue: { events: navigation } },
      ],
    });
    definirVisibilite('visible');
  });

  afterEach(() => {
    delete (document as { visibilityState?: unknown }).visibilityState;
  });

  async function serviceCharge(): Promise<MembresEnAttente> {
    const service = TestBed.inject(MembresEnAttente);
    TestBed.tick();
    await vi.waitFor(() => expect(service.nombre()).toBe(3));
    return service;
  }

  it('compte les comptes en attente pour un administrateur validé', async () => {
    await serviceCharge();

    expect(from).toHaveBeenCalledWith('profiles');
    expect(select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
    expect(eq).toHaveBeenCalledWith('statut', 'en_attente');
  });

  it('reste à 0, sans requête, pour un simple membre', () => {
    profile.set({ ...admin, role: 'membre' });
    const service = TestBed.inject(MembresEnAttente);
    TestBed.tick();

    expect(service.nombre()).toBe(0);
    expect(from).not.toHaveBeenCalled();
  });

  it('reste à 0, sans requête, pour un administrateur dont le compte est refusé', () => {
    profile.set({ ...admin, statut: 'refuse' });
    const service = TestBed.inject(MembresEnAttente);
    TestBed.tick();

    expect(service.nombre()).toBe(0);
    expect(from).not.toHaveBeenCalled();
  });

  it('repasse à 0 à la déconnexion', async () => {
    const service = await serviceCharge();

    profile.set(null);
    TestBed.tick();

    expect(service.nombre()).toBe(0);
  });

  it('se rafraîchit à chaque navigation, et seulement à la fin de celle-ci', async () => {
    const service = await serviceCharge();
    eq.mockResolvedValue({ count: 5, error: null });

    const appelsAvant = from.mock.calls.length;
    navigation.next({ type: 'autre evenement du routeur' });
    expect(from.mock.calls.length).toBe(appelsAvant);

    navigation.next(new NavigationEnd(1, '/admin/membres', '/admin/membres'));
    await vi.waitFor(() => expect(service.nombre()).toBe(5));
  });

  it("se rafraîchit quand l'onglet redevient visible, pas quand il est masqué", async () => {
    const service = await serviceCharge();
    eq.mockResolvedValue({ count: 4, error: null });

    const appelsAvant = from.mock.calls.length;
    definirVisibilite('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(from.mock.calls.length).toBe(appelsAvant);

    definirVisibilite('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.waitFor(() => expect(service.nombre()).toBe(4));
  });

  it('garde le dernier nombre connu quand la requête échoue', async () => {
    const service = await serviceCharge();
    eq.mockResolvedValue({ count: null, error: { message: 'Failed to fetch' } });

    await service.rafraichir();

    expect(service.nombre()).toBe(3);
  });

  it('ignore une réponse périmée arrivée après une plus récente', async () => {
    // Deux requêtes en vol : la première (déclenchée par le profil) ne répond
    // qu'après la seconde (déclenchée à la main).
    const reponses: ((valeur: Reponse) => void)[] = [];
    eq.mockImplementation(() => new Promise<Reponse>((resoudre) => reponses.push(resoudre)));

    const service = TestBed.inject(MembresEnAttente);
    TestBed.tick();
    const seconde = service.rafraichir();
    expect(reponses.length).toBe(2);

    reponses[1]({ count: 2, error: null });
    await seconde;
    expect(service.nombre()).toBe(2);

    reponses[0]({ count: 1, error: null });
    await Promise.resolve();
    expect(service.nombre()).toBe(2);
  });
});
