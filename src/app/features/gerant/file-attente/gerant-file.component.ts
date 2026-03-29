import { Component, OnInit, inject } from '@angular/core';
import { trigger, state, style, animate, transition } from '@angular/animations';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  FileAttenteResponse, ClientResponse, ReservationResponse
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
  ressourceGroups: RessourceGroup[];
  expanded: boolean;
}

@Component({
  selector: 'app-gerant-file',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  animations: [
    trigger('collapse', [
      state('open',   style({ height: '*', opacity: 1, overflow: 'hidden' })),
      state('closed', style({ height: '0px', opacity: 0, overflow: 'hidden' })),
      transition('open <=> closed', animate('280ms ease-in-out'))
    ])
  ],
  templateUrl: './gerant-file.component.html',
  styleUrls: ['./gerant-file.component.css']
})
export class GerantFileComponent implements OnInit {
  private api   = inject(ApiService);
  private toast = inject(ToastService);

  fileAttente:  FileAttenteResponse[] = [];
  clients:      ClientResponse[]      = [];
  reservations: ReservationResponse[] = [];

  loading      = false;
  loadingModal = false;

  private _filtreStatut = '';
  private _filtreDate   = '';

  get filtreStatut(): string { return this._filtreStatut; }
  set filtreStatut(v: string) { this._filtreStatut = v; this.buildGroups(); }

  get filtreDate(): string { return this._filtreDate; }
  set filtreDate(v: string) { this._filtreDate = v; this.buildGroups(); }

  get hasDateFilter(): boolean { return !!this._filtreDate; }

  get isAujourdhui(): boolean {
    return this._filtreDate === new Date().toISOString().slice(0, 10);
  }

  setAujourdhui(): void {
    this._filtreDate = new Date().toISOString().slice(0, 10);
    this.buildGroups();
  }

  clearDate(): void {
    this._filtreDate = '';
    this.buildGroups();
  }

  get formattedFilterDate(): string {
    if (!this._filtreDate) return '';
    const [y, m, d] = this._filtreDate.split('-');
    return `${d}/${m}/${y}`;
  }

  showModal    = false;
  formClientId: number | null = null;
  filteredReservations: ReservationResponse[] = [];
  selectedReservation:  ReservationResponse | null = null;

  selectedDetail: FileAttenteResponse | null = null;

  readonly STATUTS_LABEL: Record<string, string> = {
    EN_ATTENTE: 'En attente', APPELE: 'Appelé', EN_COURS: 'En cours',
    TERMINE: 'Terminé', ANNULE: 'Annulé', EXPIRE: 'Expiré'
  };

  serviceGroups: ServiceGroup[] = [];

  buildGroups(): void {
    const svcMap = new Map<number, ServiceGroup>();
    const oldExpanded = new Map<string, boolean>();
    for (const sg of this.serviceGroups) {
      oldExpanded.set('svc_' + sg.serviceId, sg.expanded);
      for (const rg of sg.ressourceGroups)
        oldExpanded.set('rg_' + sg.serviceId + '_' + (rg.ressourceNom ?? '__none__'), rg.expanded);
    }
    for (const fa of this.filteredEntries) {
      if (!fa.serviceId) continue;
      if (!svcMap.has(fa.serviceId)) {
        svcMap.set(fa.serviceId, {
          serviceId: fa.serviceId, serviceNom: fa.serviceNom,
          ressourceGroups: [],
          expanded: oldExpanded.get('svc_' + fa.serviceId) ?? true
        });
      }
      const svcGroup = svcMap.get(fa.serviceId)!;
      const rKey = fa.ressourceNom ?? '__none__';
      let rGroup = svcGroup.ressourceGroups.find(r => (r.ressourceNom ?? '__none__') === rKey);
      if (!rGroup) {
        rGroup = { ressourceNom: fa.ressourceNom ?? null, entries: [],
          expanded: oldExpanded.get('rg_' + fa.serviceId + '_' + rKey) ?? true };
        svcGroup.ressourceGroups.push(rGroup);
      }
      rGroup.entries.push(fa); // sorted after
    }
    svcMap.forEach(sg => sg.ressourceGroups.sort((a, b) =>
      (a.ressourceNom ?? '').localeCompare(b.ressourceNom ?? '')));
    // Trier les entrées dans chaque groupe par priorité puis heure
    svcMap.forEach(sg => sg.ressourceGroups.forEach(rg => {
      rg.entries = this.sortEntries(rg.entries);
    }));
    this.serviceGroups = Array.from(svcMap.values()).sort((a, b) => a.serviceNom.localeCompare(b.serviceNom));
  }

