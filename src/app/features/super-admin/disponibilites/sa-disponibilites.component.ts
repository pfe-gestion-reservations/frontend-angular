import { Component, OnInit, inject, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  DisponibiliteResponse, ServiceResponse, ConfigServiceResponse,
  JourSemaine, RessourceResponse, EntrepriseResponse
} from '../../../core/models/api.models';
import { forkJoin } from 'rxjs';

const JOURS: JourSemaine[] = ['LUNDI','MARDI','MERCREDI','JEUDI','VENDREDI','SAMEDI','DIMANCHE'];
const JOUR_FULL: Record<string,string> = {
  LUNDI:'Lundi', MARDI:'Mardi', MERCREDI:'Mercredi', JEUDI:'Jeudi',
  VENDREDI:'Vendredi', SAMEDI:'Samedi', DIMANCHE:'Dimanche'
};
const TYPE_LABEL: Record<string,string> = {
  EMPLOYE_DEDIE:'Employé dédié', RESSOURCE_PARTAGEE:'Ressource partagée',
  FILE_ATTENTE_PURE:"File d'attente", HYBRIDE:'Hybride'
};
const TYPE_ICON: Record<string,string> = {
  EMPLOYE_DEDIE:'fas fa-user-tie', RESSOURCE_PARTAGEE:'fas fa-layer-group',
  FILE_ATTENTE_PURE:'fas fa-list-ol', HYBRIDE:'fas fa-code-branch'
};
const TYPE_COLOR: Record<string,string> = {
  EMPLOYE_DEDIE:'#6366f1', RESSOURCE_PARTAGEE:'#10b981',
  FILE_ATTENTE_PURE:'#f59e0b', HYBRIDE:'#ec4899'
};

type FormStep = 'service' | 'jour' | 'horaire';

@Component({
  selector: 'app-sa-disponibilites',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './sa-disponibilites.component.html',
  styleUrls: ['./sa-disponibilites.component.css']
})
export class SaDisponibilitesComponent implements OnInit {
  private api      = inject(ApiService);
  private toast    = inject(ToastService);
  private fb       = inject(FormBuilder);
  private renderer = inject(Renderer2);

  readonly JOURS     = JOURS;
  readonly JOUR_FULL = JOUR_FULL;
  readonly TYPE_LABEL = TYPE_LABEL;

  dispos:      DisponibiliteResponse[]  = [];
  filtered:    DisponibiliteResponse[]  = [];
  services:    ServiceResponse[]        = [];
  entreprises: EntrepriseResponse[]     = [];
  configs      = new Map<number, ConfigServiceResponse>();

  // ── Filtres header ──────────────────────────────────────────────────────
  selectedEntrepriseId: number | null  = null;
  entFilterOpen   = false;
  entSearch       = '';
  filteredEntreprisesList: EntrepriseResponse[] = [];

  filterSearch    = '';
  filterOpen      = false;
  selectedFilterService: ServiceResponse | null = null;
  filteredServicesList:  ServiceResponse[] = [];

  // ── Modal état ──────────────────────────────────────────────────────────
  showModal = false;
  editing:  DisponibiliteResponse | null = null;
  loading   = false;
  formStep: FormStep = 'service';

  // Step 1 : service
  entModalOpen    = false;
  entModalSearch  = '';
  filteredEntreprisesModal: EntrepriseResponse[] = [];
  modalDropdownOpen = false;
  modalSearch       = '';
  modalSelectedService: ServiceResponse | null = null;
  filteredModalServices: ServiceResponse[] = [];
  detailRessources: RessourceResponse[] = [];

  // Step 2 : jour
  selectedJour: JourSemaine | null = null;

  // Step 3 : horaires
  focusDebut = false;
  focusFin   = false;

  // ── Détail ──────────────────────────────────────────────────────────────
  showDetail  = false;
  detailDispo: DisponibiliteResponse | null = null;
  detailDispoRessources: RessourceResponse[] = [];

  form = this.fb.group({
    serviceId:  ['', Validators.required],
    jour:       ['', Validators.required],
    heureDebut: ['', Validators.required],
    heureFin:   ['', Validators.required]
  });

