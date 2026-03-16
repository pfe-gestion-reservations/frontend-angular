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

@Component({
  selector: 'app-sa-disponibilites',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './sa-disponibilites.component.html',
  styleUrls: ['./sa-disponibilites.component.css']
})
export class SaDisponibilitesComponent implements OnInit {
  private api   = inject(ApiService);
  private toast = inject(ToastService);
  private fb       = inject(FormBuilder);
  private renderer = inject(Renderer2);

  readonly JOURS      = JOURS;
  readonly JOUR_FULL  = JOUR_FULL;
  readonly TYPE_LABEL = TYPE_LABEL;

  dispos:   DisponibiliteResponse[] = [];
  filtered: DisponibiliteResponse[] = [];
  services: ServiceResponse[]       = [];
  entreprises: EntrepriseResponse[] = [];
  configs   = new Map<number, ConfigServiceResponse>();

  // Filtre entreprise
  selectedEntrepriseId: number | null = null;
  entFilterOpen = false;
  entSearch = '';
  filteredEntreprisesList: EntrepriseResponse[] = [];
  entModalOpen = false;
  entModalSearch = '';
  filteredEntreprisesModal: EntrepriseResponse[] = [];

  showModal  = false;
  editing: DisponibiliteResponse | null = null;
  loading    = false;
  focusDebut = false;
  focusFin   = false;

  filterSearch = '';
  filterOpen   = false;
  selectedFilterService: ServiceResponse | null = null;
  filteredServicesList: ServiceResponse[] = [];

  modalSearch       = '';
  modalDropdownOpen = false;
  modalSelectedService: ServiceResponse | null = null;
  filteredModalServices: ServiceResponse[] = [];

  showDetail  = false;
  detailDispo: DisponibiliteResponse | null = null;
  detailRessources: RessourceResponse[] = [];

  form = this.fb.group({
    serviceId:  ['', Validators.required],
    jour:       ['', Validators.required],
    heureDebut: ['', Validators.required],
    heureFin:   ['', Validators.required]
  });

  ngOnInit(): void {
    document.addEventListener('click', () => {
      this.filterOpen = false;
      this.entFilterOpen = false;
      this.entModalOpen = false;
    });
    this.api.getEntreprises().subscribe((e: EntrepriseResponse[]) => {
      this.entreprises = e;
      this.filteredEntreprisesList = [...e];
      this.filteredEntreprisesModal = [...e];
    });
    this.loadServices();
  }

  // ── Dropdown entreprise ──
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

  loadServices(): void {
    this.api.getServices().subscribe((s: ServiceResponse[]) => {
      this.services = s;
      this.services.forEach(svc => {
        this.api.getConfigService(svc.id).subscribe({ next: (c: ConfigServiceResponse) => this.configs.set(svc.id, c), error: () => {} });
      });
      this.applyEntrepriseFilter();
      this.loadAllDispos();
    });
  }

  get servicesFiltresEntreprise(): ServiceResponse[] {
    if (!this.selectedEntrepriseId) return this.services;
    return this.services.filter(s => s.entrepriseId === this.selectedEntrepriseId);
  }

  getEntNom(id?: number | null): string {
    return this.entreprises.find(e => e.id === id)?.nom || '';
  }

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

  onEntrepriseChange(): void { this.applyEntrepriseFilter(); this.loadAllDispos(); }

  getConfig(sid?: number) { return sid ? this.configs.get(sid) : undefined; }
  getService(sid: number) { return this.services.find(s => s.id === sid); }
  typeColor(t?: string)   { return t ? (TYPE_COLOR[t] || 'var(--accent)') : 'var(--accent)'; }
  typeIconCls(t?: string) { return t ? (TYPE_ICON[t]  || 'fas fa-concierge-bell') : 'fas fa-concierge-bell'; }
  fmt(t: string)          { return t ? t.substring(0,5) : ''; }

