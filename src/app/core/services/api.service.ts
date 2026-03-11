import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  SecteurRequest, SecteurResponse,
  EntrepriseRequest, EntrepriseResponse,
  EmployeRequest, EmployeResponse, EmployeCheckResponse, RattachementRequest,
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

  private getHeaders(): HttpHeaders {
    try {
      const raw = localStorage.getItem('auth_user');
      const token = raw ? JSON.parse(raw).token : null;
      if (token) return new HttpHeaders({ Authorization: `Bearer ${token}` });
    } catch {}
    return new HttpHeaders();
  }

  // ── SECTEURS ──────────────────────────────────────────────
  getSecteurs(): Observable<SecteurResponse[]> { return this.http.get<SecteurResponse[]>(`${this.api}/secteurs`, { headers: this.getHeaders() }); }
  createSecteur(d: SecteurRequest): Observable<SecteurResponse> { return this.http.post<SecteurResponse>(`${this.api}/secteurs`, d, { headers: this.getHeaders() }); }
  updateSecteur(id: number, d: SecteurRequest): Observable<SecteurResponse> { return this.http.put<SecteurResponse>(`${this.api}/secteurs/${id}`, d, { headers: this.getHeaders() }); }
  deleteSecteur(id: number): Observable<any> { return this.http.delete(`${this.api}/secteurs/${id}`, { headers: this.getHeaders(), responseType: 'text' }); }

  // ── ENTREPRISES ───────────────────────────────────────────
  getEntreprises(): Observable<EntrepriseResponse[]> { return this.http.get<EntrepriseResponse[]>(`${this.api}/entreprises`, { headers: this.getHeaders() }); }
  getEntreprisesBySecteur(secteurId: number): Observable<EntrepriseResponse[]> { return this.http.get<EntrepriseResponse[]>(`${this.api}/entreprises/secteur/${secteurId}`, { headers: this.getHeaders() }); }
  getEntreprise(id: number): Observable<EntrepriseResponse> { return this.http.get<EntrepriseResponse>(`${this.api}/entreprises/${id}`, { headers: this.getHeaders() }); }
  createEntreprise(d: EntrepriseRequest): Observable<EntrepriseResponse> { return this.http.post<EntrepriseResponse>(`${this.api}/entreprises`, d, { headers: this.getHeaders() }); }
  updateEntreprise(id: number, d: EntrepriseRequest): Observable<EntrepriseResponse> { return this.http.put<EntrepriseResponse>(`${this.api}/entreprises/${id}`, d, { headers: this.getHeaders() }); }
  deleteEntreprise(id: number): Observable<any> { return this.http.delete(`${this.api}/entreprises/${id}`, { headers: this.getHeaders(), responseType: 'text' }); }

  // ── EMPLOYES ──────────────────────────────────────────────
  getEmployes(): Observable<EmployeResponse[]> { return this.http.get<EmployeResponse[]>(`${this.api}/employes`, { headers: this.getHeaders() }); }
  getEmployesByEntreprise(entrepriseId: number): Observable<EmployeResponse[]> { return this.http.get<EmployeResponse[]>(`${this.api}/employes/entreprise/${entrepriseId}`, { headers: this.getHeaders() }); }
  getEmploye(id: number): Observable<EmployeResponse> { return this.http.get<EmployeResponse>(`${this.api}/employes/${id}`, { headers: this.getHeaders() }); }
  // Vérifier un email avant création (NOUVEAU / LIBRE / OCCUPE)
  checkEmailEmploye(email: string, entrepriseId?: number): Observable<EmployeCheckResponse> {
    let params = new HttpParams().set('email', email);
    if (entrepriseId) params = params.set('entrepriseId', entrepriseId);
    return this.http.get<EmployeCheckResponse>(`${this.api}/employes/check-email`, { headers: this.getHeaders(), params });
  }
  // Créer un nouveau compte employé
  createEmploye(d: EmployeRequest): Observable<EmployeResponse> { return this.http.post<EmployeResponse>(`${this.api}/employes`, d, { headers: this.getHeaders() }); }
  // Rattacher un user existant libre à l'entreprise
  rattacherEmploye(d: RattachementRequest): Observable<EmployeResponse> { return this.http.post<EmployeResponse>(`${this.api}/employes/rattacher`, d, { headers: this.getHeaders() }); }
  updateEmploye(id: number, d: EmployeRequest): Observable<EmployeResponse> { return this.http.put<EmployeResponse>(`${this.api}/employes/${id}`, d, { headers: this.getHeaders() }); }
  archiverEmploye(id: number): Observable<EmployeResponse> { return this.http.patch<EmployeResponse>(`${this.api}/employes/${id}/archiver`, {}, { headers: this.getHeaders() }); }
  desarchiverEmploye(id: number): Observable<EmployeResponse> { return this.http.patch<EmployeResponse>(`${this.api}/employes/${id}/desarchiver`, {}, { headers: this.getHeaders() }); }

  // ── CLIENTS ───────────────────────────────────────────────
  getClients(): Observable<ClientResponse[]> { return this.http.get<ClientResponse[]>(`${this.api}/clients`, { headers: this.getHeaders() }); }
  getClient(id: number): Observable<ClientResponse> { return this.http.get<ClientResponse>(`${this.api}/clients/${id}`, { headers: this.getHeaders() }); }
  createClient(d: ClientRequest): Observable<ClientResponse> { return this.http.post<ClientResponse>(`${this.api}/clients`, d, { headers: this.getHeaders() }); }
  updateClient(id: number, d: ClientRequest): Observable<ClientResponse> { return this.http.put<ClientResponse>(`${this.api}/clients/${id}`, d, { headers: this.getHeaders() }); }
  archiverClient(id: number): Observable<any> { return this.http.patch(`${this.api}/clients/${id}/archiver`, {}, { headers: this.getHeaders(), responseType: 'text' }); }
  desarchiverClient(id: number): Observable<any> { return this.http.patch(`${this.api}/clients/${id}/desarchiver`, {}, { headers: this.getHeaders(), responseType: 'text' }); }

  // ── SERVICES ──────────────────────────────────────────────
  getServices(): Observable<ServiceResponse[]> { return this.http.get<ServiceResponse[]>(`${this.api}/services`, { headers: this.getHeaders() }); }
  getService(id: number): Observable<ServiceResponse> { return this.http.get<ServiceResponse>(`${this.api}/services/${id}`, { headers: this.getHeaders() }); }
  createService(d: ServiceRequest): Observable<ServiceResponse> { return this.http.post<ServiceResponse>(`${this.api}/services`, d, { headers: this.getHeaders() }); }
  updateService(id: number, d: ServiceRequest): Observable<ServiceResponse> { return this.http.put<ServiceResponse>(`${this.api}/services/${id}`, d, { headers: this.getHeaders() }); }
  archiverService(id: number): Observable<any> { return this.http.patch(`${this.api}/services/${id}/archiver`, {}, { headers: this.getHeaders(), responseType: 'text' }); }
  desarchiverService(id: number): Observable<any> { return this.http.patch(`${this.api}/services/${id}/desarchiver`, {}, { headers: this.getHeaders(), responseType: 'text' }); }

  // ── CONFIG SERVICE ────────────────────────────────────────
  getConfigService(serviceId: number): Observable<ConfigServiceResponse> { return this.http.get<ConfigServiceResponse>(`${this.api}/config-services/service/${serviceId}`, { headers: this.getHeaders() }); }
  saveConfigService(d: ConfigServiceRequest): Observable<ConfigServiceResponse> { return this.http.post<ConfigServiceResponse>(`${this.api}/config-services`, d, { headers: this.getHeaders() }); }
  deleteConfigService(serviceId: number): Observable<any> { return this.http.delete(`${this.api}/config-services/service/${serviceId}`, { headers: this.getHeaders(), responseType: 'text' }); }

  // ── RESSOURCES ────────────────────────────────────────────
  getRessourcesByService(serviceId: number): Observable<RessourceResponse[]> { return this.http.get<RessourceResponse[]>(`${this.api}/ressources/service/${serviceId}`, { headers: this.getHeaders() }); }
  getRessources(): Observable<RessourceResponse[]> { return this.http.get<RessourceResponse[]>(`${this.api}/ressources`, { headers: this.getHeaders() }); }
  createRessource(d: RessourceRequest): Observable<RessourceResponse> { return this.http.post<RessourceResponse>(`${this.api}/ressources`, d, { headers: this.getHeaders() }); }
  updateRessource(id: number, d: RessourceRequest): Observable<RessourceResponse> { return this.http.put<RessourceResponse>(`${this.api}/ressources/${id}`, d, { headers: this.getHeaders() }); }
  archiverRessource(id: number): Observable<any> { return this.http.patch(`${this.api}/ressources/${id}/archiver`, {}, { headers: this.getHeaders(), responseType: 'text' }); }
  desarchiverRessource(id: number): Observable<any> { return this.http.patch(`${this.api}/ressources/${id}/desarchiver`, {}, { headers: this.getHeaders(), responseType: 'text' }); }

  // ── RESERVATIONS ──────────────────────────────────────────
  getReservations(): Observable<ReservationResponse[]> { return this.http.get<ReservationResponse[]>(`${this.api}/reservations`, { headers: this.getHeaders() }); }
  getReservation(id: number): Observable<ReservationResponse> { return this.http.get<ReservationResponse>(`${this.api}/reservations/${id}`, { headers: this.getHeaders() }); }
  createReservation(d: ReservationRequest): Observable<ReservationResponse> { return this.http.post<ReservationResponse>(`${this.api}/reservations`, d, { headers: this.getHeaders() }); }
  updateReservation(id: number, d: ReservationRequest): Observable<ReservationResponse> { return this.http.put<ReservationResponse>(`${this.api}/reservations/${id}`, d, { headers: this.getHeaders() }); }
  changerStatutReservation(id: number, statut: StatutReservation): Observable<ReservationResponse> {
    const params = new HttpParams().set('statut', statut);
    return this.http.patch<ReservationResponse>(`${this.api}/reservations/${id}/statut`, {}, { headers: this.getHeaders(), params });
  }

  // ── FILE D'ATTENTE ────────────────────────────────────────
  getFileAttente(): Observable<FileAttenteResponse[]> { return this.http.get<FileAttenteResponse[]>(`${this.api}/file-attente`, { headers: this.getHeaders() }); }
  ajouterFileAttente(d: FileAttenteRequest): Observable<FileAttenteResponse> { return this.http.post<FileAttenteResponse>(`${this.api}/file-attente`, d, { headers: this.getHeaders() }); }
  appeler(id: number): Observable<FileAttenteResponse> { return this.http.put<FileAttenteResponse>(`${this.api}/file-attente/${id}/appeler`, {}, { headers: this.getHeaders() }); }
  demarrer(id: number): Observable<FileAttenteResponse> { return this.http.put<FileAttenteResponse>(`${this.api}/file-attente/${id}/demarrer`, {}, { headers: this.getHeaders() }); }
  terminer(id: number): Observable<FileAttenteResponse> { return this.http.put<FileAttenteResponse>(`${this.api}/file-attente/${id}/terminer`, {}, { headers: this.getHeaders() }); }
  annuler(id: number): Observable<FileAttenteResponse> { return this.http.put<FileAttenteResponse>(`${this.api}/file-attente/${id}/annuler`, {}, { headers: this.getHeaders() }); }
  annulerAdmin(id: number): Observable<FileAttenteResponse> { return this.http.put<FileAttenteResponse>(`${this.api}/file-attente/${id}/annuler/admin`, {}, { headers: this.getHeaders() }); }

  // ── AVIS ──────────────────────────────────────────────────
  getAvis(): Observable<AvisResponse[]> { return this.http.get<AvisResponse[]>(`${this.api}/avis`, { headers: this.getHeaders() }); }
  getAvisByService(serviceId: number): Observable<AvisResponse[]> { return this.http.get<AvisResponse[]>(`${this.api}/avis/service/${serviceId}`, { headers: this.getHeaders() }); }
  createAvis(d: AvisRequest): Observable<AvisResponse> { return this.http.post<AvisResponse>(`${this.api}/avis`, d, { headers: this.getHeaders() }); }

  // ── DISPONIBILITES ────────────────────────────────────────
  getDispoByService(serviceId: number): Observable<DisponibiliteResponse[]> { return this.http.get<DisponibiliteResponse[]>(`${this.api}/disponibilites/service/${serviceId}`, { headers: this.getHeaders() }); }
  createDispo(d: DisponibiliteRequest): Observable<DisponibiliteResponse> { return this.http.post<DisponibiliteResponse>(`${this.api}/disponibilites`, d, { headers: this.getHeaders() }); }
  updateDispo(id: number, d: DisponibiliteRequest): Observable<DisponibiliteResponse> { return this.http.put<DisponibiliteResponse>(`${this.api}/disponibilites/${id}`, d, { headers: this.getHeaders() }); }
  deleteDispo(id: number): Observable<any> { return this.http.delete(`${this.api}/disponibilites/${id}`, { headers: this.getHeaders(), responseType: 'text' }); }

  // ── CRENEAUX ──────────────────────────────────────────────
  getCreneaux(serviceId: number, date: string): Observable<CreneauResponse[]> {
    const params = new HttpParams().set('serviceId', serviceId).set('date', date);
    return this.http.get<CreneauResponse[]>(`${this.api}/creneaux`, { headers: this.getHeaders(), params });
  }

  // ── GERANTS ───────────────────────────────────────────────
  getGerants(): Observable<GerantResponse[]> { return this.http.get<GerantResponse[]>(`${this.api}/gerants`, { headers: this.getHeaders() }); }
  getGerantsDisponibles(): Observable<GerantResponse[]> { return this.http.get<GerantResponse[]>(`${this.api}/gerants/disponibles`, { headers: this.getHeaders() }); }
  // Vérifier un email avant création gérant
  checkEmailGerant(email: string): Observable<EmployeCheckResponse> {
    const params = new HttpParams().set('email', email);
    return this.http.get<EmployeCheckResponse>(`${this.api}/gerants/check-email`, { headers: this.getHeaders(), params });
  }
  updateGerant(id: number, d: any): Observable<any> { return this.http.put(`${this.api}/gerants/${id}`, d, { headers: this.getHeaders() }); }
  // Archiver gérant — remplacantId obligatoire si le gérant a une entreprise
  archiverGerant(id: number, remplacantId?: number): Observable<GerantResponse> {
    let params = new HttpParams();
    if (remplacantId) params = params.set('remplacantId', remplacantId);
    return this.http.patch<GerantResponse>(`${this.api}/gerants/${id}/archiver`, {}, { headers: this.getHeaders(), params });
  }
  desarchiverGerant(id: number): Observable<GerantResponse> { return this.http.patch<GerantResponse>(`${this.api}/gerants/${id}/desarchiver`, {}, { headers: this.getHeaders() }); }
}