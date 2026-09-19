import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { Auth } from '../../core/auth/auth';
import { Evenement } from '../../shared/models/evenement';
import { Trajet } from '../../shared/models/trajet';
import { Commentaire } from '../../shared/models/commentaire';

const MODAL_PROPOSER = 'modal-proposer-trajet';

type CommentaireAvecAuteur = Commentaire & { profiles: { prenom: string; nom: string } | null };
interface Occupant {
  prenom: string;
  nom: string;
}
type TrajetAvecConducteur = Trajet & { profiles: { prenom: string; nom: string } | null };

@Component({
  selector: 'app-evenement-detail',
  imports: [DatePipe, FormsModule, RouterLink],
  templateUrl: './evenement-detail.html',
})
export class EvenementDetail implements OnInit {
  private readonly supabase = inject(SupabaseService).client;
  private readonly route = inject(ActivatedRoute);
  protected readonly auth = inject(Auth);

  protected readonly modalProposer = MODAL_PROPOSER;

  readonly evenement = signal<Evenement | null>(null);
  readonly trajets = signal<TrajetAvecConducteur[]>([]);
  readonly mesInscriptions = signal<Set<string>>(new Set());
  readonly occupantsParTrajet = signal<Record<string, Occupant[]>>({});
  readonly loading = signal(true);
  readonly erreur = signal<string | null>(null);

  readonly adresseDepart = signal('');
  readonly horaireDepart = signal('');
  readonly placesTotales = signal(1);
  readonly telephoneContact = signal('');
  readonly creationEnCours = signal(false);
  readonly creationErreur = signal<string | null>(null);

  readonly commentaires = signal<CommentaireAvecAuteur[]>([]);
  readonly nouveauCommentaire = signal('');
  readonly commentaireEnCours = signal(false);
  readonly commentaireErreur = signal<string | null>(null);

  private evenementId = '';

  async ngOnInit(): Promise<void> {
    this.evenementId = this.route.snapshot.paramMap.get('id') ?? '';
    await this.charger();
  }

  private async charger(): Promise<void> {
    this.loading.set(true);
    this.erreur.set(null);

    const userId = this.auth.session()?.user.id ?? '';

    const [evenementRes, trajetsRes, inscriptionsRes, commentairesRes] = await Promise.all([
      this.supabase.from('evenements').select('*').eq('id', this.evenementId).single(),
      this.supabase
        .from('trajets')
        .select('*, profiles(prenom, nom)')
        .eq('evenement_id', this.evenementId)
        .order('horaire_depart', { ascending: true }),
      this.supabase.from('inscriptions').select('trajet_id').eq('passager_id', userId),
      this.supabase
        .from('commentaires')
        .select('*, profiles(prenom, nom)')
        .eq('evenement_id', this.evenementId)
        .order('created_at', { ascending: true }),
    ]);

    this.loading.set(false);

    if (evenementRes.error || trajetsRes.error) {
      this.erreur.set(
        evenementRes.error?.message ?? trajetsRes.error?.message ?? 'Erreur de chargement',
      );
      return;
    }

    this.evenement.set(evenementRes.data as Evenement);
    this.trajets.set((trajetsRes.data ?? []) as TrajetAvecConducteur[]);
    this.mesInscriptions.set(
      new Set((inscriptionsRes.data ?? []).map((i) => i['trajet_id'] as string)),
    );
    this.commentaires.set((commentairesRes.data ?? []) as CommentaireAvecAuteur[]);

    await this.chargerOccupants();
  }

  private async chargerOccupants(): Promise<void> {
    const trajetIds = this.trajets().map((t) => t.id);
    if (trajetIds.length === 0) {
      this.occupantsParTrajet.set({});
      return;
    }

    const { data, error } = await this.supabase
      .from('inscriptions')
      .select('trajet_id, profiles(prenom, nom)')
      .in('trajet_id', trajetIds);

    if (error) {
      return;
    }

    const parTrajet: Record<string, Occupant[]> = {};
    for (const ligne of data ?? []) {
      const occupant = ligne['profiles'] as unknown as Occupant | null;
      if (!occupant) {
        continue;
      }
      const trajetId = ligne['trajet_id'] as string;
      (parTrajet[trajetId] ??= []).push(occupant);
    }

    this.occupantsParTrajet.set(parTrajet);
  }

