export interface SecteurRequest  { nom: string; }
export interface SecteurResponse { id: number; nom: string; }

export interface EntrepriseRequest {
  nom: string; adresse: string; telephone: string;
  secteurId: number; gerantId: number;
}
export interface EntrepriseResponse {
  id: number; nom: string; adresse: string; telephone: string;
  secteurId: number; secteurNom: string;
  gerantId: number; gerantNom: string; gerantPrenom: string;
}

export interface EmployeRequest {
  nom: string; prenom: string; email: string;
  password?: string; specialite?: string;
  entrepriseId?: number;
}
export interface EmployeResponse {
  id: number; nom: string; prenom: string; email: string;
  specialite: string; archived: boolean;
  entrepriseId: number | null;
  entrepriseNom: string | null;
}

export interface EmployeCheckResponse {
  status: string;
  message?: string;
  nom: string | null;
  prenom: string | null;
  email: string;
  specialite?: string;
  archived?: boolean;
  entrepriseNom?: string;
}

export interface RattachementRequest {
  email: string;
  entrepriseId?: number;
  specialite?: string;
}

export interface ClientRequest {
  nom: string; prenom: string; email: string; password: string; numtel: string;
  entrepriseId?: number;
}
export interface ClientResponse {
  id: number; nom: string; prenom: string; email: string;
  numtel: string; archived: boolean; createdBy: string;
  entreprises?: { id: number; nom: string; secteur?: string }[];
}

export interface RessourceInlineRequest {
  nom: string;
  description?: string;
  capacite?: number;
}

export interface ServiceRequest {
  nom: string; description?: string; dureeMinutes: number; tarif?: number | null;
  entrepriseId?: number;
  typeService?: string;
  ressources?: RessourceInlineRequest[];
}
export interface ServiceResponse {
  id: number; nom: string; description: string;
  dureeMinutes: number; tarif: number | null; entrepriseId: number;
}

export type TypeService = 'EMPLOYE_DEDIE' | 'RESSOURCE_PARTAGEE' | 'FILE_ATTENTE_PURE' | 'HYBRIDE';

export interface ConfigServiceRequest {
  serviceId: number;
  typeService: TypeService;
  dureeMinutes?: number | null;
  capaciteMinPersonnes?: number | null;
  capaciteMaxPersonnes?: number | null;
  ressourceObligatoire: boolean;
  employeObligatoire: boolean;
  reservationEnGroupe: boolean;
  fileAttenteActive: boolean;
  avanceReservationJours?: number | null;
  annulationHeures?: number | null;
  tarifParPersonne?: boolean;  // false=tarif fixe, true=tarif × nombre de personnes
}
export interface ConfigServiceResponse {
  id: number;
  serviceId: number; serviceNom: string;
  typeService: TypeService;
  dureeMinutes: number | null;
  capaciteMinPersonnes: number | null;
  capaciteMaxPersonnes: number | null;
  ressourceObligatoire: boolean;
  employeObligatoire: boolean;
  reservationEnGroupe: boolean;
  fileAttenteActive: boolean;
  avanceReservationJours: number | null;
  annulationHeures: number | null;
  tarifParPersonne: boolean;   // false=tarif fixe, true=tarif × nombre de personnes
}

export interface RessourceRequest {
  nom: string; description?: string; serviceId: number;
}
export interface RessourceResponse {
  id: number; nom: string; description: string;
  archived: boolean;
  serviceId: number; serviceNom: string; entrepriseId: number;
}

export interface ReservationRequest {
  clientId: number;
  serviceId: number;
  employeId?: number | null;
  ressourceId?: number | null;
  heureDebut: string;
  nombrePersonnes?: number;
  notes?: string;
}
export interface ReservationResponse {
  id: number;
  clientId: number; clientNom: string; clientPrenom: string;
  employeId: number | null; employeNom: string | null; employePrenom: string | null;
  serviceId: number; serviceNom: string;
  ressourceId: number | null; ressourceNom: string | null;
  heureDebut: string;
  heureFin: string;
  nombrePersonnes: number;
  prixTotal: number | null;
  statut: StatutReservation;
  notes: string;
}

export interface FileAttenteRequest {
  clientId: number;
  employeId?: number | null;    // EMPLOYE_DEDIE / HYBRIDE
  serviceId: number;
  heureDebut?: string;          // RESSOURCE_PARTAGEE : créneau souhaité
  reservationId?: number | null; // EMPLOYE_DEDIE / HYBRIDE
}
export interface FileAttenteResponse {
  id: number;
  clientId: number;
  clientNom: string; clientPrenom: string;
  employeId: number | null;
  employeNom: string | null; employePrenom: string | null;
  serviceId: number;
  serviceNom: string;
  entrepriseId: number | null;
  entrepriseNom: string | null;
  reservationId: number | null;
  ressourceNom: string | null;
  heureDebut: string | null;
  heureArrivee: string;
  dateHeureRdv: string | null;
  statut: StatutFileAttente;
}

export interface DisponibiliteRequest {
  serviceId: number;
  jour: JourSemaine;
  heureDebut: string;
  heureFin: string;
}
export interface DisponibiliteResponse {
  id: number;
  serviceId: number; serviceNom: string;
  jour: JourSemaine;
  heureDebut: string;
  heureFin: string;
}

export interface CreneauResponse {
  heureDebut: string; heureFin: string;
}

export interface AvisRequest {
  reservationId: number; note: number; commentaire?: string;
}
export interface AvisResponse {
  id: number; clientNom: string; clientPrenom: string;
  employeNom: string; employePrenom: string; serviceNom: string;
  note: number; commentaire: string; dateAvis: string;
}

export interface GerantResponse {
  id: number; nom: string; prenom: string; email: string; archived: boolean;
  entrepriseNom?: string;
  entrepriseSecteur?: string;
  entrepriseTelephone?: string;
  entrepriseAdresse?: string;
}

export interface AuthUser {
  id: number;
  email: string;
  roles: string[];
  token: string;
  nom: string;
  prenom: string;
  entrepriseId: number | null;
}

export interface JwtResponse {
  id: number;
  email: string;
  roles: string[];
  token: string;
  nom: string;
  prenom: string;
  entrepriseId: number | null;
}

export type StatutReservation = 'EN_ATTENTE' | 'CONFIRMEE' | 'EN_COURS' | 'ANNULEE' | 'TERMINEE';
export type StatutFileAttente = 'EN_ATTENTE' | 'APPELE' | 'EN_COURS' | 'TERMINE' | 'ANNULE' | 'EXPIRE';
export type JourSemaine = 'LUNDI' | 'MARDI' | 'MERCREDI' | 'JEUDI' | 'VENDREDI' | 'SAMEDI' | 'DIMANCHE';