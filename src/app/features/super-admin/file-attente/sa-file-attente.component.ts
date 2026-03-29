import { Component, OnInit, inject } from '@angular/core';
import { trigger, state, style, animate, transition } from '@angular/animations';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  FileAttenteResponse, EntrepriseResponse,
  ClientResponse, ReservationResponse
} from '../../../core/models/api.models';
import { forkJoin } from 'rxjs';

interface RessourceGroup {
  ressourceNom: string | null;
  entries: FileAttenteResponse[];
  expanded: boolean;
}

interface ServiceGroup {
  serviceId: number;
  serviceNom: string;
  entrepriseNom: string | null;
  ressourceGroups: RessourceGroup[];
  expanded: boolean;
}

@Component({
  selector: 'app-sa-file-attente',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  animations: [
    trigger('collapse', [
      state('open',   style({ height: '*', opacity: 1, overflow: 'hidden' })),
      state('closed', style({ height: '0px', opacity: 0, overflow: 'hidden' })),
      transition('open <=> closed', animate('280ms ease-in-out'))
    ])
  ],
  templateUrl: './sa-file-attente.component.html',
  styleUrls: ['./sa-file-attente.component.css']
})
export class SaFileAttenteComponent implements OnInit {
  private api   = inject(ApiService);
  private toast = inject(ToastService);

  fileAttente:  FileAttenteResponse[] = [];
  entreprises:  EntrepriseResponse[]  = [];
  clients:      ClientResponse[]      = [];
  reservations: ReservationResponse[] = [];

  loading      = false;
  loadingModal = false;

  private _filtreEntrepriseId: number | null = null;
  private _filtreStatut = '';
  private _filtreDate   = '';

  get filtreEntrepriseId(): number | null { return this._filtreEntrepriseId; }
  set filtreEntrepriseId(v: number | null) { this._filtreEntrepriseId = v; this.buildGroups(); }

  get filtreStatut(): string { return this._filtreStatut; }
  set filtreStatut(v: string) { this._filtreStatut = v; this.buildGroups(); }

  get filtreDate(): string { return this._filtreDate; }
  set filtreDate(v: string) { this._filtreDate = v; this.buildGroups(); }

  showModal        = false;
  formEntrepriseId = 0;
  formClientId: number | null = null;
  filteredClients:      ClientResponse[]      = [];
  filteredReservations: ReservationResponse[] = [];
  selectedReservation:  ReservationResponse | null = null;

  selectedDetail: FileAttenteResponse | null = null;

  readonly STATUTS_LABEL: Record<string, string> = {
    EN_ATTENTE: 'En attente', APPELE: 'Appelé', EN_COURS: 'En cours',
    TERMINE: 'Terminé', ANNULE: 'Annulé', EXPIRE: 'Expiré'
  };

  get filteredEntries(): FileAttenteResponse[] {
    return this.fileAttente.filter(fa => {
      const matchEnt    = !this._filtreEntrepriseId || fa.entrepriseId === this._filtreEntrepriseId;
      const matchStatut = !this._filtreStatut || fa.statut === this._filtreStatut;
      let matchDate = true;
      if (this._filtreDate) {
        const arr = fa.heureArrivee ? new Date(fa.heureArrivee).toISOString().slice(0, 10) : '';
        const rdv = fa.dateHeureRdv ? new Date(fa.dateHeureRdv).toISOString().slice(0, 10) : '';
        matchDate = arr === this._filtreDate || rdv === this._filtreDate;
      }
      return matchEnt && matchStatut && matchDate;
    });
  }

  get hasDateFilter(): boolean { return !!this._filtreDate; }

  setAujourdhui(): void {
    this._filtreDate = new Date().toISOString().slice(0, 10);
    this.buildGroups();
  }

  isAujourdhui(): boolean {
    return this._filtreDate === new Date().toISOString().slice(0, 10);
  }

  serviceGroups: ServiceGroup[] = [];

