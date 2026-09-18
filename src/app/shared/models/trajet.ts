export interface Trajet {
  id: string;
  evenement_id: string;
  conducteur_id: string;
  adresse_depart: string;
  horaire_depart: string;
  places_totales: number;
  places_disponibles: number;
  telephone_contact: string | null;
  created_at: string;
}