  calcDur(a: string, b: string): string {
    if (!a || !b) return '';
    const [ah,am] = a.split(':').map(Number);
    const [bh,bm] = b.split(':').map(Number);
    const mins = (bh*60+bm) - (ah*60+am);
    if (mins <= 0) return '';
    const h = Math.floor(mins/60), m = mins%60;
    return h > 0 ? `${h}h${m > 0 ? String(m).padStart(2,'0') : ''}` : `${m} min`;
  }

  modalDur(): string {
    const d = this.form.get('heureDebut')?.value, f = this.form.get('heureFin')?.value;
    if (!d || !f) return '';
    const dur = this.calcDur(d, f);
    if (!dur) return '⚠ Heure de fin doit être après le début';
    if (this.modalSelectedService) {
      const [ah,am] = d.split(':').map(Number);
      const [bh,bm] = f.split(':').map(Number);
      const mins = (bh*60+bm) - (ah*60+am);
      if (mins < this.modalSelectedService.dureeMinutes)
        return `⚠ Créneau trop court ! Minimum ${this.modalSelectedService.dureeMinutes} min pour ce service`;
    }
    return dur;
  }

  isCreneauValide(): boolean {
    const d = this.form.get('heureDebut')?.value, f = this.form.get('heureFin')?.value;
    if (!d || !f || !this.modalSelectedService) return true;
    const [ah,am] = d.split(':').map(Number);
    const [bh,bm] = f.split(':').map(Number);
    return (bh*60+bm) - (ah*60+am) >= this.modalSelectedService.dureeMinutes;
  }