  countByStatut(s: string): number { return this.fileAttente.filter(fa => fa.statut === s).length; }
  statutLabel(s: string): string   { return this.STATUTS_LABEL[s] ?? s; }

  countActiveInServiceGroup(sg: ServiceGroup): number {
    return sg.ressourceGroups.flatMap(rg => rg.entries)
      .filter(fa => ['EN_ATTENTE','APPELE','EN_COURS'].includes(fa.statut)).length;
  }
  totalEntriesInService(sg: ServiceGroup): number {
    return sg.ressourceGroups.reduce((sum, rg) => sum + rg.entries.length, 0);
  }
  countActiveInGroup(entries: FileAttenteResponse[]): number {
    return entries.filter(fa => ['EN_ATTENTE','APPELE','EN_COURS'].includes(fa.statut)).length;
  }

  // Ordre priorité : actifs d'abord, terminés/annulés en bas
  readonly PRIORITE: Record<string, number> = {
    EN_ATTENTE: 1, APPELE: 2, EN_COURS: 3, EXPIRE: 4, TERMINE: 5, ANNULE: 6
  };

  // Par défaut : masquer les terminés
  showTermine = false;

  get filteredEntries(): FileAttenteResponse[] {
    return this.fileAttente.filter(fa => {
      const matchStatut  = !this._filtreStatut || fa.statut === this._filtreStatut;
      const matchTermine = this.showTermine ? true : fa.statut !== 'TERMINE' && fa.statut !== 'ANNULE';
      let matchDate = true;
      if (this._filtreDate) {
        const arr = fa.heureArrivee ? new Date(fa.heureArrivee).toISOString().slice(0, 10) : '';
        const rdv = fa.dateHeureRdv ? new Date(fa.dateHeureRdv).toISOString().slice(0, 10) : '';
        matchDate = arr === this._filtreDate || rdv === this._filtreDate;
      }
      return matchStatut && matchTermine && matchDate;
    });
  }

  sortEntries(entries: FileAttenteResponse[]): FileAttenteResponse[] {
    return [...entries].sort((a, b) => {
      const pa = this.PRIORITE[a.statut] ?? 99;
      const pb = this.PRIORITE[b.statut] ?? 99;
      if (pa !== pb) return pa - pb;
      // Même priorité → trier par heure d'arrivée
      return new Date(a.heureArrivee).getTime() - new Date(b.heureArrivee).getTime();
    });
  }

  toggleService(sg: ServiceGroup): void { sg.expanded = !sg.expanded; }
  toggleRessource(rg: RessourceGroup): void { rg.expanded = !rg.expanded; }

  ngOnInit(): void { this.loadAll(); }

  loadAll(): void {
    this.loading = true;
    forkJoin({
      fa:  this.api.getFileAttente(),
      cli: this.api.getClients(),
      res: this.api.getReservations()
    }).subscribe({
      next: d => {
        this.fileAttente  = d.fa;
        this.clients      = d.cli;
        this.reservations = d.res;
        this.loading = false;
        this.buildGroups();
      },
      error: () => { this.toast.error('Erreur chargement'); this.loading = false; }
    });
  }

  reload(): void { this.api.getFileAttente().subscribe(d => { this.fileAttente = d; this.buildGroups(); }); }

  onClientChange(): void {
    if (!this.formClientId) { this.filteredReservations = []; this.selectedReservation = null; return; }
    // Réservations confirmées ET pas déjà inscrites en file active
    const inscritIds = new Set(
      this.fileAttente
        .filter(fa => fa.statut !== 'ANNULE' && fa.reservationId != null)
        .map(fa => fa.reservationId!)
    );
    this.filteredReservations = this.reservations.filter(r =>
      r.clientId === this.formClientId &&
      r.statut === 'CONFIRMEE' &&
      !inscritIds.has(r.id)
    );
    this.selectedReservation = null;
  }

  selectReservation(r: ReservationResponse): void { this.selectedReservation = r; }

  openCreate(): void {
    this.formClientId = null;
    this.filteredReservations = []; this.selectedReservation = null;
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false; this.formClientId = null;
    this.filteredReservations = []; this.selectedReservation = null;
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
      next: () => {
        this.toast.success('Client inscrit en file !');
        this.reload();
        this.closeModal();
        this.loadingModal = false;
        // Recharger les réservations pour mettre à jour le formulaire
        this.api.getReservations().subscribe(r => { this.reservations = r; });
      },
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

  resetFiltres(): void { this._filtreStatut = ''; this._filtreDate = ''; this.buildGroups(); }
}