  // ── Lifecycle ────────────────────────────────────────────────────────────
  ngOnInit(): void {
    document.addEventListener('click', () => {
      this.filterOpen = false;
      this.entFilterOpen = false;
      this.entModalOpen = false;
    });
    this.api.getEntreprises().subscribe((e: EntrepriseResponse[]) => {
      this.entreprises = e;
      this.filteredEntreprisesList   = [...e];
      this.filteredEntreprisesModal  = [...e];
    });
    this.loadServices();
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  getConfig(sid?: number) { return sid ? this.configs.get(sid) : undefined; }
  getService(sid: number) { return this.services.find(s => s.id === sid); }
  typeColor(t?: string)   { return t ? (TYPE_COLOR[t] || 'var(--accent)') : 'var(--accent)'; }
  typeIconCls(t?: string) { return t ? (TYPE_ICON[t]  || 'fas fa-concierge-bell') : 'fas fa-concierge-bell'; }
  fmt(t: string)          { return t ? t.substring(0,5) : ''; }
  getEntNom(id?: number | null): string { return this.entreprises.find(e => e.id === id)?.nom || ''; }

  calcDur(a: string, b: string): string {
    if (!a || !b) return '';
    const [ah,am] = a.split(':').map(Number);
    const [bh,bm] = b.split(':').map(Number);
    const mins = (bh*60+bm) - (ah*60+am);
    if (mins <= 0) return '';
    const h = Math.floor(mins/60), m = mins%60;
    return h > 0 ? `${h}h${m > 0 ? String(m).padStart(2,'0') : ''}` : `${m} min`;
  }

  get servicesFiltresEntreprise(): ServiceResponse[] {
    if (!this.selectedEntrepriseId) return this.services;
    return this.services.filter(s => s.entrepriseId === this.selectedEntrepriseId);
  }

  // ── Chargement ───────────────────────────────────────────────────────────
  loadServices(): void {
    this.api.getServices().subscribe((s: ServiceResponse[]) => {
      this.services = s;
      s.forEach(svc =>
        this.api.getConfigService(svc.id).subscribe({ next: c => this.configs.set(svc.id, c), error: () => {} })
      );
      this.applyEntrepriseFilter();
      this.loadAllDispos();
    });
  }

  loadAllDispos(): void {
    const svcs = this.selectedEntrepriseId ? this.servicesFiltresEntreprise : this.services;
    if (!svcs.length) { this.dispos = []; this.filtered = []; return; }
    const all: DisponibiliteResponse[] = [];
    let done = 0;
    svcs.forEach(s => {
      this.api.getDispoByService(s.id).subscribe(d => {
        all.push(...d);
        if (++done === svcs.length) { this.dispos = all; this.applyFilter(); }
      });
    });
  }

  // ── Filtres header ───────────────────────────────────────────────────────
  filterEntreprisesList(): void {
    const q = this.entSearch.toLowerCase();
    this.filteredEntreprisesList = this.entreprises.filter(e => e.nom.toLowerCase().includes(q));
  }
  selectEntreprise(e: EntrepriseResponse): void {
    this.selectedEntrepriseId = e.id; this.entFilterOpen = false; this.onEntrepriseChange();
  }
  clearEntrepriseFilter(): void {
    this.selectedEntrepriseId = null; this.entSearch = '';
    this.filteredEntreprisesList = [...this.entreprises];
    this.entFilterOpen = false; this.onEntrepriseChange();
  }
  onEntrepriseChange(): void { this.applyEntrepriseFilter(); this.loadAllDispos(); }

  applyEntrepriseFilter(): void {
    const svcs = this.servicesFiltresEntreprise;
    this.filteredServicesList  = svcs;
    this.filteredModalServices = svcs;
    if (this.selectedFilterService && !svcs.find(s => s.id === this.selectedFilterService!.id))
      this.selectedFilterService = null;
    if (this.modalSelectedService && !svcs.find(s => s.id === this.modalSelectedService!.id))
      this.clearModalSelect();
    this.applyFilter();
  }

  applyFilter(): void {
    let result = this.selectedEntrepriseId
      ? this.dispos.filter(d => this.services.find(s => s.id === d.serviceId)?.entrepriseId === this.selectedEntrepriseId)
      : [...this.dispos];
    if (this.selectedFilterService)
      result = result.filter(d => d.serviceId === this.selectedFilterService!.id);
    this.filtered = result;
  }

  filterServicesList(): void {
    const q = this.filterSearch.toLowerCase();
    this.filteredServicesList = this.servicesFiltresEntreprise.filter(s => s.nom.toLowerCase().includes(q));
  }
  selectFilterService(s: ServiceResponse): void { this.selectedFilterService = s; this.filterOpen = false; this.applyFilter(); }
  clearFilter(): void {
    this.selectedFilterService = null; this.filterSearch = '';
    this.filteredServicesList = this.servicesFiltresEntreprise;
    this.filterOpen = false; this.applyFilter();
  }

  // ── Détail ───────────────────────────────────────────────────────────────
  openDetail(d: DisponibiliteResponse): void {
    this.detailDispo = d; this.detailDispoRessources = []; this.showDetail = true;
    if (this.getConfig(d.serviceId)?.typeService === 'RESSOURCE_PARTAGEE') {
      this.api.getRessourcesByService(d.serviceId).subscribe({
        next: r => this.detailDispoRessources = r.filter(x => !x.archived),
        error: () => {}
      });
    }
  }
  closeDetail(): void { this.showDetail = false; this.detailDispo = null; this.detailDispoRessources = []; }

  // ── Modal stepper ────────────────────────────────────────────────────────
  openModal(d?: DisponibiliteResponse): void {
    this.editing = d ?? null;
    this.formStep = 'service';
    this.selectedJour = null;
    this.clearModalSelect();
    this.filteredEntreprisesModal = [...this.entreprises];
    this.filteredModalServices   = this.servicesFiltresEntreprise;
    this.form.reset();

    if (d) {
      const svc = this.services.find(s => s.id === d.serviceId);
      if (svc) {
        this.modalSelectedService = svc;
        this.modalSearch = svc.nom;
        this.form.get('serviceId')?.setValue(String(svc.id));
        if (this.getConfig(svc.id)?.typeService === 'RESSOURCE_PARTAGEE') {
          this.api.getRessourcesByService(svc.id).subscribe({
            next: r => this.detailRessources = r.filter(x => !x.archived), error: () => {}
          });
        }
      }
      this.selectedJour = d.jour as JourSemaine;
      this.form.get('jour')?.setValue(d.jour);
      this.form.get('heureDebut')?.setValue(d.heureDebut);
      this.form.get('heureFin')?.setValue(d.heureFin);
      // In edit mode, jump to step 3 directly
      this.formStep = 'horaire';
    }
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false; this.editing = null;
    this.formStep = 'service'; this.selectedJour = null;
    this.clearModalSelect(); this.form.reset();
  }

  // Step navigation
  goToJour(): void {
    if (!this.modalSelectedService) {
      this._showValidationPopup('Sélectionnez un service', 'Veuillez choisir un service avant de continuer.');
      return;
    }
    this.formStep = 'jour';
  }

  goToHoraire(): void {
    if (!this.selectedJour) {
      this._showValidationPopup('Sélectionnez un jour', 'Veuillez choisir un jour de la semaine avant de continuer.');
      return;
    }
    this.form.get('jour')?.setValue(this.selectedJour);
    this.formStep = 'horaire';
  }

  selectJour(j: JourSemaine): void {
    this.selectedJour = j;
    this.form.get('jour')?.setValue(j);
  }

  // ── Dropdown service dans modal ──────────────────────────────────────────
  filterEntreprisesModal(): void {
    const q = this.entModalSearch.toLowerCase();
    this.filteredEntreprisesModal = this.entreprises.filter(e => e.nom.toLowerCase().includes(q));
  }
  selectEntrepriseModal(e: EntrepriseResponse): void {
    this.selectedEntrepriseId = e.id; this.entModalOpen = false; this.applyEntrepriseFilter();
  }
  clearEntrepriseModal(): void {
    this.selectedEntrepriseId = null; this.entModalSearch = '';
    this.filteredEntreprisesModal = [...this.entreprises];
    this.entModalOpen = false; this.applyEntrepriseFilter();
  }

  filterModalServices(): void {
    const q = this.modalSearch.toLowerCase();
    this.filteredModalServices = this.servicesFiltresEntreprise.filter(s => s.nom.toLowerCase().includes(q));
  }

  selectModalService(s: ServiceResponse): void {
    this.modalSelectedService = s;
    this.modalSearch = s.nom;
    this.modalDropdownOpen = false;
    this.form.get('serviceId')?.setValue(String(s.id));
    this.detailRessources = [];
    if (this.getConfig(s.id)?.typeService === 'RESSOURCE_PARTAGEE') {
      this.api.getRessourcesByService(s.id).subscribe({
        next: r => this.detailRessources = r.filter(x => !x.archived), error: () => {}
      });
    }
  }

  clearModalSelect(): void {
    this.modalSelectedService = null; this.modalSearch = '';
    this.filteredModalServices = this.servicesFiltresEntreprise;
    this.form.get('serviceId')?.setValue('');
    this.detailRessources = [];
  }

  // ── Validation helpers ───────────────────────────────────────────────────
  get modalDurText(): string {
    const d = this.form.get('heureDebut')?.value;
    const f = this.form.get('heureFin')?.value;
    if (!d || !f) return '';
    const dur = this.calcDur(d, f);
    if (!dur) return '⚠ Heure de fin doit être après le début';
    if (this.modalSelectedService) {
      const [ah,am] = d.split(':').map(Number);
      const [bh,bm] = f.split(':').map(Number);
      const mins = (bh*60+bm) - (ah*60+am);
      if (mins < this.modalSelectedService.dureeMinutes)
        return `⚠ Créneau trop court — minimum ${this.modalSelectedService.dureeMinutes} min`;
    }
    return dur;
  }

  get isCreneauValide(): boolean {
    const d = this.form.get('heureDebut')?.value;
    const f = this.form.get('heureFin')?.value;
    if (!d || !f || !this.modalSelectedService) return true;
    const [ah,am] = d.split(':').map(Number);
    const [bh,bm] = f.split(':').map(Number);
    return (bh*60+bm) - (ah*60+am) >= this.modalSelectedService.dureeMinutes;
  }

  getExistingSlots(): DisponibiliteResponse[] {
    if (!this.modalSelectedService || !this.selectedJour) return [];
    return this.dispos.filter(d =>
      d.serviceId === this.modalSelectedService!.id &&
      d.jour === this.selectedJour &&
      (!this.editing || d.id !== this.editing.id)
    );
  }

  get chevauchement(): string | null {
    const sid   = this.form.get('serviceId')?.value;
    const jour  = this.form.get('jour')?.value;
    const debut = this.form.get('heureDebut')?.value;
    const fin   = this.form.get('heureFin')?.value;
    if (!sid || !jour || !debut || !fin) return null;
    const toMin = (t: string) => { const [h,m] = t.split(':').map(Number); return h*60+m; };
    const dMin = toMin(debut), fMin = toMin(fin);
    if (fMin <= dMin) return null;
    const doublon = this.dispos.find(d => {
      if (d.serviceId !== Number(sid)) return false;
      if (d.jour !== jour) return false;
      if (this.editing && d.id === this.editing.id) return false;
      return dMin < toMin(d.heureFin) && fMin > toMin(d.heureDebut);
    });
    return doublon ? `Chevauchement avec ${this.fmt(doublon.heureDebut)}–${this.fmt(doublon.heureFin)}` : null;
  }

  // ── Save ─────────────────────────────────────────────────────────────────
  save(): void {
    if (this.form.invalid) {
      this._showValidationPopup('Formulaire incomplet', 'Veuillez remplir tous les champs obligatoires.');
      return;
    }
    if (!this.isCreneauValide) {
      this._showValidationPopup(
        'Créneau trop court',
        `Ce créneau est inférieur à la durée minimale du service (${this.modalSelectedService?.dureeMinutes} min).`
      );
      return;
    }
    if (this.chevauchement) {
      this._showValidationPopup('Créneau en conflit', this.chevauchement);
      return;
    }
    this.loading = true;
    const v    = this.form.value;
    const body = { serviceId: Number(v.serviceId), jour: v.jour as JourSemaine, heureDebut: v.heureDebut!, heureFin: v.heureFin! };
    (this.editing ? this.api.updateDispo(this.editing.id, body) : this.api.createDispo(body)).subscribe({
      next: () => {
        this.toast.success(this.editing ? 'Créneau modifié !' : 'Créneau ajouté !');
        this.loadAllDispos(); this.closeModal(); this.loading = false;
      },
      error: (err: any) => {
        const msg = err?.error?.message || (typeof err?.error === 'string' ? err?.error : '');
        const status = err?.status;
        if (status === 409 || msg?.toLowerCase().includes('chevauche') || msg?.toLowerCase().includes('conflit')) {
          this._showValidationPopup('Créneau en conflit', msg || 'Ce créneau chevauche un créneau existant.');
        } else {
          this._showValidationPopup('Erreur', msg || 'Une erreur est survenue lors de l\'enregistrement.');
        }
        this.loading = false;
      }
    });
  }

  // ── Suppression ──────────────────────────────────────────────────────────
  delete(d: DisponibiliteResponse): void {
    const toMin = (t: string) => { const [h,m] = t.split(':').map(Number); return h*60+m; };
    const dMin = toMin(d.heureDebut), fMin = toMin(d.heureFin);
    forkJoin({
      reservations: this.api.getReservations(),
      fileAttente:  this.api.getFileAttente()
    }).subscribe({
      next: ({ reservations, fileAttente }) => {
        const resLiees  = reservations.filter(r =>
          r.serviceId === d.serviceId &&
          toMin(r.heureDebut) >= dMin && toMin(r.heureDebut) < fMin
        );
        const fileLiees = fileAttente.filter(f =>
          f.serviceId === d.serviceId &&
          f.heureDebut != null &&
          toMin(f.heureDebut) >= dMin && toMin(f.heureDebut) < fMin
        );
        if (resLiees.length > 0 || fileLiees.length > 0) {
          this._showLinkedCreneauDialog(d, resLiees.length, fileLiees.length);
        } else {
          this._showDeleteCreneauConfirm(d);
        }
      },
      error: () => this._showDeleteCreneauConfirm(d)
    });
  }

  // ── Popup helpers ─────────────────────────────────────────────────────────
  private _showValidationPopup(title: string, message: string): void {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const bg     = isDark ? '#16161f' : '#ffffff';
    const text   = isDark ? '#f2f2f8' : '#0f0f1a';
    const muted  = isDark ? '#a2a2b8' : '#7070a0';

    const overlay = this.renderer.createElement('div');
    this.renderer.setStyle(overlay, 'position', 'fixed');
    this.renderer.setStyle(overlay, 'inset', '0');
    this.renderer.setStyle(overlay, 'background', 'rgba(0,0,0,0.6)');
    this.renderer.setStyle(overlay, 'z-index', '99999');
    this.renderer.setStyle(overlay, 'display', 'flex');
    this.renderer.setStyle(overlay, 'align-items', 'center');
    this.renderer.setStyle(overlay, 'justify-content', 'center');
    this.renderer.setStyle(overlay, 'backdrop-filter', 'blur(4px)');
    const box = this.renderer.createElement('div');
    this.renderer.setStyle(box, 'background', bg);
    this.renderer.setStyle(box, 'border', `1px solid ${isDark ? 'rgba(255,255,255,.1)' : '#e2e2f0'}`);
    this.renderer.setStyle(box, 'border-radius', '20px');
    this.renderer.setStyle(box, 'padding', '32px 28px');
    this.renderer.setStyle(box, 'text-align', 'center');
    this.renderer.setStyle(box, 'max-width', '380px');
    this.renderer.setStyle(box, 'width', '90%');
    this.renderer.setStyle(box, 'box-shadow', isDark ? '0 24px 64px rgba(0,0,0,.6)' : '0 16px 48px rgba(0,0,0,.15)');
    this.renderer.setStyle(box, 'font-family', 'Plus Jakarta Sans, sans-serif');
    const close = () => this.renderer.removeChild(document.body, overlay);
    box.innerHTML = `
      <div style="width:48px;height:48px;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.3);
           border-radius:14px;display:flex;align-items:center;justify-content:center;
           font-size:1.2rem;margin:0 auto 14px;color:#f59e0b">
        <i class="fas fa-exclamation-triangle"></i>
      </div>
      <div style="font-size:1rem;font-weight:700;color:${text};margin-bottom:8px;letter-spacing:-0.01em">${title}</div>
      <div style="font-size:.875rem;color:${muted};margin-bottom:22px;line-height:1.6">${message}</div>
      <button id="vp-ok" style="background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:none;
        padding:10px 32px;border-radius:10px;font-size:.875rem;font-weight:700;cursor:pointer;font-family:inherit">
        Compris
      </button>`;
    this.renderer.appendChild(overlay, box);
    this.renderer.appendChild(document.body, overlay);
    box.querySelector('#vp-ok')!.addEventListener('click', () => this.renderer.removeChild(document.body, overlay));
    overlay.addEventListener('click', (e: Event) => { if (e.target === overlay) close(); });
  }

  private _showDeleteCreneauConfirm(d: DisponibiliteResponse): void {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const svc    = this.getService(d.serviceId);
    const bg     = isDark ? '#16161f' : '#ffffff';
    const text   = isDark ? '#f2f2f8' : '#0f0f1a';
    const muted  = isDark ? '#a2a2b8' : '#7070a0';
    const cbg    = isDark ? 'rgba(255,255,255,.06)' : '#f4f4f8';
    const cbd    = isDark ? 'rgba(255,255,255,.12)' : '#e2e2f0';
    const cbl    = isDark ? '#a2a2b8' : '#4a4a6a';

    const overlay = this.renderer.createElement('div');
    this.renderer.setStyle(overlay, 'position', 'fixed');
    this.renderer.setStyle(overlay, 'inset', '0');
    this.renderer.setStyle(overlay, 'background', 'rgba(0,0,0,0.6)');
    this.renderer.setStyle(overlay, 'z-index', '99999');
    this.renderer.setStyle(overlay, 'display', 'flex');
    this.renderer.setStyle(overlay, 'align-items', 'center');
    this.renderer.setStyle(overlay, 'justify-content', 'center');
    this.renderer.setStyle(overlay, 'backdrop-filter', 'blur(4px)');
    const box = this.renderer.createElement('div');
    this.renderer.setStyle(box, 'background', bg);
    this.renderer.setStyle(box, 'border', `1px solid ${isDark ? 'rgba(239,68,68,.25)' : '#fecaca'}`);
    this.renderer.setStyle(box, 'border-radius', '20px');
    this.renderer.setStyle(box, 'padding', '32px 28px');
    this.renderer.setStyle(box, 'text-align', 'center');
    this.renderer.setStyle(box, 'max-width', '400px');
    this.renderer.setStyle(box, 'width', '90%');
    this.renderer.setStyle(box, 'box-shadow', isDark ? '0 24px 64px rgba(0,0,0,.6)' : '0 16px 48px rgba(0,0,0,.15)');
    this.renderer.setStyle(box, 'font-family', 'Plus Jakarta Sans, sans-serif');
    this.renderer.setStyle(box, 'animation', 'slideUp .2s cubic-bezier(.34,1.56,.64,1)');
    const close = () => this.renderer.removeChild(document.body, overlay);
    box.innerHTML = `
      <div style="width:52px;height:52px;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);
           border-radius:14px;display:flex;align-items:center;justify-content:center;
           font-size:1.3rem;margin:0 auto 16px;color:#ef4444">
        <i class="fas fa-trash-alt"></i>
      </div>
      <div style="font-size:1rem;font-weight:700;color:${text};margin-bottom:10px">Supprimer ce créneau ?</div>
      <div style="background:${isDark ? 'rgba(255,255,255,.04)' : '#f8f8fc'};border:1px solid ${isDark ? 'rgba(255,255,255,.08)' : '#e2e2f0'};
           border-radius:12px;padding:14px 16px;margin-bottom:16px">
        <div style="font-size:.78rem;color:${muted};margin-bottom:4px">
          <i class="fas fa-concierge-bell" style="margin-right:5px;color:${isDark ? '#6366f1' : '#4f46e5'}"></i>
          ${svc?.nom ?? d.serviceNom}
        </div>
        <div style="font-size:1rem;font-weight:700;color:${text}">
          ${this.JOUR_FULL[d.jour]} &nbsp;·&nbsp; ${this.fmt(d.heureDebut)} – ${this.fmt(d.heureFin)}
        </div>
        <div style="font-size:.78rem;color:${muted};margin-top:4px">
          <i class="fas fa-hourglass-half" style="margin-right:4px"></i>
          ${this.calcDur(d.heureDebut, d.heureFin)}
        </div>
      </div>
      <div style="font-size:.75rem;color:#ef4444;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);
           border-radius:8px;padding:8px 12px;margin-bottom:22px">
        <i class="fas fa-exclamation-triangle" style="margin-right:5px"></i>
        Cette action est irréversible.
      </div>
      <div style="display:flex;gap:8px;justify-content:center">
        <button id="del-cancel" style="background:${cbg};color:${cbl};border:1px solid ${cbd};
          padding:9px 20px;border-radius:8px;font-size:.82rem;font-weight:600;cursor:pointer;font-family:inherit">
          Annuler
        </button>
        <button id="del-ok" style="background:#ef4444;color:#fff;border:none;
          padding:9px 22px;border-radius:8px;font-size:.82rem;font-weight:700;cursor:pointer;font-family:inherit">
          <i class="fas fa-trash-alt" style="margin-right:5px"></i>Supprimer
        </button>
      </div>`;
    this.renderer.appendChild(overlay, box);
    this.renderer.appendChild(document.body, overlay);
    box.querySelector('#del-cancel')!.addEventListener('click', close);
    box.querySelector('#del-ok')!.addEventListener('click', () => {
      close();
      this.api.deleteDispo(d.id).subscribe({
        next: () => { this.toast.success('Créneau supprimé'); this.loadAllDispos(); },
        error: err => {
          if (err.status === 409 || err.status === 400) {
            this._showLinkedCreneauDialog(d, 0, 0); return;
          }
          this._showValidationPopup('Erreur de suppression', err?.error?.message || 'Une erreur est survenue.');
        }
      });
    });
    overlay.addEventListener('click', (e: Event) => { if (e.target === overlay) close(); });
  }

  private _showLinkedCreneauDialog(d: DisponibiliteResponse, nbRes: number, nbFile: number): void {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const svc    = this.getService(d.serviceId);
    const bg     = isDark ? '#16161f' : '#ffffff';
    const text   = isDark ? '#f2f2f8' : '#0f0f1a';
    const muted  = isDark ? '#a2a2b8' : '#7070a0';
    const sub    = isDark ? '#78788c' : '#9090b0';
    const hintBg = isDark ? 'rgba(255,255,255,.04)' : '#f4f4f8';
    const hintBd = isDark ? 'rgba(255,255,255,.08)' : '#e2e2f0';

    const overlay = this.renderer.createElement('div');
    this.renderer.setStyle(overlay, 'position', 'fixed');
    this.renderer.setStyle(overlay, 'inset', '0');
    this.renderer.setStyle(overlay, 'background', 'rgba(0,0,0,0.6)');
    this.renderer.setStyle(overlay, 'z-index', '99999');
    this.renderer.setStyle(overlay, 'display', 'flex');
    this.renderer.setStyle(overlay, 'align-items', 'center');
    this.renderer.setStyle(overlay, 'justify-content', 'center');
    this.renderer.setStyle(overlay, 'backdrop-filter', 'blur(4px)');
    const box = this.renderer.createElement('div');
    this.renderer.setStyle(box, 'background', bg);
    this.renderer.setStyle(box, 'border', `1px solid ${isDark ? 'rgba(255,255,255,.1)' : '#e2e2f0'}`);
    this.renderer.setStyle(box, 'border-radius', '20px');
    this.renderer.setStyle(box, 'padding', '28px 24px');
    this.renderer.setStyle(box, 'text-align', 'center');
    this.renderer.setStyle(box, 'max-width', '450px');
    this.renderer.setStyle(box, 'width', '92%');
    this.renderer.setStyle(box, 'box-shadow', isDark ? '0 24px 64px rgba(0,0,0,.6)' : '0 16px 48px rgba(0,0,0,.15)');
    this.renderer.setStyle(box, 'font-family', 'Plus Jakarta Sans, sans-serif');

    const close = () => this.renderer.removeChild(document.body, overlay);
    const items: string[] = [];

    if (nbRes > 0) items.push(`
      <div style="display:flex;align-items:center;gap:12px;background:rgba(239,68,68,.08);
           border:1px solid rgba(239,68,68,.18);border-radius:12px;padding:12px 14px;text-align:left">
        <div style="width:34px;height:34px;background:rgba(239,68,68,.1);border-radius:10px;
          display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#ef4444;font-size:.9rem">
          <i class="fas fa-calendar-alt"></i>
        </div>
        <div>
          <div style="color:#ef4444;font-weight:700;font-size:.82rem;margin-bottom:2px">
            ${nbRes} réservation${nbRes > 1 ? 's' : ''} sur ce créneau
          </div>
          <div style="font-size:.74rem;color:${sub}">Réservations liées à cet horaire</div>
        </div>
      </div>`);

    if (nbFile > 0) items.push(`
      <div style="display:flex;align-items:center;gap:12px;background:rgba(245,158,11,.08);
           border:1px solid rgba(245,158,11,.18);border-radius:12px;padding:12px 14px;text-align:left">
        <div style="width:34px;height:34px;background:rgba(245,158,11,.1);border-radius:10px;
          display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#f59e0b;font-size:.9rem">
          <i class="fas fa-list-ol"></i>
        </div>
        <div>
          <div style="color:#f59e0b;font-weight:700;font-size:.82rem;margin-bottom:2px">
            ${nbFile} entrée${nbFile > 1 ? 's' : ''} en file d'attente
          </div>
          <div style="font-size:.74rem;color:${sub}">File d'attente active sur ce créneau</div>
        </div>
      </div>`);

    const itemsHtml = items.length > 0
      ? `<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;text-align:left">${items.join('')}</div>`
      : `<div style="font-size:.875rem;color:${muted};margin-bottom:16px;line-height:1.6">
           Ce créneau est lié à des <strong style="color:${text}">réservations ou une file d'attente</strong> existantes.
         </div>`;

    box.innerHTML = `
      <div style="width:48px;height:48px;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.3);
           border-radius:14px;display:flex;align-items:center;justify-content:center;
           font-size:1.2rem;margin:0 auto 14px;color:#f59e0b">
        <i class="fas fa-exclamation-triangle"></i>
      </div>
      <div style="font-size:.98rem;font-weight:700;color:${text};margin-bottom:6px">Suppression impossible</div>
      <div style="background:${isDark ? 'rgba(255,255,255,.04)' : '#f8f8fc'};border:1px solid ${isDark ? 'rgba(255,255,255,.06)' : '#e2e2f0'};
           border-radius:10px;padding:10px 14px;margin-bottom:14px">
        <div style="font-size:.78rem;color:${muted};margin-bottom:2px">${svc?.nom ?? d.serviceNom}</div>
        <div style="font-size:.9rem;font-weight:700;color:${text}">
          ${this.JOUR_FULL[d.jour]} · ${this.fmt(d.heureDebut)} – ${this.fmt(d.heureFin)}
        </div>
      </div>
      <div style="font-size:.82rem;color:${muted};margin-bottom:14px">Ce créneau ne peut pas être supprimé :</div>
      ${itemsHtml}
      <div style="font-size:.74rem;color:${sub};background:${hintBg};border-radius:10px;
           padding:10px 12px;border:1px solid ${hintBd};margin-bottom:18px;text-align:left;line-height:1.6">
        <i class="fas fa-lightbulb" style="color:#6366f1;margin-right:5px"></i>
        Annulez ou supprimez d'abord les réservations et entrées en file d'attente associées.
      </div>
      <button id="linked-ok" style="background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:none;
        padding:10px 0;border-radius:10px;font-size:.85rem;font-weight:700;cursor:pointer;
        width:100%;font-family:inherit;box-shadow:0 2px 8px rgba(99,102,241,.35)">
        <i class="fas fa-check" style="margin-right:6px"></i>Compris
      </button>`;
    this.renderer.appendChild(overlay, box);
    this.renderer.appendChild(document.body, overlay);
    box.querySelector('#linked-ok')!.addEventListener('click', close);
    overlay.addEventListener('click', (e: Event) => { if (e.target === overlay) close(); });
  }
}