  loadAllDispos(): void {
    const svcs = this.selectedEntrepriseId ? this.servicesFiltresEntreprise : this.services;
    if (!svcs.length) { this.dispos = []; this.filtered = []; return; }
    const all: DisponibiliteResponse[] = [];
    let done = 0;
    svcs.forEach((s: ServiceResponse) => {
      this.api.getDispoByService(s.id).subscribe((d: DisponibiliteResponse[]) => {
        all.push(...d);
        if (++done === svcs.length) { this.dispos = all; this.applyFilter(); }
      });
    });
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

  filterModalServices(): void {
    const q = this.modalSearch.toLowerCase();
    this.filteredModalServices = this.servicesFiltresEntreprise.filter(s => s.nom.toLowerCase().includes(q));
  }

  selectModalService(s: ServiceResponse): void {
    this.modalSelectedService = s; this.modalSearch = s.nom;
    this.modalDropdownOpen = false; this.form.get('serviceId')?.setValue(String(s.id));
    this.detailRessources = [];
    if (this.getConfig(s.id)?.typeService === 'RESSOURCE_PARTAGEE') {
      this.api.getRessourcesByService(s.id).subscribe({
        next: (r: RessourceResponse[]) => this.detailRessources = r.filter(x => !x.archived),
        error: () => {}
      });
    }
  }

  clearModalSelect(): void {
    this.modalSelectedService = null; this.modalSearch = '';
    this.filteredModalServices = this.servicesFiltresEntreprise;
    this.form.get('serviceId')?.setValue('');
    this.detailRessources = [];
  }

  openDetail(d: DisponibiliteResponse): void {
    this.detailDispo = d; this.detailRessources = []; this.showDetail = true;
    if (this.getConfig(d.serviceId)?.typeService === 'RESSOURCE_PARTAGEE') {
      this.api.getRessourcesByService(d.serviceId).subscribe({
        next: (r: RessourceResponse[]) => this.detailRessources = r.filter(x => !x.archived),
        error: () => {}
      });
    }
  }
  closeDetail(): void { this.showDetail = false; this.detailDispo = null; this.detailRessources = []; }

  openModal(d?: DisponibiliteResponse): void {
    this.editing = d ?? null;
    this.modalSearch = ''; this.modalSelectedService = null;
    this.modalDropdownOpen = false; this.detailRessources = [];
    this.filteredModalServices = this.servicesFiltresEntreprise;
    if (d) {
      const svc = this.services.find(s => s.id === d.serviceId);
      if (svc) {
        this.modalSelectedService = svc; this.modalSearch = svc.nom;
        if (this.getConfig(svc.id)?.typeService === 'RESSOURCE_PARTAGEE') {
          this.api.getRessourcesByService(svc.id).subscribe({
            next: (r: RessourceResponse[]) => this.detailRessources = r.filter(x => !x.archived),
            error: () => {}
          });
        }
      }
      this.form.setValue({ serviceId: String(d.serviceId), jour: d.jour, heureDebut: d.heureDebut, heureFin: d.heureFin });
    } else {
      this.form.reset();
    }
    this.showModal = true;
  }

  closeModal(): void { this.showModal = false; this.editing = null; this.clearModalSelect(); this.form.reset(); }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); this.toast.error('Remplissez tous les champs'); return; }
    if (!this.isCreneauValide()) {
      this.toast.error(`Créneau trop court ! Minimum ${this.modalSelectedService?.dureeMinutes} min pour ce service`);
      return;
    }
    this.loading = true;
    const v = this.form.value;
    const body = { serviceId: Number(v.serviceId), jour: v.jour as JourSemaine, heureDebut: v.heureDebut!, heureFin: v.heureFin! };
    (this.editing ? this.api.updateDispo(this.editing.id, body) : this.api.createDispo(body)).subscribe({
      next: () => { this.toast.success(this.editing ? 'Créneau modifié !' : 'Créneau ajouté !'); this.loadAllDispos(); this.closeModal(); this.loading = false; },
      error: () => { this.toast.error('Erreur'); this.loading = false; }
    });
  }

  delete(d: DisponibiliteResponse): void {
    // Vérifie les liaisons avant d'afficher la confirmation
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const dMin = toMin(d.heureDebut), fMin = toMin(d.heureFin);

    forkJoin({
      reservations: this.api.getReservations(),
      fileAttente:  this.api.getFileAttente(),
    }).subscribe({
      next: ({ reservations, fileAttente }) => {
        // Réservations sur ce service dont l'heure tombe dans le créneau
        const resLiees = reservations.filter(r =>
          r.serviceId === d.serviceId &&
          toMin(r.heureDebut) >= dMin && toMin(r.heureDebut) < fMin
        );
        // Entrées file d'attente sur ce service avec heureDebut dans le créneau
        const fileLiee = fileAttente.filter(f =>
          f.serviceId === d.serviceId &&
          f.heureDebut != null &&
          toMin(f.heureDebut) >= dMin && toMin(f.heureDebut) < fMin
        );

        if (resLiees.length > 0 || fileLiee.length > 0) {
          this._showLinkedCreneauDialog(d, resLiees.length, fileLiee.length);
        } else {
          this._showDeleteCreneauConfirm(d);
        }
      },
      error: () => this._showDeleteCreneauConfirm(d)
    });
  }

  private _showDeleteCreneauConfirm(d: DisponibiliteResponse): void {
    const svc = this.getService(d.serviceId);
    const overlay = this.renderer.createElement('div');
    this.renderer.setStyle(overlay, 'position', 'fixed');
    this.renderer.setStyle(overlay, 'inset', '0');
    this.renderer.setStyle(overlay, 'background', 'rgba(0,0,0,0.65)');
    this.renderer.setStyle(overlay, 'z-index', '99999');
    this.renderer.setStyle(overlay, 'display', 'flex');
    this.renderer.setStyle(overlay, 'align-items', 'center');
    this.renderer.setStyle(overlay, 'justify-content', 'center');

    const box = this.renderer.createElement('div');
    this.renderer.setStyle(box, 'background', '#1e1e2e');
    this.renderer.setStyle(box, 'border', '1px solid rgba(239,68,68,.3)');
    this.renderer.setStyle(box, 'border-radius', '16px');
    this.renderer.setStyle(box, 'padding', '32px 28px');
    this.renderer.setStyle(box, 'text-align', 'center');
    this.renderer.setStyle(box, 'max-width', '380px');
    this.renderer.setStyle(box, 'width', '90%');
    this.renderer.setStyle(box, 'box-shadow', '0 24px 64px rgba(0,0,0,0.6)');
    this.renderer.setStyle(box, 'font-family', 'inherit');

    const close = () => this.renderer.removeChild(document.body, overlay);

    box.innerHTML = `
      <div style="font-size:2.2rem;margin-bottom:12px">🗑️</div>
      <div style="font-size:1.05rem;font-weight:700;color:#fff;margin-bottom:8px">
        Supprimer ce créneau ?
      </div>
      <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);
           border-radius:10px;padding:12px 16px;margin-bottom:18px">
        <div style="font-size:.85rem;color:#94a3b8;margin-bottom:4px">${svc?.nom ?? d.serviceNom}</div>
        <div style="font-size:1rem;font-weight:700;color:#fff">
          ${this.JOUR_FULL[d.jour]} &nbsp;·&nbsp; ${this.fmt(d.heureDebut)} – ${this.fmt(d.heureFin)}
        </div>
      </div>
      <div style="font-size:.8rem;color:#f87171;margin-bottom:22px">
        Cette action est irréversible.
      </div>
      <div style="display:flex;gap:10px;justify-content:center">
        <button id="del-cancel"
          style="background:transparent;color:#aaa;border:1px solid rgba(255,255,255,0.15);
          padding:9px 20px;border-radius:8px;font-size:.875rem;cursor:pointer">
          Annuler
        </button>
        <button id="del-ok"
          style="background:#ef4444;color:#fff;border:none;
          padding:9px 22px;border-radius:8px;font-size:.875rem;font-weight:700;cursor:pointer">
          Supprimer
        </button>
      </div>
    `;

    this.renderer.appendChild(overlay, box);
    this.renderer.appendChild(document.body, overlay);

    box.querySelector('#del-cancel')!.addEventListener('click', close);
    box.querySelector('#del-ok')!.addEventListener('click', () => {
      close();
      this.api.deleteDispo(d.id).subscribe({
        next: () => { this.toast.success('Créneau supprimé'); this.loadAllDispos(); },
        error: (err) => {
          if (err.status === 409 || err.status === 400) {
            this._showLinkedCreneauDialog(d, 0, 0);
            return;
          }
          this.toast.error('Erreur lors de la suppression');
        }
      });
    });
    overlay.addEventListener('click', (e: Event) => { if (e.target === overlay) close(); });
  }

  private _showLinkedCreneauDialog(d: DisponibiliteResponse, nbReservations: number, nbFileAttente: number): void {
    const svc = this.getService(d.serviceId);
    const overlay = this.renderer.createElement('div');
    this.renderer.setStyle(overlay, 'position', 'fixed');
    this.renderer.setStyle(overlay, 'inset', '0');
    this.renderer.setStyle(overlay, 'background', 'rgba(0,0,0,0.7)');
    this.renderer.setStyle(overlay, 'z-index', '99999');
    this.renderer.setStyle(overlay, 'display', 'flex');
    this.renderer.setStyle(overlay, 'align-items', 'center');
    this.renderer.setStyle(overlay, 'justify-content', 'center');

    const box = this.renderer.createElement('div');
    this.renderer.setStyle(box, 'background', '#1e1e2e');
    this.renderer.setStyle(box, 'border', '1px solid rgba(245,158,11,.4)');
    this.renderer.setStyle(box, 'border-radius', '18px');
    this.renderer.setStyle(box, 'padding', '32px 28px 28px');
    this.renderer.setStyle(box, 'text-align', 'center');
    this.renderer.setStyle(box, 'max-width', '440px');
    this.renderer.setStyle(box, 'width', '92%');
    this.renderer.setStyle(box, 'box-shadow', '0 24px 64px rgba(0,0,0,0.7)');
    this.renderer.setStyle(box, 'font-family', 'inherit');

    const close = () => this.renderer.removeChild(document.body, overlay);

    const items: string[] = [];
    if (nbReservations > 0) items.push(`
      <div style="display:flex;align-items:center;gap:10px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);
           border-radius:10px;padding:10px 14px;text-align:left">
        <span style="font-size:1.3rem">📅</span>
        <div>
          <div style="color:#fff;font-weight:600;font-size:.88rem">Réservations</div>
          <div style="color:#f87171;font-size:.8rem">${nbReservations} réservation${nbReservations > 1 ? 's' : ''} sur ce créneau</div>
        </div>
      </div>`);
    if (nbFileAttente > 0) items.push(`
      <div style="display:flex;align-items:center;gap:10px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);
           border-radius:10px;padding:10px 14px;text-align:left">
        <span style="font-size:1.3rem">🕐</span>
        <div>
          <div style="color:#fff;font-weight:600;font-size:.88rem">File d'attente</div>
          <div style="color:#fbbf24;font-size:.8rem">${nbFileAttente} entrée${nbFileAttente > 1 ? 's' : ''} en attente sur ce créneau</div>
        </div>
      </div>`);

    const itemsHtml = items.length > 0
      ? `<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:22px">${items.join('')}</div>`
      : `<div style="font-size:.88rem;color:#aaa;margin-bottom:22px;line-height:1.6">
           Ce créneau est lié à des <strong style="color:#fff">réservations ou une file d'attente</strong> existantes.
         </div>`;

    box.innerHTML = `
      <div style="width:52px;height:52px;background:rgba(245,158,11,.12);border:2px solid rgba(245,158,11,.35);
           border-radius:50%;display:flex;align-items:center;justify-content:center;
           font-size:1.6rem;margin:0 auto 16px">⚠️</div>

      <div style="font-size:1.1rem;font-weight:700;color:#fff;margin-bottom:6px">
        Suppression impossible
      </div>

      <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);
           border-radius:10px;padding:10px 14px;margin-bottom:14px">
        <div style="font-size:.8rem;color:#94a3b8;margin-bottom:2px">${svc?.nom ?? d.serviceNom}</div>
        <div style="font-size:.95rem;font-weight:700;color:#f1f5f9">
          ${this.JOUR_FULL[d.jour]} &nbsp;·&nbsp; ${this.fmt(d.heureDebut)} – ${this.fmt(d.heureFin)}
        </div>
      </div>

      <div style="font-size:.82rem;color:#94a3b8;margin-bottom:16px;line-height:1.5">
        Ce créneau ne peut pas être supprimé car il est encore lié aux éléments suivants :
      </div>

      ${itemsHtml}

      <div style="font-size:.78rem;color:#64748b;margin-bottom:20px;line-height:1.5;background:rgba(255,255,255,.03);
           border-radius:8px;padding:10px;border:1px solid rgba(255,255,255,.06)">
        💡 Annulez ou supprimez d'abord les réservations et entrées en file d'attente associées.
      </div>

      <button id="linked-ok"
        style="background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:none;
        padding:11px 36px;border-radius:10px;font-size:.9rem;font-weight:600;cursor:pointer;
        width:100%;transition:opacity .2s"
        onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
        Compris
      </button>
    `;

    this.renderer.appendChild(overlay, box);
    this.renderer.appendChild(document.body, overlay);

    box.querySelector('#linked-ok')!.addEventListener('click', close);
    overlay.addEventListener('click', (e: Event) => { if (e.target === overlay) close(); });
  }

  // Vérifie chevauchement avec les créneaux existants du même service/jour
  getChevauchement(): string | null {
    const sid  = this.form.get('serviceId')?.value;
    const jour = this.form.get('jour')?.value;
    const debut = this.form.get('heureDebut')?.value;
    const fin   = this.form.get('heureFin')?.value;
    if (!sid || !jour || !debut || !fin) return null;

    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const dMin = toMin(debut), fMin = toMin(fin);
    if (fMin <= dMin) return null;

    const doublon = this.dispos.find(d => {
      if (d.serviceId !== Number(sid)) return false;
      if (d.jour !== jour) return false;
      if (this.editing && d.id === this.editing.id) return false;
      return dMin < toMin(d.heureFin) && fMin > toMin(d.heureDebut);
    });

    return doublon
      ? `Chevauchement avec le créneau ${this.fmt(doublon.heureDebut)}–${this.fmt(doublon.heureFin)}`
      : null;
  }
}