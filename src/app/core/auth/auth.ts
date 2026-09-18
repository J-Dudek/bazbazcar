import { Injectable, inject, signal } from '@angular/core';
import { Session } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { Profile } from '../../shared/models/profile';

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly supabase = inject(SupabaseService).client;

  readonly session = signal<Session | null>(null);
  readonly profile = signal<Profile | null>(null);

  /** Résolue une fois la session initiale (et le profil associé) chargée — à `await` dans les guards. */
  readonly initialized: Promise<void>;

  constructor() {
    this.initialized = this.supabase.auth
      .getSession()
      .then(({ data }) => this.handleSession(data.session));

    this.supabase.auth.onAuthStateChange((_event, session) => {
      this.handleSession(session);
    });
  }

  private async handleSession(session: Session | null): Promise<void> {
    this.session.set(session);

    if (!session) {
      this.profile.set(null);
      return;
    }

    const { data } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    this.profile.set(data as Profile | null);
  }

  async signUp(
    nom: string,
    prenom: string,
    email: string,
    password: string,
  ): Promise<{ error: string | null }> {
    const { error } = await this.supabase.auth.signUp({
      email,
      password,
      options: { data: { nom, prenom } },
    });
    return { error: error?.message ?? null };
  }

  async signIn(email: string, password: string): Promise<{ error: string | null }> {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return { error: error.message };
    }

    // onAuthStateChange déclenchera aussi handleSession, mais de façon
    // asynchrone/non-attendable par l'appelant : on l'appelle nous-mêmes pour
    // garantir que `profile()` est à jour dès que signIn() se résout (évite
    // une course si l'appelant redirige selon le statut juste après).
    await this.handleSession(data.session);
    return { error: null };
  }

  async signOut(): Promise<void> {
    // `local` : ne ferme que la session de cet appareil. Le défaut de supabase-js
    // (`global`) déconnecterait aussi le membre de tous ses autres appareils,
    // y compris l'app installée (PWA) sur son téléphone.
    await this.supabase.auth.signOut({ scope: 'local' });
  }

  async resetPasswordForEmail(email: string): Promise<{ error: string | null }> {
    const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/nouveau-mot-de-passe`,
    });
    return { error: error?.message ?? null };
  }

  async updatePassword(password: string): Promise<{ error: string | null }> {
    const { error } = await this.supabase.auth.updateUser({ password });
    return { error: error?.message ?? null };
  }

  /** Recharge le profil depuis la base — à appeler après une mise à jour faite
   * directement sur la table `profiles` (le signal `profile` ne se met sinon à
   * jour qu'au changement de session). */
  async rafraichirProfil(): Promise<void> {
    const session = this.session();
    if (!session) {
      return;
    }
    const { data } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    this.profile.set(data as Profile | null);
  }
}
