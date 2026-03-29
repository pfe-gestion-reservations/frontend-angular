import { Component, OnInit, inject, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  ReservationResponse, ServiceResponse,
  ClientResponse, ConfigServiceResponse
} from '../../../core/models/api.models';
import { forkJoin } from 'rxjs';

type ModalMode = 'create' | 'edit';

@Component({
  selector: 'app-gerant-reservations',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './gerant-reservations.component.html',
  styleUrls: ['./gerant-reservations.component.css']
})
export class GerantReservationsComponent implements OnInit {
  private api   = inject(ApiService);
  private toast = inject(ToastService);
  private fb       = inject(FormBuilder);
  private renderer = inject(Renderer2);

  reservations: ReservationResponse[]              = [];
  services:     ServiceResponse[]                  = [];
  clients:      ClientResponse[]                   = [];
  configs:      Map<number, ConfigServiceResponse> = new Map();

  loading      = false;
  loadingModal = false;

  searchQuery  = '';
  filtreStatut = '';
  filtreDate   = '';
  sortAsc      = false;

  get hasActiveFilters(): boolean { return !!(this.filtreStatut || this.filtreDate || this.searchQuery); }

  get isToday(): boolean {
    return this.filtreDate === new Date().toISOString().slice(0, 10);
  }

  setToday(): void {
    this.filtreDate = new Date().toISOString().slice(0, 10);
  }


  showModal  = false;
  modalMode: ModalMode = 'create';
  editing: ReservationResponse | null     = null;
  selectedDetail: ReservationResponse | null = null;

  selectedConfig: ConfigServiceResponse | null = null;

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

  getConfig(id: number): ConfigServiceResponse | undefined { return this.configs.get(id); }

  ngOnInit(): void { this.loadAll(); }

