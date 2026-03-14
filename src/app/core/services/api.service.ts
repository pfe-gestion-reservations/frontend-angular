import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  SecteurRequest, SecteurResponse,
  EntrepriseRequest, EntrepriseResponse,
  EmployeRequest, EmployeResponse,
  ClientRequest, ClientResponse,
  ServiceRequest, ServiceResponse,
  ConfigServiceRequest, ConfigServiceResponse,
  RessourceRequest, RessourceResponse,
  ReservationRequest, ReservationResponse,
  FileAttenteRequest, FileAttenteResponse,
  AvisRequest, AvisResponse,
  DisponibiliteRequest, DisponibiliteResponse,
  CreneauResponse, StatutReservation,
  GerantResponse
} from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private api = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // ── SECTEURS ──────────────────────────────────────────────
  getSecteurs(): Observable<SecteurResponse[]> { return this.http.get<SecteurResponse[]>(`${this.api}/secteurs`); }
  createSecteur(d: SecteurRequest): Observable<SecteurResponse> { return this.http.post<SecteurResponse>(`${this.api}/secteurs`, d); }
  updateSecteur(id: number, d: SecteurRequest): Observable<SecteurResponse> { return this.http.put<SecteurResponse>(`${this.api}/secteurs/${id}`, d); }
  deleteSecteur(id: number): Observable<any> { return this.http.delete(`${this.api}/secteurs/${id}`, { responseType: 'text' }); }

  // ── ENTREPRISES ───────────────────────────────────────────
  getEntreprises(): Observable<EntrepriseResponse[]> { return this.http.get<EntrepriseResponse[]>(`${this.api}/entreprises`); }
  getEntreprise(id: number): Observable<EntrepriseResponse> { return this.http.get<EntrepriseResponse>(`${this.api}/entreprises/${id}`); }
  createEntreprise(d: EntrepriseRequest): Observable<EntrepriseResponse> { return this.http.post<EntrepriseResponse>(`${this.api}/entreprises`, d); }
  updateEntreprise(id: number, d: EntrepriseRequest): Observable<EntrepriseResponse> { return this.http.put<EntrepriseResponse>(`${this.api}/entreprises/${id}`, d); }
  deleteEntreprise(id: number): Observable<any> { return this.http.delete(`${this.api}/entreprises/${id}`, { responseType: 'text' }); }

  // ── EMPLOYES ──────────────────────────────────────────────
  checkEmployeEmail(email: string, entrepriseId?: number): Observable<any> {
    const params = entrepriseId
      ? `?email=${encodeURIComponent(email)}&entrepriseId=${entrepriseId}`
      : `?email=${encodeURIComponent(email)}`;
    return this.http.get<any>(`${this.api}/employes/check-email${params}`);
  }
  checkEmailEmploye(email: string, entrepriseId?: number): Observable<any> { return this.checkEmployeEmail(email, entrepriseId); }
  rattacherEmploye(req: any): Observable<any> { return this.http.post<any>(`${this.api}/employes/rattacher`, req); }
  getEntreprisesBySecteur(secteurId: number): Observable<any[]> { return this.http.get<any[]>(`${this.api}/entreprises/by-secteur/${secteurId}`); }
  getEmployes(): Observable<EmployeResponse[]> { return this.http.get<EmployeResponse[]>(`${this.api}/employes`); }
  getEmployesByEntreprise(entrepriseId: number): Observable<EmployeResponse[]> { return this.http.get<EmployeResponse[]>(`${this.api}/employes/entreprise/${entrepriseId}`); }
  getEmploye(id: number): Observable<EmployeResponse> { return this.http.get<EmployeResponse>(`${this.api}/employes/${id}`); }
  createEmploye(d: EmployeRequest): Observable<EmployeResponse> { return this.http.post<EmployeResponse>(`${this.api}/employes`, d); }
  updateEmploye(id: number, d: EmployeRequest): Observable<EmployeResponse> { return this.http.put<EmployeResponse>(`${this.api}/employes/${id}`, d); }
  archiverEmploye(id: number): Observable<any> { return this.http.patch(`${this.api}/employes/${id}/archiver`, {}, { responseType: 'text' }); }
  desarchiverEmploye(id: number): Observable<any> { return this.http.patch(`${this.api}/employes/${id}/desarchiver`, {}, { responseType: 'text' }); }

  // ── CLIENTS ───────────────────────────────────────────────
  getClients(): Observable<ClientResponse[]> { return this.http.get<ClientResponse[]>(`${this.api}/clients`); }
  getClient(id: number): Observable<ClientResponse> { return this.http.get<ClientResponse>(`${this.api}/clients/${id}`); }
  createClient(d: ClientRequest): Observable<ClientResponse> { return this.http.post<ClientResponse>(`${this.api}/clients`, d); }
  updateClient(id: number, d: ClientRequest): Observable<ClientResponse> { return this.http.put<ClientResponse>(`${this.api}/clients/${id}`, d); }
  archiverClient(id: number): Observable<any> { return this.http.patch(`${this.api}/clients/${id}/archiver`, {}, { responseType: 'text' }); }
  desarchiverClient(id: number): Observable<any> { return this.http.patch(`${this.api}/clients/${id}/desarchiver`, {}, { responseType: 'text' }); }
  getClientByTelephone(numtel: string): Observable<any> {
    return this.http.get<any>(`${this.api}/clients/by-telephone/${encodeURIComponent(numtel)}`);
  }
  associerClientAEntreprise(clientId: number, entrepriseId: number): Observable<any> {
    return this.http.post<any>(`${this.api}/clients/${clientId}/entreprise/${entrepriseId}/associer`, {});
  }
  dissocierClientDeEntreprise(clientId: number, entrepriseId: number): Observable<any> {
    return this.http.delete(`${this.api}/clients/${clientId}/entreprise/${entrepriseId}/dissocier`, { responseType: 'text' });
  }
  checkClientEmail(email: string): Observable<any> {
    return this.http.get<any>(`${this.api}/clients/check-email?email=${encodeURIComponent(email)}`);
  }
  desarchiverEtAssocierClient(clientId: number, entrepriseId?: number): Observable<any> {
    const params = entrepriseId ? `?entrepriseId=${entrepriseId}` : '';
    return this.http.post<any>(`${this.api}/clients/${clientId}/desarchiver-associer${params}`, {});
  }

  // ── SERVICES ──────────────────────────────────────────────
  getServices(): Observable<ServiceResponse[]> { return this.http.get<ServiceResponse[]>(`${this.api}/services`); }
  getServicesByEntreprise(entrepriseId: number): Observable<ServiceResponse[]> { return this.http.get<ServiceResponse[]>(`${this.api}/services/by-entreprise/${entrepriseId}`); }
  getService(id: number): Observable<ServiceResponse> { return this.http.get<ServiceResponse>(`${this.api}/services/${id}`); }
  createService(d: ServiceRequest): Observable<ServiceResponse> { return this.http.post<ServiceResponse>(`${this.api}/services`, d); }
  updateService(id: number, d: ServiceRequest): Observable<ServiceResponse> { return this.http.put<ServiceResponse>(`${this.api}/services/${id}`, d); }
  archiverService(id: number): Observable<any> { return this.http.patch(`${this.api}/services/${id}/archiver`, {}, { responseType: 'text' }); }
  desarchiverService(id: number): Observable<any> { return this.http.patch(`${this.api}/services/${id}/desarchiver`, {}, { responseType: 'text' }); }

  // ── CONFIG SERVICE ────────────────────────────────────────
  getConfigService(serviceId: number): Observable<ConfigServiceResponse> { return this.http.get<ConfigServiceResponse>(`${this.api}/config-services/service/${serviceId}`); }
  saveConfigService(d: ConfigServiceRequest): Observable<ConfigServiceResponse> { return this.http.post<ConfigServiceResponse>(`${this.api}/config-services`, d); }
  deleteConfigService(serviceId: number): Observable<any> { return this.http.delete(`${this.api}/config-services/service/${serviceId}`, { responseType: 'text' }); }

  // ── RESSOURCES ────────────────────────────────────────────
  getRessourcesByService(serviceId: number): Observable<RessourceResponse[]> { return this.http.get<RessourceResponse[]>(`${this.api}/ressources/service/${serviceId}`); }
  getRessources(): Observable<RessourceResponse[]> { return this.http.get<RessourceResponse[]>(`${this.api}/ressources`); }
  createRessource(d: RessourceRequest): Observable<RessourceResponse> { return this.http.post<RessourceResponse>(`${this.api}/ressources`, d); }
  updateRessource(id: number, d: RessourceRequest): Observable<RessourceResponse> { return this.http.put<RessourceResponse>(`${this.api}/ressources/${id}`, d); }
  archiverRessource(id: number): Observable<any> { return this.http.patch(`${this.api}/ressources/${id}/archiver`, {}, { responseType: 'text' }); }
  desarchiverRessource(id: number): Observable<any> { return this.http.patch(`${this.api}/ressources/${id}/desarchiver`, {}, { responseType: 'text' }); }

  // ── RESERVATIONS ──────────────────────────────────────────
  getReservations(): Observable<ReservationResponse[]> { return this.http.get<ReservationResponse[]>(`${this.api}/reservations`); }
  getReservation(id: number): Observable<ReservationResponse> { return this.http.get<ReservationResponse>(`${this.api}/reservations/${id}`); }
  createReservation(d: ReservationRequest): Observable<ReservationResponse> { return this.http.post<ReservationResponse>(`${this.api}/reservations`, d); }
  updateReservation(id: number, d: ReservationRequest): Observable<ReservationResponse> { return this.http.put<ReservationResponse>(`${this.api}/reservations/${id}`, d); }
  changerStatutReservation(id: number, statut: StatutReservation): Observable<ReservationResponse> {
    const params = new HttpParams().set('statut', statut);
    return this.http.patch<ReservationResponse>(`${this.api}/reservations/${id}/statut`, {}, { params });
  }

  // ── FILE D'ATTENTE ────────────────────────────────────────
  getFileAttente(): Observable<FileAttenteResponse[]> { return this.http.get<FileAttenteResponse[]>(`${this.api}/file-attente`); }
  ajouterFileAttente(d: FileAttenteRequest): Observable<FileAttenteResponse> { return this.http.post<FileAttenteResponse>(`${this.api}/file-attente`, d); }
  appeler(id: number): Observable<FileAttenteResponse> { return this.http.put<FileAttenteResponse>(`${this.api}/file-attente/${id}/appeler`, {}); }
  demarrer(id: number): Observable<FileAttenteResponse> { return this.http.put<FileAttenteResponse>(`${this.api}/file-attente/${id}/demarrer`, {}); }
  terminer(id: number): Observable<FileAttenteResponse> { return this.http.put<FileAttenteResponse>(`${this.api}/file-attente/${id}/terminer`, {}); }
  annuler(id: number): Observable<FileAttenteResponse> { return this.http.put<FileAttenteResponse>(`${this.api}/file-attente/${id}/annuler`, {}); }
  annulerAdmin(id: number): Observable<FileAttenteResponse> { return this.http.put<FileAttenteResponse>(`${this.api}/file-attente/${id}/annuler/admin`, {}); }

  // ── AVIS ──────────────────────────────────────────────────
  getAvis(): Observable<AvisResponse[]> { return this.http.get<AvisResponse[]>(`${this.api}/avis`); }
  getAvisByService(serviceId: number): Observable<AvisResponse[]> { return this.http.get<AvisResponse[]>(`${this.api}/avis/service/${serviceId}`); }
  createAvis(d: AvisRequest): Observable<AvisResponse> { return this.http.post<AvisResponse>(`${this.api}/avis`, d); }

  // ── DISPONIBILITES ────────────────────────────────────────
  getDispoByService(serviceId: number): Observable<DisponibiliteResponse[]> { return this.http.get<DisponibiliteResponse[]>(`${this.api}/disponibilites/service/${serviceId}`); }
  createDispo(d: DisponibiliteRequest): Observable<DisponibiliteResponse> { return this.http.post<DisponibiliteResponse>(`${this.api}/disponibilites`, d); }
  updateDispo(id: number, d: DisponibiliteRequest): Observable<DisponibiliteResponse> { return this.http.put<DisponibiliteResponse>(`${this.api}/disponibilites/${id}`, d); }
  deleteDispo(id: number): Observable<any> { return this.http.delete(`${this.api}/disponibilites/${id}`, { responseType: 'text' }); }

  // ── CRENEAUX ──────────────────────────────────────────────
  getCreneaux(serviceId: number, date: string): Observable<CreneauResponse[]> {
    const params = new HttpParams().set('serviceId', serviceId).set('date', date);
    return this.http.get<CreneauResponse[]>(`${this.api}/creneaux`, { params });
  }

  // ── GERANTS ───────────────────────────────────────────────
  checkGerantEmail(email: string): Observable<any> {
    return this.http.get<any>(`${this.api}/gerants/check-email?email=${encodeURIComponent(email)}`);
  }
  getGerants(): Observable<GerantResponse[]> { return this.http.get<GerantResponse[]>(`${this.api}/gerants`); }
  getGerantsDisponibles(): Observable<GerantResponse[]> { return this.http.get<GerantResponse[]>(`${this.api}/gerants/disponibles`); }
  updateGerant(id: number, d: any): Observable<any> { return this.http.put(`${this.api}/gerants/${id}`, d); }
  archiverGerant(id: number, remplacantId?: number): Observable<any> {
    const body = remplacantId ? { remplacantId } : {};
    return this.http.patch(`${this.api}/gerants/${id}/archiver`, body, { responseType: 'text' });
  }
  desarchiverGerant(id: number): Observable<any> { return this.http.patch(`${this.api}/gerants/${id}/desarchiver`, {}, { responseType: 'text' }); }
}