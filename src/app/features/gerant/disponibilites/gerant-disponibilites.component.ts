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
  selector: 'app-gerant-disponibilites',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './gerant-disponibilites.component.html',
  styleUrls: ['./gerant-disponibilites.component.css']
})
export class GerantDisponibilitesComponent implements OnInit {
  private api      = inject(ApiService);
  private toast    = inject(ToastService);
  private fb       = inject(FormBuilder);
  private renderer = inject(Renderer2);

  readonly JOURS     = JOURS;
  readonly JOUR_FULL = JOUR_FULL;
  readonly TYPE_LABEL = TYPE_LABEL;

  dispos:   DisponibiliteResponse[] = [];
  filtered: DisponibiliteResponse[] = [];
  services: ServiceResponse[]       = [];
  configs   = new Map<number, ConfigServiceResponse>();

  // Entreprise du gérant
  entrepriseId: number | null   = null;
  entreprise: EntrepriseResponse | null = null;

  // Filtre par service uniquement
  filterOpen   = false;
  filterSearch = '';
  selectedFilterService: ServiceResponse | null = null;
  filteredServicesList:  ServiceResponse[] = [];

  showModal = false;
  editing:  DisponibiliteResponse | null = null;
  editingHasActiveRes = false;
  loading   = false;
  formStep: FormStep = 'service';

  modalDropdownOpen = false;
  modalSearch       = '';
  modalSelectedService: ServiceResponse | null = null;
  filteredModalServices: ServiceResponse[] = [];
  detailRessources: RessourceResponse[] = [];

  selectedJour: JourSemaine | null = null;
  focusDebut = false;
  focusFin   = false;

  showDetail  = false;
  detailDispo: DisponibiliteResponse | null = null;
  detailDispoRessources: RessourceResponse[] = [];

  form = this.fb.group({
    serviceId:  ['', Validators.required],
    jour:       ['', Validators.required],
    heureDebut: ['', Validators.required],
    heureFin:   ['', Validators.required]
  });

  /* ── LIFECYCLE ── */

  ngOnInit(): void {
    document.addEventListener('click', () => {
      this.filterOpen = false;
    });
    // Récupérer l'entrepriseId du gérant connecté
    this.api.getMonProfil().subscribe(profil => {
      this.entrepriseId = profil.entrepriseId ?? null;
      if (this.entrepriseId) {
        this.api.getEntrepriseById(this.entrepriseId).subscribe(e => this.entreprise = e);
        this.loadServices();
      }
    });
  }

  /* ── HELPERS ── */

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

  /* ── CHARGEMENT ── */

  loadServices(): void {
    if (!this.entrepriseId) return;
    this.api.getServicesByEntreprise(this.entrepriseId).subscribe(services => {
      this.services = services;
      this.filteredServicesList  = [...services];
      this.filteredModalServices = [...services];
      services.forEach(s =>
        this.api.getConfigService(s.id).subscribe({ next: c => this.configs.set(s.id, c), error: () => {} })
      );
      this.loadAllDispos();
    });
  }

  loadAllDispos(): void {
    if (!this.services.length) { this.dispos = []; this.filtered = []; return; }
    const all: DisponibiliteResponse[] = [];
    let done = 0;
    this.services.forEach(s => {
      this.api.getDispoByService(s.id).subscribe(d => {
        all.push(...d);
        if (++done === this.services.length) { this.dispos = all; this.applyFilter(); }
      });
    });
  }

  /* ── FILTRE PAR SERVICE ── */

  filterServicesList(): void {
    const q = this.filterSearch.toLowerCase();
    this.filteredServicesList = this.services.filter(s => s.nom.toLowerCase().includes(q));
  }

  selectFilterService(s: ServiceResponse): void {
    this.selectedFilterService = s; this.filterOpen = false; this.applyFilter();
  }

  clearFilter(): void {
    this.selectedFilterService = null; this.filterSearch = '';
    this.filteredServicesList = [...this.services];
    this.filterOpen = false; this.applyFilter();
  }

  applyFilter(): void {
    this.filtered = this.selectedFilterService
      ? this.dispos.filter(d => d.serviceId === this.selectedFilterService!.id)
      : [...this.dispos];
  }

