import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  ReservationResponse, EntrepriseResponse, ServiceResponse,
  ClientResponse, ConfigServiceResponse
} from '../../../core/models/api.models';
import { forkJoin } from 'rxjs';

type ModalMode = 'create' | 'edit';

@Component({
  selector: 'app-sa-reservations',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './sa-reservations.component.html',
  styleUrls: ['./sa-reservations.component.css']
})
export class SaReservationsComponent implements OnInit {
  private api   = inject(ApiService);
  private toast = inject(ToastService);
  private fb    = inject(FormBuilder);

  reservations: ReservationResponse[] = [];
  entreprises:  EntrepriseResponse[]  = [];
  services:     ServiceResponse[]     = [];
  clients:      ClientResponse[]      = [];
  configs:      Map<number, ConfigServiceResponse> = new Map();

  loading      = false;
  loadingModal = false;

  searchQuery  = '';
  filtreStatut = '';
  filtreDate   = '';

  showModal  = false;
  modalMode: ModalMode = 'create';
  editing: ReservationResponse | null = null;
  selectedDetail: ReservationResponse | null = null;

  formEntrepriseId  = 0;
  filteredServices: ServiceResponse[] = [];
  filteredClients:  ClientResponse[]  = [];
  selectedConfig:   ConfigServiceResponse | null = null;

  readonly STATUTS = ['EN_ATTENTE', 'CONFIRMEE', 'EN_COURS', 'ANNULEE', 'TERMINEE'];

  form = this.fb.group({
    clientId:        [null as number | null, Validators.required],
    serviceId:       [null as number | null, Validators.required],
    heureDebut:      ['', Validators.required],
    nombrePersonnes: [1],
    notes:           ['']
  });

  get filtered(): ReservationResponse[] {
    const q = this.searchQuery.toLowerCase();
    return this.reservations.filter(r => {
      const matchSearch = !q || [r.clientNom, r.clientPrenom, r.serviceNom, r.employeNom, r.ressourceNom]
        .some(v => v?.toLowerCase().includes(q));
      const matchStatut = !this.filtreStatut || r.statut === this.filtreStatut;
      const matchDate   = !this.filtreDate   || r.heureDebut?.toString().startsWith(this.filtreDate);
      return matchSearch && matchStatut && matchDate;
    });
  }

  countByStatut(s: string): number { return this.reservations.filter(r => r.statut === s).length; }

  statutLabel(s: string): string {
    const l: Record<string, string> = {
      EN_ATTENTE: 'En attente', CONFIRMEE: 'Confirmée',
      EN_COURS: 'En cours', ANNULEE: 'Annulée', TERMINEE: 'Terminée'
    };
    return l[s] ?? s;
  }

  typeLabel(t?: string | null): string {
    const l: Record<string, string> = {
      EMPLOYE_DEDIE: 'Employé dédié', RESSOURCE_PARTAGEE: 'Ressource partagée',
      FILE_ATTENTE_PURE: "File d'attente", HYBRIDE: 'Hybride'
    };
    return t ? (l[t] ?? t) : '';
  }

  typeColor(t?: string | null): string {
    const c: Record<string, string> = {
      EMPLOYE_DEDIE: '#6366f1', RESSOURCE_PARTAGEE: '#10b981',
      FILE_ATTENTE_PURE: '#f59e0b', HYBRIDE: '#ec4899'
    };
    return t ? (c[t] ?? 'var(--accent)') : 'var(--accent)';
  }

  typeIcon(t?: string | null): string {
    const i: Record<string, string> = {
      EMPLOYE_DEDIE: 'fas fa-user-tie', RESSOURCE_PARTAGEE: 'fas fa-layer-group',
      FILE_ATTENTE_PURE: 'fas fa-list-ol', HYBRIDE: 'fas fa-random'
    };
    return t ? (i[t] ?? 'fas fa-concierge-bell') : 'fas fa-concierge-bell';
  }

  getEntNom(id: number): string { return this.entreprises.find(e => e.id === id)?.nom ?? '—'; }
  getConfig(id: number): ConfigServiceResponse | undefined { return this.configs.get(id); }

  ngOnInit(): void { this.loadAll(); }