  occupants(trajet: Trajet): Occupant[] {
    return this.occupantsParTrajet()[trajet.id] ?? [];
  }

  async posterCommentaire(): Promise<void> {
    this.commentaireErreur.set(null);

    const contenu = this.nouveauCommentaire().trim();
    if (!contenu) {
      return;
    }

    const auteurId = this.auth.session()?.user.id;
    if (!auteurId) {
      return;
    }

    this.commentaireEnCours.set(true);

    const { error } = await this.supabase.from('commentaires').insert({
      evenement_id: this.evenementId,
      auteur_id: auteurId,
      contenu,
    });

    this.commentaireEnCours.set(false);

    if (error) {
      this.commentaireErreur.set(error.message);
      return;
    }

    this.nouveauCommentaire.set('');
    await this.chargerCommentaires();
  }

  async supprimerCommentaire(commentaire: CommentaireAvecAuteur): Promise<void> {
    const { error } = await this.supabase.from('commentaires').delete().eq('id', commentaire.id);

    if (error) {
      j6n.toast(error.message, { tone: 'danger' });
      return;
    }

    await this.chargerCommentaires();
  }

  estAuteur(commentaire: CommentaireAvecAuteur): boolean {
    return commentaire.auteur_id === this.auth.session()?.user.id;
  }

  private async chargerCommentaires(): Promise<void> {
    const { data, error } = await this.supabase
      .from('commentaires')
      .select('*, profiles(prenom, nom)')
      .eq('evenement_id', this.evenementId)
      .order('created_at', { ascending: true });

    if (error) {
      this.commentaireErreur.set(error.message);
      return;
    }

    this.commentaires.set((data ?? []) as CommentaireAvecAuteur[]);
  }

  estConducteur(trajet: Trajet): boolean {
    return trajet.conducteur_id === this.auth.session()?.user.id;
  }

  estInscrit(trajet: Trajet): boolean {
    return this.mesInscriptions().has(trajet.id);
  }

  async rejoindre(trajet: Trajet): Promise<void> {
    const { error } = await this.supabase.rpc('rejoindre_trajet', { p_trajet_id: trajet.id });

    if (error) {
      j6n.toast(error.message, { tone: 'danger' });
      return;
    }

    j6n.toast('Trajet rejoint !', { tone: 'success' });
    await this.charger();
  }

  async quitter(trajet: Trajet): Promise<void> {
    const { error } = await this.supabase.rpc('quitter_trajet', { p_trajet_id: trajet.id });

    if (error) {
      j6n.toast(error.message, { tone: 'danger' });
      return;
    }

    j6n.toast('Tu as quitté le trajet.', { tone: 'success' });
    await this.charger();
  }

  async annuler(trajet: Trajet): Promise<void> {
    const inscrits = trajet.places_totales - trajet.places_disponibles;
    const message =
      inscrits > 0
        ? `Annuler ce trajet désinscrira les ${inscrits} passager(s) déjà inscrit(s). Confirmer ?`
        : 'Annuler ce trajet ?';

    if (!confirm(message)) {
      return;
    }

    const { error } = await this.supabase.from('trajets').delete().eq('id', trajet.id);

    if (error) {
      j6n.toast(error.message, { tone: 'danger' });
      return;
    }

    j6n.toast('Trajet annulé.', { tone: 'success' });
    await this.charger();
  }

  async proposer(): Promise<void> {
    this.creationErreur.set(null);

    const conducteurId = this.auth.session()?.user.id;
    if (!conducteurId) {
      return;
    }

    this.creationEnCours.set(true);

    const { error } = await this.supabase.from('trajets').insert({
      evenement_id: this.evenementId,
      conducteur_id: conducteurId,
      adresse_depart: this.adresseDepart(),
      horaire_depart: this.horaireDepart(),
      places_totales: this.placesTotales(),
      places_disponibles: this.placesTotales(),
      telephone_contact: this.telephoneContact().trim() || null,
    });

    this.creationEnCours.set(false);

    if (error) {
      this.creationErreur.set(error.message);
      return;
    }

    this.adresseDepart.set('');
    this.horaireDepart.set('');
    this.placesTotales.set(1);
    this.telephoneContact.set('');
    j6n.closeModal(MODAL_PROPOSER);
    j6n.toast('Trajet proposé !', { tone: 'success' });
    await this.charger();
  }
}
