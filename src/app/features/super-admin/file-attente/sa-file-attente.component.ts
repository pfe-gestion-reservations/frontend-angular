import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  FileAttenteResponse, EntrepriseResponse,
  ClientResponse, ReservationResponse, StatutFileAttente
} from '../../../core/models/api.models';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-sa-file-attente',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './sa-file-attente.component.html',
  styleUrls: ['./sa-file-attente.component.css']
})
export class SaFileAttenteComponent implements OnInit {
  private api   = inject(ApiService);
  private toast = inject(ToastService);
  private fb    = inject(FormBuilder);

  fileAttente:  FileAttenteResponse[] = [];
  entreprises:  EntrepriseResponse[]  = [];
  clients:      ClientResponse[]      = [];
  reservations: ReservationResponse[] = [];

  loading      = false;
  loadingModal = false;

  // Filtres
  filtreEntrepriseId: number | null = null;
  filtreStatut = '';

  // Modal
  showModal            = false;
  formEntrepriseId     = 0;
  formClientId: number | null = null;
  filteredClients:      ClientResponse[]      = [];
  filteredReservations: ReservationResponse[] = [];
  selectedReservation:  ReservationResponse | null = null;

  // Détail
  selectedDetail: FileAttenteResponse | null = null;

  readonly STATUTS_LABEL: Record<string, string> = {
    EN_ATTENTE: 'En attente', APPELE: 'Appelé', EN_COURS: 'En cours',
    TERMINE: 'Terminé', ANNULE: 'Annulé', EXPIRE: 'Expiré'
  };

  get filtered(): FileAttenteResponse[] {
    return this.fileAttente.filter(fa => {
      const matchEnt    = !this.filtreEntrepriseId || fa.entrepriseId === this.filtreEntrepriseId;
      const matchStatut = !this.filtreStatut       || fa.statut === this.filtreStatut;
      return matchEnt && matchStatut;
    });
  }

  countByStatut(s: string): number { return this.fileAttente.filter(fa => fa.statut === s).length; }
  statutLabel(s: string): string   { return this.STATUTS_LABEL[s] ?? s; }

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
      },
      error: () => { this.toast.error('Erreur chargement'); this.loading = false; }
    });
  }

  reload(): void { this.api.getFileAttente().subscribe(d => this.fileAttente = d); }

  // ── Cascades formulaire ───────────────────────────────────
  onEntrepriseChange(): void {
    this.filteredClients      = this.clients.filter(c =>
      c.entreprises?.some((e: any) => e.id === this.formEntrepriseId)
    );
    this.formClientId         = null;
    this.filteredReservations = [];
    this.selectedReservation  = null;
  }

  onClientChange(): void {
    if (!this.formClientId) { this.filteredReservations = []; this.selectedReservation = null; return; }
    // Réservations CONFIRMEE du client sélectionné
    this.filteredReservations = this.reservations.filter(r =>
      r.clientId === this.formClientId && r.statut === 'CONFIRMEE'
    );
    this.selectedReservation = null;
  }

  selectReservation(r: ReservationResponse): void {
    this.selectedReservation = r;
  }

  // ── Modal ─────────────────────────────────────────────────
  openCreate(): void {
    this.formEntrepriseId     = 0;
    this.formClientId         = null;
    this.filteredClients      = [];
    this.filteredReservations = [];
    this.selectedReservation  = null;
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal            = false;
    this.formEntrepriseId     = 0;
    this.formClientId         = null;
    this.filteredClients      = [];
    this.filteredReservations = [];
    this.selectedReservation  = null;
  }

  save(): void {
    if (!this.formClientId || !this.selectedReservation) return;
    this.loadingModal = true;
    const body: any = {
      clientId:      this.formClientId,
      serviceId:     this.selectedReservation.serviceId,
      reservationId: this.selectedReservation.id,
      employeId:     this.selectedReservation.employeId ?? null
    };
    this.api.ajouterFileAttente(body).subscribe({
      next: () => {
        this.toast.success('Client inscrit en file !');
        this.reload(); this.closeModal(); this.loadingModal = false;
      },
      error: (err: any) => {
        this.toast.error(err?.error?.message || err?.error || 'Erreur');
        this.loadingModal = false;
      }
    });
  }

  // ── Détail ────────────────────────────────────────────────
  openDetail(fa: FileAttenteResponse): void { this.selectedDetail = fa; }
  closeDetail(): void { this.selectedDetail = null; }

  // ── Actions ──────────────────────────────────────────────
  appeler(fa: FileAttenteResponse): void {
    this.api.appeler(fa.id).subscribe({
      next: u => { this.updateLocal(u); this.toast.success('Client appelé'); if (this.selectedDetail?.id === fa.id) this.selectedDetail = u; },
      error: () => this.toast.error('Erreur')
    });
  }

  demarrer(fa: FileAttenteResponse): void {
    this.api.demarrer(fa.id).subscribe({
      next: u => { this.updateLocal(u); this.toast.success('Prestation démarrée'); if (this.selectedDetail?.id === fa.id) this.selectedDetail = u; },
      error: () => this.toast.error('Erreur')
    });
  }

  terminer(fa: FileAttenteResponse): void {
    this.api.terminer(fa.id).subscribe({
      next: u => { this.updateLocal(u); this.toast.success('Prestation terminée'); if (this.selectedDetail?.id === fa.id) this.selectedDetail = u; },
      error: () => this.toast.error('Erreur')
    });
  }

  annulerAdmin(fa: FileAttenteResponse): void {
    if (!confirm(`Annuler l'entrée #${fa.id} ?`)) return;
    this.api.annulerAdmin(fa.id).subscribe({
      next: u => { this.updateLocal(u); this.toast.success('Entrée annulée'); if (this.selectedDetail?.id === fa.id) this.selectedDetail = u; },
      error: () => this.toast.error('Erreur')
    });
  }

  private updateLocal(updated: FileAttenteResponse): void {
    const idx = this.fileAttente.findIndex(x => x.id === updated.id);
    if (idx !== -1) this.fileAttente[idx] = updated;
  }

  resetFiltres(): void { this.filtreEntrepriseId = null; this.filtreStatut = ''; }
}