  loadAll(): void {
    this.loading = true;
    forkJoin({
      reservations: this.api.getReservations(),
      services:     this.api.getServices(),
      clients:      this.api.getClients()
    }).subscribe({
      next: d => {
        this.reservations = d.reservations;
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

  onServiceChange(): void {
    const sid = this.form.get('serviceId')?.value;
    this.selectedConfig = sid ? (this.configs.get(sid) ?? null) : null;
  }

  openCreate(): void {
    this.modalMode     = 'create';
    this.editing       = null;
    this.selectedConfig = null;
    this.form.reset({ nombrePersonnes: 1 });
    this.showModal = true;
  }

  openEdit(r: ReservationResponse): void {
    this.modalMode      = 'edit';
    this.editing        = r;
    this.selectedConfig = r.serviceId ? (this.configs.get(r.serviceId) ?? null) : null;
    const hd = r.heureDebut ? new Date(r.heureDebut).toISOString().slice(0, 16) : '';
    this.form.patchValue({
      clientId: r.clientId, serviceId: r.serviceId,
      heureDebut: hd, nombrePersonnes: r.nombrePersonnes ?? 1, notes: r.notes ?? ''
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
        this.loadingModal = false;
        const msg = err?.error?.message || err?.error || 'Erreur lors de la réservation';
        this._showErrorDialog(msg);
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
      error: (err: any) => this.toast.error(err?.error?.message || err?.error || 'Erreur')
    });
  }

  annuler(r: ReservationResponse): void {
    const overlay = this.renderer.createElement('div');
    this.renderer.setStyle(overlay, 'position', 'fixed'); this.renderer.setStyle(overlay, 'inset', '0');
    this.renderer.setStyle(overlay, 'background', 'rgba(0,0,0,0.65)'); this.renderer.setStyle(overlay, 'z-index', '99999');
    this.renderer.setStyle(overlay, 'display', 'flex'); this.renderer.setStyle(overlay, 'align-items', 'center'); this.renderer.setStyle(overlay, 'justify-content', 'center');
    const box = this.renderer.createElement('div');
    this.renderer.setStyle(box, 'background', '#1e1e2e'); this.renderer.setStyle(box, 'border', '1px solid rgba(245,158,11,.3)');
    this.renderer.setStyle(box, 'border-radius', '16px'); this.renderer.setStyle(box, 'padding', '32px 28px');
    this.renderer.setStyle(box, 'text-align', 'center'); this.renderer.setStyle(box, 'max-width', '360px'); this.renderer.setStyle(box, 'width', '90%');
    this.renderer.setStyle(box, 'box-shadow', '0 24px 64px rgba(0,0,0,0.6)'); this.renderer.setStyle(box, 'font-family', 'inherit');
    const close = () => this.renderer.removeChild(document.body, overlay);
    box.innerHTML = `
      <div style="font-size:2rem;margin-bottom:12px">🚫</div>
      <div style="font-size:1.05rem;font-weight:700;color:#fff;margin-bottom:8px">Annuler la réservation ?</div>
      <div style="font-size:.85rem;color:#aaa;margin-bottom:22px">Réservation <strong style="color:#fbbf24">#${r.id}</strong> — ${r.clientNom} ${r.clientPrenom}</div>
      <div style="display:flex;gap:10px;justify-content:center">
        <button id="ann-cancel" style="background:transparent;color:#aaa;border:1px solid rgba(255,255,255,0.15);padding:9px 20px;border-radius:8px;font-size:.875rem;cursor:pointer">Retour</button>
        <button id="ann-ok" style="background:#f59e0b;color:#fff;border:none;padding:9px 22px;border-radius:8px;font-size:.875rem;font-weight:700;cursor:pointer">Annuler la réservation</button>
      </div>`;
    this.renderer.appendChild(overlay, box); this.renderer.appendChild(document.body, overlay);
    box.querySelector('#ann-cancel')!.addEventListener('click', close);
    box.querySelector('#ann-ok')!.addEventListener('click', () => { close(); this.changerStatut(r, 'ANNULEE'); });
    overlay.addEventListener('click', (e: Event) => { if (e.target === overlay) close(); });
  }

  supprimer(r: ReservationResponse): void {
    const overlay = this.renderer.createElement('div');
    this.renderer.setStyle(overlay, 'position', 'fixed'); this.renderer.setStyle(overlay, 'inset', '0');
    this.renderer.setStyle(overlay, 'background', 'rgba(0,0,0,0.65)'); this.renderer.setStyle(overlay, 'z-index', '99999');
    this.renderer.setStyle(overlay, 'display', 'flex'); this.renderer.setStyle(overlay, 'align-items', 'center'); this.renderer.setStyle(overlay, 'justify-content', 'center');
    const box = this.renderer.createElement('div');
    this.renderer.setStyle(box, 'background', '#1e1e2e'); this.renderer.setStyle(box, 'border', '1px solid rgba(239,68,68,.3)');
    this.renderer.setStyle(box, 'border-radius', '16px'); this.renderer.setStyle(box, 'padding', '32px 28px');
    this.renderer.setStyle(box, 'text-align', 'center'); this.renderer.setStyle(box, 'max-width', '360px'); this.renderer.setStyle(box, 'width', '90%');
    this.renderer.setStyle(box, 'box-shadow', '0 24px 64px rgba(0,0,0,0.6)'); this.renderer.setStyle(box, 'font-family', 'inherit');
    const close = () => this.renderer.removeChild(document.body, overlay);
    box.innerHTML = `
      <div style="font-size:2rem;margin-bottom:12px">🗑️</div>
      <div style="font-size:1.05rem;font-weight:700;color:#fff;margin-bottom:8px">Supprimer cette réservation ?</div>
      <div style="font-size:.85rem;color:#aaa;margin-bottom:6px">Réservation <strong style="color:#f1f5f9">#${r.id}</strong></div>
      <div style="font-size:.82rem;color:#aaa;margin-bottom:22px">${r.clientNom} ${r.clientPrenom} — ${r.serviceNom}</div>
      <div style="font-size:.78rem;color:#f87171;margin-bottom:22px">Cette action est irréversible.</div>
      <div style="display:flex;gap:10px;justify-content:center">
        <button id="sup-cancel" style="background:transparent;color:#aaa;border:1px solid rgba(255,255,255,0.15);padding:9px 20px;border-radius:8px;font-size:.875rem;cursor:pointer">Annuler</button>
        <button id="sup-ok" style="background:#ef4444;color:#fff;border:none;padding:9px 22px;border-radius:8px;font-size:.875rem;font-weight:700;cursor:pointer">Supprimer</button>
      </div>`;
    this.renderer.appendChild(overlay, box); this.renderer.appendChild(document.body, overlay);
    box.querySelector('#sup-cancel')!.addEventListener('click', close);
    box.querySelector('#sup-ok')!.addEventListener('click', () => {
      close();
      this.api.deleteReservation(r.id).subscribe({
        next: () => {
          this.reservations = this.reservations.filter(x => x.id !== r.id);
          if (this.selectedDetail?.id === r.id) this.closeDetail();
          this.toast.success('Réservation supprimée');
        },
        error: (err: any) => this.toast.error(err?.error?.message || 'Erreur lors de la suppression')
      });
    });
    overlay.addEventListener('click', (e: Event) => { if (e.target === overlay) close(); });
  }

  private _showErrorDialog(msg: string): void {
    const overlay = this.renderer.createElement('div');
    this.renderer.setStyle(overlay, 'position', 'fixed'); this.renderer.setStyle(overlay, 'inset', '0');
    this.renderer.setStyle(overlay, 'background', 'rgba(0,0,0,0.65)'); this.renderer.setStyle(overlay, 'z-index', '99999');
    this.renderer.setStyle(overlay, 'display', 'flex'); this.renderer.setStyle(overlay, 'align-items', 'center'); this.renderer.setStyle(overlay, 'justify-content', 'center');
    const box = this.renderer.createElement('div');
    this.renderer.setStyle(box, 'background', '#1e1e2e'); this.renderer.setStyle(box, 'border', '1px solid rgba(239,68,68,.35)');
    this.renderer.setStyle(box, 'border-radius', '18px'); this.renderer.setStyle(box, 'padding', '32px 28px');
    this.renderer.setStyle(box, 'text-align', 'center'); this.renderer.setStyle(box, 'max-width', '420px'); this.renderer.setStyle(box, 'width', '92%');
    this.renderer.setStyle(box, 'box-shadow', '0 24px 64px rgba(0,0,0,0.6)'); this.renderer.setStyle(box, 'font-family', 'inherit');
    const close = () => this.renderer.removeChild(document.body, overlay);
    box.innerHTML = `
      <div style="width:52px;height:52px;background:rgba(239,68,68,.12);border:2px solid rgba(239,68,68,.35);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.4rem;margin:0 auto 16px">⚠️</div>
      <div style="font-size:1rem;font-weight:700;color:#fff;margin-bottom:12px">Réservation impossible</div>
      <div style="font-size:.875rem;color:#94a3b8;margin-bottom:24px;line-height:1.6;background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.15);border-radius:10px;padding:12px 16px">
        Service Non Disponible Pour Ce Créneau
      </div>
      <button id="err-ok" style="background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;border:none;padding:10px 36px;border-radius:10px;font-size:.9rem;font-weight:600;cursor:pointer;width:100%">Compris</button>`;
    this.renderer.appendChild(overlay, box); this.renderer.appendChild(document.body, overlay);
    box.querySelector('#err-ok')!.addEventListener('click', close);
    overlay.addEventListener('click', (e: Event) => { if (e.target === overlay) close(); });
  }

  closeModal(): void { this.showModal = false; this.editing = null; this.form.reset(); this.selectedConfig = null; }
  resetFiltres(): void { this.searchQuery = ''; this.filtreStatut = ''; this.filtreDate = ''; this.sortAsc = false; }
}