  loadAll(): void {
    this.loading = true;
    forkJoin({
      reservations: this.api.getReservations(),
      entreprises:  this.api.getEntreprises(),
      services:     this.api.getServices(),
      clients:      this.api.getClients()
    }).subscribe({
      next: d => {
        this.reservations = d.reservations;
        this.entreprises  = d.entreprises;
        this.services     = d.services;
        this.clients      = d.clients;
        d.services.forEach(s =>
          this.api.getConfigService(s.id).subscribe({ next: c => this.configs.set(s.id, c), error: () => {} })
        );
        this.loading = false;
      },
      error: () => { this.toast.error('Erreur chargement'); this.loading = false; }
    });
  }

  reload(): void { this.api.getReservations().subscribe(d => this.reservations = d); }

  onEntrepriseChange(): void {
    this.filteredServices = this.services.filter(s => s.entrepriseId === this.formEntrepriseId);
    this.filteredClients  = this.clients.filter(c =>
      c.entreprises?.some((e: any) => e.id === this.formEntrepriseId)
    );
    this.selectedConfig = null;
    this.form.patchValue({ serviceId: null, clientId: null });
  }

  onServiceChange(): void {
    const sid = this.form.get('serviceId')?.value;
    this.selectedConfig = sid ? (this.configs.get(sid) ?? null) : null;
  }

  openCreate(): void {
    this.modalMode = 'create';
    this.editing   = null;
    this.formEntrepriseId = 0;
    this.filteredServices = [];
    this.filteredClients  = [];
    this.selectedConfig   = null;
    this.showModal = true;
  }

  openEdit(r: ReservationResponse): void {
    this.modalMode = 'edit';
    this.editing   = r;
    const svc = this.services.find(s => s.id === r.serviceId);
    this.formEntrepriseId = svc?.entrepriseId ?? 0;
    this.onEntrepriseChange();
    this.selectedConfig = r.serviceId ? (this.configs.get(r.serviceId) ?? null) : null;
    const hd = r.heureDebut ? new Date(r.heureDebut).toISOString().slice(0, 16) : '';
    this.form.patchValue({
      clientId: r.clientId, serviceId: r.serviceId,
    });
    this.selectedDetail = null;
    this.showModal = true;
  }


  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loadingModal = true;
    const v = this.form.getRawValue();
    const body = {
      clientId: v.clientId, serviceId: v.serviceId,
      employeId: null, ressourceId: null,
      heureDebut: v.heureDebut,
      nombrePersonnes: v.nombrePersonnes ?? 1,
      notes: v.notes || null
    };
    const req$ = this.editing
      ? this.api.updateReservation(this.editing.id, body as any)
      : this.api.createReservation(body as any);
    req$.subscribe({
      next: () => {
        this.toast.success(this.editing ? 'Réservation modifiée !' : 'Réservation créée !');
        this.reload(); this.closeModal(); this.loadingModal = false;
      },
      error: (err: any) => {
        this.toast.error(err?.error?.message || err?.error || 'Erreur');
        this.loadingModal = false;
      }
    });
  }

  openDetail(r: ReservationResponse): void { this.selectedDetail = r; }
  closeDetail(): void { this.selectedDetail = null; }

  changerStatut(r: ReservationResponse, statut: string): void {
    this.api.changerStatutReservation(r.id, statut as any).subscribe({
      next: updated => {
        const idx = this.reservations.findIndex(x => x.id === r.id);
        if (idx !== -1) this.reservations[idx] = updated;
        if (this.selectedDetail?.id === r.id) this.selectedDetail = updated;
        this.toast.success('Statut mis à jour');
      },
      error: () => this.toast.error('Erreur')
    });
  }

  annuler(r: ReservationResponse): void {
    if (!confirm(`Annuler la réservation #${r.id} ?`)) return;
    this.changerStatut(r, 'ANNULEE');
  }

  supprimer(r: ReservationResponse): void {
    if (!confirm(`Supprimer définitivement la réservation #${r.id} ?`)) return;
    this.api.deleteReservation(r.id).subscribe({
      next: () => {
        this.reservations = this.reservations.filter(x => x.id !== r.id);
        if (this.selectedDetail?.id === r.id) this.closeDetail();
        this.toast.success('Réservation supprimée');
      },
      error: () => this.toast.error('Erreur')
    });
  }

  closeModal(): void { this.showModal = false; this.editing = null; this.form.reset(); }

  resetFiltres(): void { this.searchQuery = ''; this.filtreStatut = ''; this.filtreDate = ''; }
}