import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  DisponibiliteResponse, ServiceResponse, ConfigServiceResponse,
  JourSemaine, RessourceResponse, EntrepriseResponse
} from '../../../core/models/api.models';

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
  private fb    = inject(FormBuilder);

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
    if (!confirm('Supprimer ce créneau ?')) return;
    this.api.deleteDispo(d.id).subscribe({
      next: () => { this.toast.success('Supprimé'); this.loadAllDispos(); },
      error: () => this.toast.error('Erreur')
    });
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