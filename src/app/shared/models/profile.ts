export type Role = 'admin' | 'membre';
export type Statut = 'en_attente' | 'valide' | 'refuse';

export interface Profile {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: Role;
  statut: Statut;
  created_at: string;
}