  buildGroups(): void {
    const svcMap = new Map<number, ServiceGroup>();
    // Garder l'état expanded existant
    const oldExpanded = new Map<string, boolean>();
    for (const sg of this.serviceGroups) {
      oldExpanded.set('svc_' + sg.serviceId, sg.expanded);
      for (const rg of sg.ressourceGroups) {
        oldExpanded.set('rg_' + sg.serviceId + '_' + (rg.ressourceNom ?? '__none__'), rg.expanded);
      }
    }

    for (const fa of this.filteredEntries) {
      if (!fa.serviceId) continue;
      if (!svcMap.has(fa.serviceId)) {
        const wasExpanded = oldExpanded.get('svc_' + fa.serviceId);
        svcMap.set(fa.serviceId, {
          serviceId: fa.serviceId,
          serviceNom: fa.serviceNom,
          entrepriseNom: fa.entrepriseNom ?? null,
          ressourceGroups: [],
          expanded: wasExpanded !== undefined ? wasExpanded : false
        });
      }
      const svcGroup = svcMap.get(fa.serviceId)!;
      const rKey = fa.ressourceNom ?? '__none__';
      let rGroup = svcGroup.ressourceGroups.find(r => (r.ressourceNom ?? '__none__') === rKey);
      if (!rGroup) {
        const rgKey = 'rg_' + fa.serviceId + '_' + rKey;
        const wasRgExpanded = oldExpanded.get(rgKey);
        rGroup = { ressourceNom: fa.ressourceNom ?? null, entries: [], expanded: wasRgExpanded !== undefined ? wasRgExpanded : false };
        svcGroup.ressourceGroups.push(rGroup);
      }
      rGroup.entries.push(fa);
    }
    svcMap.forEach(sg => sg.ressourceGroups.sort((a, b) =>
      (a.ressourceNom ?? '').localeCompare(b.ressourceNom ?? '')
    ));
    this.serviceGroups = Array.from(svcMap.values()).sort((a, b) => a.serviceNom.localeCompare(b.serviceNom));
  }

  get entreprisesActives(): EntrepriseResponse[] {
    const ids = new Set(this.fileAttente.map(fa => fa.entrepriseId).filter(Boolean));
    return this.entreprises.filter(e => ids.has(e.id));
  }

  countByStatut(s: string): number { return this.fileAttente.filter(fa => fa.statut === s).length; }
  statutLabel(s: string): string   { return this.STATUTS_LABEL[s] ?? s; }

  countActiveInServiceGroup(sg: ServiceGroup): number {
    return sg.ressourceGroups.flatMap(rg => rg.entries)
      .filter(fa => fa.statut === 'EN_ATTENTE' || fa.statut === 'APPELE' || fa.statut === 'EN_COURS').length;
  }

  totalEntriesInService(sg: ServiceGroup): number {
    return sg.ressourceGroups.reduce((sum, rg) => sum + rg.entries.length, 0);
  }

  countActiveInGroup(entries: FileAttenteResponse[]): number {
    return entries.filter(fa => fa.statut === 'EN_ATTENTE' || fa.statut === 'APPELE' || fa.statut === 'EN_COURS').length;
  }

  toggleService(sg: ServiceGroup): void { sg.expanded = !sg.expanded; }
  toggleRessource(rg: RessourceGroup): void { rg.expanded = !rg.expanded; }

  ngOnInit(): void { this.loadAll(); }

  loadAll(): void {
    this.loading = true;
    forkJoin({
      fa:  this.api.getFileAttente(),
      ent: this.api.getEntreprises(),
      cli: this.api.getClients(),
      res: this.api.getReservations()
    }).subscribe({
      next: d => {
        this.fileAttente  = d.fa;
        this.entreprises  = d.ent;
        this.clients      = d.cli;
        this.reservations = d.res;
        this.loading = false;
        this.buildGroups();
      },
      error: () => { this.toast.error('Erreur chargement'); this.loading = false; }
    });
  }

