import { Component, OnInit, inject, Renderer2 } from '@angular/core';
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
  private api      = inject(ApiService);
  private toast    = inject(ToastService);
  private fb       = inject(FormBuilder);
  private renderer = inject(Renderer2);

  reservations: ReservationResponse[] = [];
  entreprises:  EntrepriseResponse[]  = [];
  services:     ServiceResponse[]     = [];
  clients:      ClientResponse[]      = [];
  configs:      Map<number, ConfigServiceResponse> = new Map();

  loading      = false;
  loadingModal = false;

  searchQuery        = '';
  filtreStatut       = '';
  filtreDate         = '';
  filtreEntrepriseId = 0;
  sortAsc            = false;

  showModal     = false;
  modalMode: ModalMode = 'create';
  editing:      ReservationResponse | null = null;
  selectedDetail: ReservationResponse | null = null;
  formStep      = 1;

  formEntrepriseId  = 0;
  filteredServices: ServiceResponse[] = [];
  filteredClients:  ClientResponse[]  = [];
  selectedConfig:   ConfigServiceResponse | null = null;

  readonly STATUTS = ['EN_ATTENTE', 'CONFIRMEE', 'EN_COURS', 'ANNULEE', 'TERMINEE'];

  private readonly AVATAR_COLORS = [
    '#4f46e5','#7c3aed','#db2777','#059669','#d97706',
    '#2563eb','#9333ea','#16a34a','#dc2626','#0891b2'
  ];

  form = this.fb.group({
    clientId:        [null as number | null, Validators.required],
    serviceId:       [null as number | null, Validators.required],
    heureDebut:      ['', Validators.required],
    nombrePersonnes: [1],
    notes:           ['']
  });

  /* ── COMPUTED ── */

  get filteredBase(): ReservationResponse[] {
    const q = this.searchQuery.toLowerCase();
    return this.reservations.filter(r => {
      const matchSearch     = !q || [r.clientNom, r.clientPrenom, r.serviceNom, r.employeNom, r.ressourceNom]
        .some(v => v?.toLowerCase().includes(q));
      const matchDate       = !this.filtreDate || r.heureDebut?.toString().startsWith(this.filtreDate);
      const matchEntreprise = !this.filtreEntrepriseId || this.getServiceEntrepriseId(r.serviceId) === this.filtreEntrepriseId;
      return matchSearch && matchDate && matchEntreprise;
    });
  }

  get filtered(): ReservationResponse[] {
    const result = this.filteredBase.filter(r =>
      !this.filtreStatut || r.statut === this.filtreStatut
    );
    return [...result].sort((a, b) => {
      const diff = new Date(a.heureDebut).getTime() - new Date(b.heureDebut).getTime();
      return this.sortAsc ? diff : -diff;
    });
  }

  get nombrePersonnes(): number { return this.form.get('nombrePersonnes')?.value ?? 0; }
  get clientIdValue(): number | null { return this.form.get('clientId')?.value ?? null; }
  get hasActiveFilters(): boolean {
    return !!(this.filtreStatut || this.filtreDate || this.searchQuery || this.filtreEntrepriseId);
  }

  countByStatut(s: string): number { return this.filteredBase.filter(r => r.statut === s).length; }
  trackById(_: number, r: ReservationResponse): number { return r.id; }

  /* ── LABELS / COLORS ── */

  statutLabel(s: string): string {
    const l: Record<string,string> = {
      EN_ATTENTE:'En attente', CONFIRMEE:'Confirmée',
      EN_COURS:'En cours', ANNULEE:'Annulée', TERMINEE:'Terminée'
    };
    return l[s] ?? s;
  }

  typeLabel(t?: string | null): string {
    const l: Record<string,string> = {
      EMPLOYE_DEDIE:'Employé dédié', RESSOURCE_PARTAGEE:'Ressource partagée',
      FILE_ATTENTE_PURE:"File d'attente", HYBRIDE:'Hybride'
    };
    return t ? (l[t] ?? t) : '';
  }

  typeColor(t?: string | null): string {
    const c: Record<string,string> = {
      EMPLOYE_DEDIE:'#6366f1', RESSOURCE_PARTAGEE:'#10b981',
      FILE_ATTENTE_PURE:'#f59e0b', HYBRIDE:'#ec4899'
    };
    return t ? (c[t] ?? 'var(--primary)') : 'var(--primary)';
  }

  typeIcon(t?: string | null): string {
    const i: Record<string,string> = {
      EMPLOYE_DEDIE:'fas fa-user-tie', RESSOURCE_PARTAGEE:'fas fa-layer-group',
      FILE_ATTENTE_PURE:'fas fa-list-ol', HYBRIDE:'fas fa-random'
    };
    return t ? (i[t] ?? 'fas fa-concierge-bell') : 'fas fa-concierge-bell';
  }

  getAvatarColor(id: number): string { return this.AVATAR_COLORS[id % this.AVATAR_COLORS.length]; }
  getConfig(id: number): ConfigServiceResponse | undefined { return this.configs.get(id); }
  getEntNom(id: number): string { return this.entreprises.find(e => e.id === id)?.nom ?? '—'; }

  getClientNom(id: number | null): string {
    if (!id) return '—';
    const c = this.clients.find(x => x.id === id);
    return c ? `${c.nom} ${c.prenom}` : `Client #${id}`;
  }

  getServiceEntrepriseId(serviceId: number): number {
    return this.services.find(s => s.id === serviceId)?.entrepriseId ?? 0;
  }

  getEntrepriseForReservation(r: ReservationResponse): EntrepriseResponse | null {
    const svc = this.services.find(s => s.id === r.serviceId);
    if (!svc?.entrepriseId) return null;
    return this.entreprises.find(e => e.id === svc.entrepriseId) ?? null;
  }

  getEntrepriseInitials(nom: string): string {
    if (!nom) return '?';
    const words = nom.trim().split(/\s+/);
    return words.length === 1
      ? words[0].substring(0, 2).toUpperCase()
      : (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  }

  getEntrepriseColor(id: number): string { return this.AVATAR_COLORS[id % this.AVATAR_COLORS.length]; }

  /* ── LIFECYCLE ── */

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
      error: () => { this.toast.error('Erreur lors du chargement des réservations'); this.loading = false; }
    });
  }

  reload(): void { this.api.getReservations().subscribe(d => this.reservations = d); }

  /* ── FILTRES ── */

  toggleSort(): void { this.sortAsc = !this.sortAsc; }
  setFiltreStatut(s: string): void { this.filtreStatut = this.filtreStatut === s ? '' : s; }
  setFiltreEntreprise(id: number): void { this.filtreEntrepriseId = this.filtreEntrepriseId === id ? 0 : id; }
  resetFiltres(): void { this.searchQuery = ''; this.filtreStatut = ''; this.filtreDate = ''; this.filtreEntrepriseId = 0; }

  /* ── STEPPER ── */

  canGoNext(): boolean {
    switch (this.formStep) {
      case 1: return this.formEntrepriseId > 0;
      case 2: return !!this.form.get('serviceId')?.value;
      case 3: return !!this.form.get('clientId')?.value && !!this.form.get('heureDebut')?.value;
      default: return true;
    }
  }
  nextStep(): void { if (this.canGoNext() && this.formStep < 4) this.formStep++; }
  prevStep(): void { if (this.formStep > 1) this.formStep--; }

  /* ── FORM HELPERS ── */

  onEntrepriseChange(): void {
    this.filteredServices = this.services.filter(s => s.entrepriseId === this.formEntrepriseId);
    this.filteredClients  = this.clients.filter(c => c.entreprises?.some((e: any) => e.id === this.formEntrepriseId));
    this.selectedConfig   = null;
    this.form.patchValue({ serviceId: null, clientId: null });
  }

  onServiceChange(): void {
    const sid = this.form.get('serviceId')?.value;
    this.selectedConfig = sid ? (this.configs.get(sid) ?? null) : null;
  }

  /* ── MODALES ── */

  openCreate(): void {
    this.modalMode = 'create'; this.editing = null; this.formStep = 1;
    this.formEntrepriseId = 0; this.filteredServices = []; this.filteredClients = [];
    this.selectedConfig = null; this.form.reset({ nombrePersonnes: 1 }); this.showModal = true;
  }

  openEdit(r: ReservationResponse): void {
    this.modalMode = 'edit'; this.editing = r; this.formStep = 1;
    const svc = this.services.find(s => s.id === r.serviceId);
    this.formEntrepriseId = svc?.entrepriseId ?? 0;
    this.onEntrepriseChange();
    this.selectedConfig = r.serviceId ? (this.configs.get(r.serviceId) ?? null) : null;
    this.form.patchValue({
      clientId: r.clientId,
      serviceId: r.serviceId,
      heureDebut: r.heureDebut, 
      nombrePersonnes: r.nombrePersonnes ?? 1,
      notes: r.notes ?? ''
    });
    this.showModal = true;
  }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loadingModal = true;
    const v = this.form.getRawValue();
    const body = { clientId: v.clientId, serviceId: v.serviceId, employeId: null, ressourceId: null, heureDebut: v.heureDebut, nombrePersonnes: v.nombrePersonnes ?? 1, notes: v.notes || null };
    const req$ = this.editing ? this.api.updateReservation(this.editing.id, body as any) : this.api.createReservation(body as any);
    req$.subscribe({
      next: () => { this.toast.success(this.editing ? 'Réservation modifiée !' : 'Réservation créée !'); this.reload(); this.closeModal(); this.loadingModal = false; },
      error: (err: any) => {
        this.loadingModal = false;
        let msg = 'Erreur lors de la réservation';
        if (err?.error?.message) {
          if (err.error.message.includes('overlap') || err.error.message.includes('chevauchement')) msg = 'Ce créneau est déjà réservé. Choisissez un autre horaire.';
          else if (err.error.message.includes('not found')) msg = 'Données invalides. Veuillez réessayer.';
          else msg = 'Impossible de réserver ce créneau. Il est peut-être déjà occupé.';
        }
        this._showErrorDialog(msg);
      }
    });
  }

  closeModal(): void { this.showModal = false; this.editing = null; this.formStep = 1; this.form.reset({ nombrePersonnes: 1 }); }

  /* ── DÉTAIL ── */

  openDetail(r: ReservationResponse): void { this.selectedDetail = r; }
  closeDetail(): void { this.selectedDetail = null; }

  /* ── ACTIONS ── */

  changerStatut(r: ReservationResponse, statut: string): void {
    this.api.changerStatutReservation(r.id, statut as any).subscribe({
      next: updated => {
        const idx = this.reservations.findIndex(x => x.id === r.id);
        if (idx !== -1) this.reservations[idx] = updated;
        if (this.selectedDetail?.id === r.id) this.selectedDetail = updated;
        this.toast.success(`Statut mis à jour → ${this.statutLabel(statut)}`);
      },
      error: (err: any) => this.toast.error(err?.error?.message || 'Erreur')
    });
  }

  annuler(r: ReservationResponse): void {
    this._showConfirmDialog({
      title: 'Annuler la réservation ?',
      body: `Réservation <strong>#${r.id}</strong> — ${r.clientNom} ${r.clientPrenom}`,
      icon: '🚫', iconBg: 'rgba(245,158,11,.12)', iconBdr: 'rgba(245,158,11,.3)',
      okLabel: 'Oui, annuler', okStyle: 'background:linear-gradient(135deg,#f59e0b,#d97706)',
      onOk: () => this.changerStatut(r, 'ANNULEE')
    });
  }

  supprimer(r: ReservationResponse): void {
    this._showConfirmDialog({
      title: 'Supprimer définitivement ?',
      body: `Réservation <strong>#${r.id}</strong> — ${r.clientNom} ${r.clientPrenom}<br><small style="color:#f87171">Cette action est irréversible.</small>`,
      icon: '🗑️', iconBg: 'rgba(239,68,68,.12)', iconBdr: 'rgba(239,68,68,.3)',
      okLabel: 'Supprimer', okStyle: 'background:linear-gradient(135deg,#ef4444,#dc2626)',
      onOk: () => {
        this.api.deleteReservation(r.id).subscribe({
          next: () => { this.reservations = this.reservations.filter(x => x.id !== r.id); if (this.selectedDetail?.id === r.id) this.closeDetail(); this.toast.success('Réservation supprimée'); },
          error: (err: any) => this.toast.error(err?.error?.message || 'Erreur')
        });
      }
    });
  }

  /* ── DIALOGS ── */

  private _showConfirmDialog(opts: { title:string; body:string; icon:string; iconBg:string; iconBdr:string; okLabel:string; okStyle:string; onOk:()=>void }): void {
    const overlay = this._makeOverlay();
    const box = this._makeDialogBox(opts.iconBdr);
    box.innerHTML = `
      <div style="width:52px;height:52px;background:${opts.iconBg};border:2px solid ${opts.iconBdr};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.4rem;margin:0 auto 16px">${opts.icon}</div>
      <div style="font-size:1rem;font-weight:700;color:var(--text-primary,#111827);margin-bottom:10px">${opts.title}</div>
      <div style="font-size:.83rem;color:var(--text-muted,#6b7280);margin-bottom:22px;line-height:1.6">${opts.body}</div>
      <div style="display:flex;gap:10px;justify-content:center">
        <button id="dlg-cancel" style="background:var(--bg-secondary,#f3f4f6);color:var(--text-secondary,#374151);border:1px solid var(--border-md,rgba(0,0,0,.1));padding:9px 20px;border-radius:10px;font-size:.82rem;font-weight:600;cursor:pointer;font-family:inherit">Annuler</button>
        <button id="dlg-ok" style="${opts.okStyle};color:#fff;border:none;padding:9px 22px;border-radius:10px;font-size:.82rem;font-weight:700;cursor:pointer;font-family:inherit">${opts.okLabel}</button>
      </div>`;
    this.renderer.appendChild(overlay, box);
    this.renderer.appendChild(document.body, overlay);
    const close = () => this.renderer.removeChild(document.body, overlay);
    box.querySelector('#dlg-cancel')!.addEventListener('click', close);
    box.querySelector('#dlg-ok')!.addEventListener('click', () => { close(); opts.onOk(); });
    overlay.addEventListener('click', (e: Event) => { if (e.target === overlay) close(); });
  }

  private _showErrorDialog(msg: string): void {
    const overlay = this._makeOverlay();
    const box = this._makeDialogBox('rgba(239,68,68,.3)');
    box.innerHTML = `
      <div style="width:52px;height:52px;background:rgba(239,68,68,.12);border:2px solid rgba(239,68,68,.3);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.4rem;margin:0 auto 16px">⚠️</div>
      <div style="font-size:1rem;font-weight:700;color:var(--text-primary,#111827);margin-bottom:12px">Réservation impossible</div>
      <div style="font-size:.83rem;color:var(--text-muted,#6b7280);margin-bottom:22px;line-height:1.6;background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.15);border-radius:10px;padding:12px 14px">${msg}</div>
      <button id="dlg-ok" style="background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;border:none;padding:10px 36px;border-radius:10px;font-size:.85rem;font-weight:700;cursor:pointer;width:100%;font-family:inherit">Compris</button>`;
    this.renderer.appendChild(overlay, box);
    this.renderer.appendChild(document.body, overlay);
    const close = () => this.renderer.removeChild(document.body, overlay);
    box.querySelector('#dlg-ok')!.addEventListener('click', close);
    overlay.addEventListener('click', (e: Event) => { if (e.target === overlay) close(); });
  }

  private _makeOverlay(): HTMLElement {
    const overlay = this.renderer.createElement('div');
    (['position','inset','background','backdropFilter','zIndex','display','alignItems','justifyContent'] as const)
      .forEach((k,i) => this.renderer.setStyle(overlay, k, ['fixed','0','rgba(0,0,0,.5)','blur(4px)','99999','flex','center','center'][i]));
    return overlay;
  }

  private _makeDialogBox(borderColor: string): HTMLElement {
    const box = this.renderer.createElement('div');
    const s: Record<string,string> = { background:'var(--bg-card,#fff)', border:`1px solid ${borderColor}`, borderRadius:'18px', padding:'32px 28px', textAlign:'center', maxWidth:'400px', width:'90%', boxShadow:'0 24px 64px rgba(0,0,0,.15)', fontFamily:'inherit' };
    Object.entries(s).forEach(([k,v]) => this.renderer.setStyle(box, k, v));
    return box;
  }
}