  /* ── DÉTAIL ── */

  openDetail(d: DisponibiliteResponse): void {
    this.detailDispo = d; this.detailDispoRessources = []; this.showDetail = true;
    document.body.classList.add('no-scroll');
    if (this.getConfig(d.serviceId)?.typeService === 'RESSOURCE_PARTAGEE') {
      this.api.getRessourcesByService(d.serviceId).subscribe({
        next: r => this.detailDispoRessources = r.filter(x => !x.archived), error: () => {}
      });
    }
  }

  closeDetail(): void {
    this.showDetail = false; this.detailDispo = null;
    this.detailDispoRessources = []; document.body.classList.remove('no-scroll');
  }

  /* ── MODAL ── */

  openModal(d?: DisponibiliteResponse): void {
    this.editing = d ?? null;
    this.editingHasActiveRes = false;
    this.formStep = 'service';
    this.selectedJour = null;
    this.clearModalSelect();
    this.filteredModalServices = [...this.services];
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
      this.formStep = 'horaire';

      const ACTIVE = new Set(['EN_ATTENTE', 'CONFIRMEE', 'EN_COURS']);
      const JS_JOUR: Record<number,string> = {0:'DIMANCHE',1:'LUNDI',2:'MARDI',3:'MERCREDI',4:'JEUDI',5:'VENDREDI',6:'SAMEDI'};
      const toMin = (hhmm: string) => { const [h,m] = hhmm.split(':').map(Number); return h*60+(m||0); };
      this.api.getReservations().subscribe({
        next: (reservations) => {
          const dispoDebutMin = toMin(d.heureDebut.substring(0, 5));
          const dispoFinMin   = toMin(d.heureFin.substring(0, 5));
          this.editingHasActiveRes = reservations.some(r => {
            if (r.serviceId !== d.serviceId || !ACTIVE.has(r.statut)) return false;
            const raw = r.heureDebut?.toString() ?? '';
            const tIdx = raw.indexOf('T');
            const timePart = tIdx !== -1 ? raw.substring(tIdx + 1, tIdx + 6) : raw.substring(0, 5);
            const jourResa  = JS_JOUR[new Date(raw).getDay()];
            if (jourResa !== d.jour) return false;
            const resaMin = toMin(timePart);
            return resaMin >= dispoDebutMin && resaMin < dispoFinMin;
          });
        }, error: () => {}
      });
    }
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false; this.editing = null;
    this.formStep = 'service'; this.selectedJour = null;
    this.clearModalSelect(); this.form.reset();
  }

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
    this.selectedJour = j; this.form.get('jour')?.setValue(j);
  }

  filterModalServices(): void {
    const q = this.modalSearch.toLowerCase();
    this.filteredModalServices = this.services.filter(s => s.nom.toLowerCase().includes(q));
  }

  selectModalService(s: ServiceResponse): void {
    this.modalSelectedService = s; this.modalSearch = s.nom;
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
    this.filteredModalServices = [...this.services];
    this.form.get('serviceId')?.setValue('');
    this.detailRessources = [];
  }

  /* ── VALIDATION ── */

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

  /* ── SAVE ── */

  save(): void {
    if (this.form.invalid) { this._showValidationPopup('Formulaire incomplet', 'Veuillez remplir tous les champs obligatoires.'); return; }
    if (!this.isCreneauValide) { this._showValidationPopup('Créneau trop court', `Ce créneau est inférieur à la durée minimale du service (${this.modalSelectedService?.dureeMinutes} min).`); return; }
    if (this.chevauchement) { this._showValidationPopup('Créneau en conflit', this.chevauchement); return; }
    if (this.editing && this.editingHasActiveRes) { this._showValidationPopup('Modification impossible', 'Ce créneau est lié à des réservations actives.'); return; }
    this.loading = true;
    const v = this.form.value;
    const body = { serviceId: Number(v.serviceId), jour: v.jour as JourSemaine, heureDebut: v.heureDebut!, heureFin: v.heureFin! };
    (this.editing ? this.api.updateDispo(this.editing.id, body) : this.api.createDispo(body)).subscribe({
      next: () => { this.toast.success(this.editing ? 'Créneau modifié !' : 'Créneau ajouté !'); this.loadAllDispos(); this.closeModal(); this.loading = false; },
      error: (err: any) => {
        const msg = err?.error?.message || (typeof err?.error === 'string' ? err?.error : '');
        const status = err?.status;
        if (status === 409 || msg?.toLowerCase().includes('chevauche')) {
          this._showValidationPopup('Créneau en conflit', msg || 'Ce créneau chevauche un créneau existant.');
        } else {
          this._showValidationPopup('Erreur', msg || 'Une erreur est survenue.');
        }
        this.loading = false;
      }
    });
  }

  /* ── SUPPRESSION ── */

  delete(d: DisponibiliteResponse): void {
    const ACTIVE_RES  = new Set(['EN_ATTENTE', 'CONFIRMEE', 'EN_COURS']);
    const ACTIVE_FILE = new Set(['EN_ATTENTE', 'APPELE', 'EN_COURS']);
    forkJoin({ reservations: this.api.getReservations(), fileAttente: this.api.getFileAttente() }).subscribe({
      next: ({ reservations, fileAttente }) => {
        const matchesSlot = (h: string | null) => h ? h.substring(0, 5) === d.heureDebut.substring(0, 5) : false;
        const nbRes  = reservations.filter(r => r.serviceId === d.serviceId && ACTIVE_RES.has(r.statut) && matchesSlot(r.heureDebut)).length;
        const nbFile = fileAttente.filter(f => f.serviceId === d.serviceId && ACTIVE_FILE.has(f.statut) && matchesSlot(f.heureDebut)).length;
        if (nbRes > 0 || nbFile > 0) this._showLinkedCreneauDialog(d, nbRes, nbFile);
        else this._showDeleteCreneauConfirm(d);
      },
      error: () => this._showValidationPopup('Erreur', 'Impossible de vérifier les liens.')
    });
  }

  /* ── POPUPS (identiques SA) ── */

  private _showValidationPopup(title: string, message: string): void {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const bg = isDark?'#16161f':'#ffffff'; const text = isDark?'#f2f2f8':'#0f0f1a'; const muted = isDark?'#a2a2b8':'#7070a0';
    const overlay = this.renderer.createElement('div');
    ['position','inset','background','zIndex','display','alignItems','justifyContent','backdropFilter']
      .forEach((k, i) => this.renderer.setStyle(overlay, k, ['fixed','0','rgba(0,0,0,0.6)','99999','flex','center','center','blur(4px)'][i]));
    const box = this.renderer.createElement('div');
    const styles: Record<string,string> = { background:bg, border:`1px solid ${isDark?'rgba(255,255,255,.1)':'#e2e2f0'}`, borderRadius:'20px', padding:'32px 28px', textAlign:'center', maxWidth:'380px', width:'90%', boxShadow:isDark?'0 24px 64px rgba(0,0,0,.6)':'0 16px 48px rgba(0,0,0,.15)', fontFamily:'inherit' };
    Object.entries(styles).forEach(([k,v]) => this.renderer.setStyle(box, k, v));
    const close = () => this.renderer.removeChild(document.body, overlay);
    box.innerHTML = `<div style="width:48px;height:48px;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.3);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:1.2rem;margin:0 auto 14px;color:#f59e0b"><i class="fas fa-exclamation-triangle"></i></div><div style="font-size:1rem;font-weight:700;color:${text};margin-bottom:8px">${title}</div><div style="font-size:.875rem;color:${muted};margin-bottom:22px;line-height:1.6">${message}</div><button id="vp-ok" style="background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:none;padding:10px 32px;border-radius:10px;font-size:.875rem;font-weight:700;cursor:pointer;font-family:inherit">Compris</button>`;
    this.renderer.appendChild(overlay, box); this.renderer.appendChild(document.body, overlay);
    box.querySelector('#vp-ok')!.addEventListener('click', close);
    overlay.addEventListener('click', (e: Event) => { if (e.target === overlay) close(); });
  }

  private _showDeleteCreneauConfirm(d: DisponibiliteResponse): void {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const svc = this.getService(d.serviceId);
    const bg = isDark?'#16161f':'#ffffff'; const text = isDark?'#f2f2f8':'#0f0f1a'; const muted = isDark?'#a2a2b8':'#7070a0';
    const cbg = isDark?'rgba(255,255,255,.06)':'#f4f4f8'; const cbd = isDark?'rgba(255,255,255,.12)':'#e2e2f0'; const cbl = isDark?'#a2a2b8':'#4a4a6a';
    const overlay = this.renderer.createElement('div');
    ['position','inset','background','zIndex','display','alignItems','justifyContent','backdropFilter']
      .forEach((k, i) => this.renderer.setStyle(overlay, k, ['fixed','0','rgba(0,0,0,0.6)','99999','flex','center','center','blur(4px)'][i]));
    const box = this.renderer.createElement('div');
    const styles: Record<string,string> = { background:bg, border:`1px solid ${isDark?'rgba(239,68,68,.25)':'#fecaca'}`, borderRadius:'20px', padding:'32px 28px', textAlign:'center', maxWidth:'400px', width:'90%', boxShadow:isDark?'0 24px 64px rgba(0,0,0,.6)':'0 16px 48px rgba(0,0,0,.15)', fontFamily:'inherit' };
    Object.entries(styles).forEach(([k,v]) => this.renderer.setStyle(box, k, v));
    const close = () => this.renderer.removeChild(document.body, overlay);
    box.innerHTML = `<div style="width:52px;height:52px;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;margin:0 auto 16px;color:#ef4444"><i class="fas fa-trash-alt"></i></div><div style="font-size:1rem;font-weight:700;color:${text};margin-bottom:10px">Supprimer ce créneau ?</div><div style="background:${isDark?'rgba(255,255,255,.04)':'#f8f8fc'};border:1px solid ${isDark?'rgba(255,255,255,.08)':'#e2e2f0'};border-radius:12px;padding:14px 16px;margin-bottom:16px"><div style="font-size:.78rem;color:${muted};margin-bottom:4px"><i class="fas fa-concierge-bell" style="margin-right:5px;color:#6366f1"></i>${svc?.nom ?? d.serviceNom}</div><div style="font-size:1rem;font-weight:700;color:${text}">${this.JOUR_FULL[d.jour]} · ${this.fmt(d.heureDebut)} – ${this.fmt(d.heureFin)}</div><div style="font-size:.78rem;color:${muted};margin-top:4px"><i class="fas fa-hourglass-half" style="margin-right:4px"></i>${this.calcDur(d.heureDebut, d.heureFin)}</div></div><div style="font-size:.75rem;color:#ef4444;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:8px;padding:8px 12px;margin-bottom:22px"><i class="fas fa-exclamation-triangle" style="margin-right:5px"></i>Cette action est irréversible.</div><div style="display:flex;gap:8px;justify-content:center"><button id="del-cancel" style="background:${cbg};color:${cbl};border:1px solid ${cbd};padding:9px 20px;border-radius:8px;font-size:.82rem;font-weight:600;cursor:pointer;font-family:inherit">Annuler</button><button id="del-ok" style="background:#ef4444;color:#fff;border:none;padding:9px 22px;border-radius:8px;font-size:.82rem;font-weight:700;cursor:pointer;font-family:inherit"><i class="fas fa-trash-alt" style="margin-right:5px"></i>Supprimer</button></div>`;
    this.renderer.appendChild(overlay, box); this.renderer.appendChild(document.body, overlay);
    box.querySelector('#del-cancel')!.addEventListener('click', close);
    box.querySelector('#del-ok')!.addEventListener('click', () => {
      close();
      this.api.deleteDispo(d.id).subscribe({
        next: () => { this.toast.success('Créneau supprimé'); this.loadAllDispos(); },
        error: () => this._showValidationPopup('Erreur', 'Vous ne pouvez pas supprimer ce créneau car il est lié à une ou plusieurs réservation(s).')
      });
    });
    overlay.addEventListener('click', (e: Event) => { if (e.target === overlay) close(); });
  }

  private _showLinkedCreneauDialog(d: DisponibiliteResponse, nbRes: number, nbFile: number): void {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const svc = this.getService(d.serviceId);
    const bg = isDark?'#16161f':'#ffffff'; const text = isDark?'#f2f2f8':'#0f0f1a'; const muted = isDark?'#a2a2b8':'#7070a0';
    const overlay = this.renderer.createElement('div');
    ['position','inset','background','zIndex','display','alignItems','justifyContent','backdropFilter']
      .forEach((k, i) => this.renderer.setStyle(overlay, k, ['fixed','0','rgba(0,0,0,0.6)','99999','flex','center','center','blur(4px)'][i]));
    const box = this.renderer.createElement('div');
    const styles: Record<string,string> = { background:bg, border:`1px solid ${isDark?'rgba(239,68,68,.3)':'#fecaca'}`, borderRadius:'20px', padding:'32px 28px', textAlign:'center', maxWidth:'420px', width:'92%', boxShadow:isDark?'0 24px 64px rgba(0,0,0,.6)':'0 16px 48px rgba(0,0,0,.15)', fontFamily:'inherit' };
    Object.entries(styles).forEach(([k,v]) => this.renderer.setStyle(box, k, v));
    const close = () => this.renderer.removeChild(document.body, overlay);
    const badgesHtml: string[] = [];
    if (nbRes > 0) badgesHtml.push(`<div style="display:flex;align-items:center;gap:14px;background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.2);border-radius:14px;padding:14px 16px;text-align:left"><div style="width:40px;height:40px;background:rgba(239,68,68,.12);border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#ef4444;font-size:1rem"><i class="fas fa-calendar-alt"></i></div><div><div style="font-size:1.25rem;font-weight:800;color:#ef4444;line-height:1">${nbRes}</div><div style="font-size:.78rem;color:${muted};margin-top:2px">réservation${nbRes>1?'s':''} active${nbRes>1?'s':''}</div></div></div>`);
    if (nbFile > 0) badgesHtml.push(`<div style="display:flex;align-items:center;gap:14px;background:rgba(245,158,11,.07);border:1px solid rgba(245,158,11,.2);border-radius:14px;padding:14px 16px;text-align:left"><div style="width:40px;height:40px;background:rgba(245,158,11,.12);border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#f59e0b;font-size:1rem"><i class="fas fa-list-ol"></i></div><div><div style="font-size:1.25rem;font-weight:800;color:#f59e0b;line-height:1">${nbFile}</div><div style="font-size:.78rem;color:${muted};margin-top:2px">entrée${nbFile>1?'s':''} en file d'attente</div></div></div>`);
    box.innerHTML = `<div style="width:52px;height:52px;background:rgba(239,68,68,.1);border:1.5px solid rgba(239,68,68,.3);border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;margin:0 auto 18px;color:#ef4444"><i class="fas fa-ban"></i></div><div style="font-size:1rem;font-weight:800;color:${text};margin-bottom:8px">Suppression impossible</div><div style="font-size:.83rem;color:${muted};margin-bottom:18px;line-height:1.6">Ce créneau est lié à des réservations actives.</div><div style="display:flex;flex-direction:column;gap:10px;margin-bottom:22px">${badgesHtml.join('')}</div><div style="font-size:.74rem;color:${muted};background:${isDark?'rgba(255,255,255,.04)':'#f4f4f8'};border:1px solid ${isDark?'rgba(255,255,255,.08)':'#e2e2f0'};border-radius:10px;padding:10px 14px;margin-bottom:20px;text-align:left;line-height:1.6"><i class="fas fa-info-circle" style="color:#6366f1;margin-right:5px"></i>Annulez d'abord les réservations concernées.</div><button id="lc-ok" style="background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:none;padding:11px 36px;border-radius:10px;font-size:.875rem;font-weight:700;cursor:pointer;font-family:inherit;width:100%">Compris</button>`;
    this.renderer.appendChild(overlay, box); this.renderer.appendChild(document.body, overlay);
    box.querySelector('#lc-ok')!.addEventListener('click', close);
    overlay.addEventListener('click', (e: Event) => { if (e.target === overlay) close(); });
  }
}