  reload(): void { this.api.getFileAttente().subscribe(d => { this.fileAttente = d; this.buildGroups(); }); }

  onEntrepriseChange(): void {
    this.filteredClients = this.clients.filter(c =>
      c.entreprises?.some((e: any) => e.id === this.formEntrepriseId)
    );
    this.formClientId = null; this.filteredReservations = []; this.selectedReservation = null;
  }

  onClientChange(): void {
    if (!this.formClientId) { this.filteredReservations = []; this.selectedReservation = null; return; }
    this.filteredReservations = this.reservations.filter(r =>
      r.clientId === this.formClientId && r.statut === 'CONFIRMEE'
    );
    this.selectedReservation = null;
  }

  selectReservation(r: ReservationResponse): void { this.selectedReservation = r; }

  openCreate(): void {
    this.formEntrepriseId = 0; this.formClientId = null;
    this.filteredClients = []; this.filteredReservations = []; this.selectedReservation = null;
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false; this.formEntrepriseId = 0; this.formClientId = null;
    this.filteredClients = []; this.filteredReservations = []; this.selectedReservation = null;
  }

  save(): void {
    if (!this.formClientId || !this.selectedReservation) return;
    this.loadingModal = true;
    const body: any = {
      clientId:      this.formClientId,
      serviceId:     this.selectedReservation.serviceId,
      reservationId: this.selectedReservation.id
    };
    this.api.ajouterFileAttente(body).subscribe({
      next: () => { this.toast.success('Client inscrit en file !'); this.reload(); this.closeModal(); this.loadingModal = false; },
      error: (err: any) => { this.toast.error(err?.error?.message || 'Erreur'); this.loadingModal = false; }
    });
  }

  openDetail(fa: FileAttenteResponse): void { this.selectedDetail = fa; }
  closeDetail(): void { this.selectedDetail = null; }

  appeler(fa: FileAttenteResponse, event?: Event): void {
    event?.stopPropagation();
    this.api.appeler(fa.id).subscribe({
      next: u => { this.updateLocal(u); this.toast.success('Client appelé'); if (this.selectedDetail?.id === fa.id) this.selectedDetail = u; },
      error: () => this.toast.error('Erreur')
    });
  }

  demarrer(fa: FileAttenteResponse, event?: Event): void {
    event?.stopPropagation();
    this.api.demarrer(fa.id).subscribe({
      next: u => { this.updateLocal(u); this.toast.success('Prestation démarrée'); if (this.selectedDetail?.id === fa.id) this.selectedDetail = u; },
      error: () => this.toast.error('Erreur')
    });
  }

  terminer(fa: FileAttenteResponse, event?: Event): void {
    event?.stopPropagation();
    this.api.terminer(fa.id).subscribe({
      next: u => { this.updateLocal(u); this.toast.success('Prestation terminée'); if (this.selectedDetail?.id === fa.id) this.selectedDetail = u; },
      error: () => this.toast.error('Erreur')
    });
  }

  annulerAdmin(fa: FileAttenteResponse, event?: Event): void {
    event?.stopPropagation();
    if (!confirm(`Annuler l'entrée #${fa.id} ?`)) return;
    this.api.annulerAdmin(fa.id).subscribe({
      next: u => { this.updateLocal(u); this.toast.success('Entrée annulée'); if (this.selectedDetail?.id === fa.id) this.selectedDetail = u; },
      error: () => this.toast.error('Erreur')
    });
  }

  private updateLocal(updated: FileAttenteResponse): void {
    const idx = this.fileAttente.findIndex(x => x.id === updated.id);
    if (idx !== -1) this.fileAttente[idx] = updated;
    this.buildGroups();
  }

  resetFiltres(): void { this._filtreEntrepriseId = null; this._filtreStatut = ''; this._filtreDate = ''; this.buildGroups(); }

  getEntNom(id: number | null): string {
  if (!id) return '';
  return this.entreprises.find(e => e.id === id)?.nom ?? '';
}
}