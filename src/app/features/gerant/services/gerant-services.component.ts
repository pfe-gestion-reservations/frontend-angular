import { Component, OnInit, inject, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  ServiceResponse, ConfigServiceResponse, RessourceResponse,
  EntrepriseResponse, TypeService
} from '../../../core/models/api.models';
import { forkJoin, of } from 'rxjs';

type ModalStep = 'type' | 'form';

@Component({
  selector: 'app-gerant-services',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './gerant-services.component.html',
  styleUrls: ['./gerant-services.component.css']
})
export class GerantServicesComponent implements OnInit {
  private api      = inject(ApiService);
  private toast    = inject(ToastService);
  private fb       = inject(FormBuilder);
  private renderer = inject(Renderer2);

  services:    ServiceResponse[]                  = [];
  entreprise:  EntrepriseResponse | null          = null;
  configs:     Map<number, ConfigServiceResponse> = new Map();
  ressources:  RessourceResponse[]                = [];

  // L'entrepriseId du gérant — à adapter selon votre système d'auth
  entrepriseId: number | null = null;

  selectedService:  ServiceResponse | null = null;
  editingService:   ServiceResponse | null = null;

  searchQuery = '';
  showModal   = false;
  showRessourcePanel = false;
  step: ModalStep = 'type';
  selectedType: TypeService | null = null;
  loading          = false;
  loadingRessource = false;

  showDetail      = false;
  detailService:    ServiceResponse | null = null;
  detailRessources: RessourceResponse[]   = [];

  inlineRessources: { nom: string; description: string }[] = [];
  showInlineRessourceForm = false;

  form = this.fb.group({
    nom:                    ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    description:            ['', Validators.maxLength(300)],
    dureeMinutes:           [null as number | null],
    tarif:                  [null as number | null, Validators.min(0)],
    tarifParPersonne:       [false],
    capaciteMinPersonnes:   [null as number | null],
    capaciteMaxPersonnes:   [null as number | null],
    annulationHeures:       [null as number | null, Validators.min(0)],
    avanceReservationJours: [null as number | null, Validators.min(1)]
  });

  ressourceForm = this.fb.group({
    nom:         ['', [Validators.required, Validators.minLength(2)]],
    description: ['', Validators.maxLength(150)]
  });

  inlineRessourceForm = this.fb.group({
    nom:         ['', [Validators.required, Validators.minLength(2)]],
    description: ['', Validators.maxLength(150)]
  });

  /* ── COMPUTED ── */

  get filteredServices(): ServiceResponse[] {
    const q = this.searchQuery.toLowerCase();
    return this.services.filter(s =>
      !q || s.nom.toLowerCase().includes(q) || (s.description ?? '').toLowerCase().includes(q)
    );
  }

  get autoFlags() {
    return {
      employeObligatoire:   this.selectedType === 'EMPLOYE_DEDIE'      || this.selectedType === 'HYBRIDE',
      ressourceObligatoire: this.selectedType === 'RESSOURCE_PARTAGEE' || this.selectedType === 'HYBRIDE',
      reservationEnGroupe:  this.selectedType === 'RESSOURCE_PARTAGEE',
      fileAttenteActive:    true
    };
  }

  get nomPlaceholder(): string {
    const p: Partial<Record<TypeService, string>> = {
      EMPLOYE_DEDIE: 'Ex: Coupe homme, Consultation médecin...',
      RESSOURCE_PARTAGEE: 'Ex: Location terrain padel...',
      FILE_ATTENTE_PURE: 'Ex: Consultation pharmacie...',
      HYBRIDE: 'Ex: Vidange, Révision générale...'
    };
    return this.selectedType ? (p[this.selectedType] ?? 'Nom du service') : 'Nom du service';
  }

  get dureePlaceholder(): string {
    const p: Partial<Record<TypeService, string>> = {
      EMPLOYE_DEDIE: '30 (coupe) / 90 (coloration)',
      RESSOURCE_PARTAGEE: '90 (padel) / 60 (tennis)',
      HYBRIDE: '60 (vidange)'
    };
    return this.selectedType ? (p[this.selectedType] ?? '30') : '30';
  }

  typeLabel(t?: TypeService | null): string {
    const l: Partial<Record<TypeService, string>> = {
      EMPLOYE_DEDIE: 'Employé dédié', RESSOURCE_PARTAGEE: 'Ressource partagée',
      FILE_ATTENTE_PURE: "File d'attente", HYBRIDE: 'Hybride'
    };
    return t ? (l[t] ?? t) : '';
  }

  typeIcon(t?: TypeService | null): string {
    const i: Partial<Record<TypeService, string>> = {
      EMPLOYE_DEDIE: 'fas fa-user-tie', RESSOURCE_PARTAGEE: 'fas fa-layer-group',
      FILE_ATTENTE_PURE: 'fas fa-list-ol', HYBRIDE: 'fas fa-random'
    };
    return t ? (i[t] ?? 'fas fa-concierge-bell') : 'fas fa-concierge-bell';
  }

  getConfig(id: number): ConfigServiceResponse | undefined { return this.configs.get(id); }
  countByType(t: TypeService): number {
    return this.filteredServices.filter(s => this.configs.get(s.id)?.typeService === t).length;
  }

  /* ── LIFECYCLE ── */

  ngOnInit(): void {
    // Récupérer l'entrepriseId du gérant connecté
    // À adapter selon votre système d'auth (JWT, UserService, etc.)
    this.api.getMonProfil().subscribe(profil => {
      this.entrepriseId = profil.entrepriseId ?? null;
      if (this.entrepriseId) {
        this.api.getEntrepriseById(this.entrepriseId).subscribe(e => this.entreprise = e);
        this.loadServices();
      }
    });
  }

  loadServices(): void {
    if (!this.entrepriseId) return;
    this.api.getServicesByEntreprise(this.entrepriseId).subscribe(services => {
      this.services = services;
      services.forEach(s =>
        this.api.getConfigService(s.id).subscribe({ next: c => this.configs.set(s.id, c), error: () => {} })
      );
    });
  }

  private reloadAll(): void {
    if (!this.entrepriseId) return;
    this.api.getServicesByEntreprise(this.entrepriseId).subscribe(services => {
      this.services = services;
      services.forEach(s =>
        this.api.getConfigService(s.id).subscribe({ next: c => this.configs.set(s.id, c), error: () => {} })
      );
    });
  }

  /* ── DÉTAIL ── */

  openDetail(s: ServiceResponse): void {
    this.detailService = s; this.detailRessources = [];
    const c = this.configs.get(s.id);
    if (c?.ressourceObligatoire) this.api.getRessourcesByService(s.id).subscribe(r => this.detailRessources = r);
    this.showDetail = true;
  }

  closeDetail(): void { this.showDetail = false; this.detailService = null; this.detailRessources = []; }

  /* ── MODAL CRÉATION/ÉDITION ── */

  openCreate(): void {
    this.editingService = null; this.selectedType = null; this.form.reset();
    this.inlineRessources = []; this.showInlineRessourceForm = false; this.inlineRessourceForm.reset();
    this.step = 'type'; this.showModal = true;
  }

  selectType(t: TypeService): void {
    this.selectedType = t;
    const duree = this.form.get('dureeMinutes');
    const cMin  = this.form.get('capaciteMinPersonnes');
    const cMax  = this.form.get('capaciteMaxPersonnes');
    duree?.clearValidators(); cMin?.clearValidators(); cMax?.clearValidators();
    if (t !== 'FILE_ATTENTE_PURE') duree?.setValidators([Validators.required, Validators.min(1)]);
    if (t === 'RESSOURCE_PARTAGEE') {
      cMin?.setValidators([Validators.required, Validators.min(1)]);
      cMax?.setValidators([Validators.required, Validators.min(1)]);
    }
    duree?.updateValueAndValidity(); cMin?.updateValueAndValidity(); cMax?.updateValueAndValidity();
    this.step = 'form';
  }

  openEdit(s: ServiceResponse): void {
    this.editingService = s;
    const c = this.configs.get(s.id);
    this.selectedType = c?.typeService ?? null;
    if (this.selectedType) this.selectType(this.selectedType);
    this.form.patchValue({
      nom: s.nom, description: s.description ?? '', dureeMinutes: s.dureeMinutes, tarif: s.tarif,
      capaciteMinPersonnes: c?.capaciteMinPersonnes ?? null, capaciteMaxPersonnes: c?.capaciteMaxPersonnes ?? null,
      annulationHeures: c?.annulationHeures ?? null, avanceReservationJours: c?.avanceReservationJours ?? null,
      tarifParPersonne: c?.tarifParPersonne ?? false
    });
    this.step = 'form'; this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false; this.editingService = null; this.selectedType = null; this.form.reset();
    this.inlineRessources = []; this.showInlineRessourceForm = false; this.inlineRessourceForm.reset();
  }

  addInlineRessource(): void {
    this.inlineRessourceForm.markAllAsTouched();
    if (this.inlineRessourceForm.invalid) return;
    const v = this.inlineRessourceForm.getRawValue();
    this.inlineRessources.push({ nom: v.nom!, description: v.description || '' });
    this.inlineRessourceForm.reset(); this.showInlineRessourceForm = false;
  }

  removeInlineRessource(i: number): void { this.inlineRessources.splice(i, 1); }
  cancelInlineRessource(): void { this.inlineRessourceForm.reset(); this.showInlineRessourceForm = false; }

  save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.selectedType || !this.entrepriseId) return;
    const v = this.form.getRawValue();

    if (this.selectedType === 'RESSOURCE_PARTAGEE') {
      const cMin = v.capaciteMinPersonnes ?? 0;
      const cMax = v.capaciteMaxPersonnes ?? 0;
      if (cMin > cMax) {
        this._showValidationError({ icon: 'fas fa-users', iconColor: '#ef4444', title: 'Capacité invalide', message: 'Le minimum ne peut pas être supérieur au maximum.', hint: `min = <strong>${cMin}</strong>, max = <strong>${cMax}</strong>` });
        return;
      }
      if (!this.editingService && this.inlineRessources.length === 0) {
        this._showValidationError({ icon: 'fas fa-layer-group', iconColor: '#ef4444', title: 'Ressource manquante', message: 'Au moins une ressource est obligatoire pour un service de type <strong>Ressource partagée</strong>.', hint: 'Cliquez sur « Ajouter une ressource » pour en créer une.' });
        return;
      }
    }

    this.loading = true;
    const flags = this.autoFlags;
    const serviceBody: any = {
      nom: v.nom!, description: v.description || '',
      dureeMinutes: v.dureeMinutes ?? 0, tarif: v.tarif ?? null,
      entrepriseId: this.entrepriseId, typeService: this.selectedType
    };
    if (!this.editingService && this.selectedType === 'RESSOURCE_PARTAGEE') {
      serviceBody.ressources = this.inlineRessources;
    }
    const configBody = {
      typeService: this.selectedType, dureeMinutes: v.dureeMinutes,
      capaciteMinPersonnes: v.capaciteMinPersonnes, capaciteMaxPersonnes: v.capaciteMaxPersonnes,
      ...flags, annulationHeures: v.annulationHeures,
      avanceReservationJours: v.avanceReservationJours, tarifParPersonne: v.tarifParPersonne ?? false
    };

    if (this.editingService) {
      this.api.updateService(this.editingService.id, serviceBody).subscribe({
        next: (s) => {
          this.api.saveConfigService({ ...configBody, serviceId: s.id } as any).subscribe({
            next: () => { this.toast.success('Service modifié !'); this.reloadAll(); this.closeModal(); this.loading = false; },
            error: () => { this.toast.error('Erreur lors de la sauvegarde de la configuration'); this.loading = false; }
          });
        },
        error: (err) => { this.toast.error(err?.error?.message || 'Erreur'); this.loading = false; }
      });
    } else {
      this.api.createService(serviceBody).subscribe({
        next: (s) => {
          const finish = () => { this.toast.success('Service créé !'); this.reloadAll(); this.closeModal(); this.loading = false; };
          if (this.selectedType === 'RESSOURCE_PARTAGEE') { finish(); return; }
          this.api.saveConfigService({ ...configBody, serviceId: s.id } as any).subscribe({
            next: () => finish(),
            error: () => { this.toast.error('Erreur lors de la configuration'); this.loading = false; }
          });
        },
        error: (err) => {
          this.closeModal();
          if (err?.status === 409) {
            this._showValidationError({ icon: 'fas fa-copy', iconColor: '#f59e0b', title: 'Service déjà existant', message: err?.error?.message || 'Un service identique existe déjà.', hint: null });
          } else {
            this.toast.error('Erreur lors de la création');
          }
          this.loading = false;
        }
      });
    }
  }

  /* ── SUPPRESSION ── */

  confirmerSuppression(s: ServiceResponse): void {
    const config = this.configs.get(s.id);
    const isRP   = config?.typeService === 'RESSOURCE_PARTAGEE';
    forkJoin({
      reservations: this.api.getReservations(),
      fileAttente:  this.api.getFileAttente(),
      ressources:   isRP ? of([]) : this.api.getRessourcesByService(s.id),
    }).subscribe({
      next: ({ reservations, fileAttente, ressources }) => {
        const resLiees  = reservations.filter(r => r.serviceId === s.id);
        const fileLiees = fileAttente.filter(f => f.serviceId === s.id);
        const hasLinks  = resLiees.length > 0 || fileLiees.length > 0 || ressources.length > 0;
        if (hasLinks) this._openLinkedDialog(s, resLiees.length, fileLiees.length, ressources.length);
        else          this._showDeleteConfirm(s);
      },
      error: () => this._showDeleteConfirm(s)
    });
  }

  /* ── PANEL RESSOURCES ── */

  openRessourcePanel(s: ServiceResponse): void {
    this.selectedService = s; this.ressourceForm.reset();
    this.api.getRessourcesByService(s.id).subscribe(r => this.ressources = r);
    this.showRessourcePanel = true;
  }

  closeRessourcePanel(): void { this.showRessourcePanel = false; this.selectedService = null; this.ressources = []; }

  saveRessource(): void {
    this.ressourceForm.markAllAsTouched();
    if (this.ressourceForm.invalid || !this.selectedService) return;
    this.loadingRessource = true;
    const v = this.ressourceForm.getRawValue();
    this.api.createRessource({ nom: v.nom!, description: v.description || '', serviceId: this.selectedService.id }).subscribe({
      next: () => {
        this.toast.success('Ressource ajoutée !');
        this.api.getRessourcesByService(this.selectedService!.id).subscribe(r => this.ressources = r);
        this.ressourceForm.reset(); this.loadingRessource = false;
      },
      error: () => { this.toast.error('Erreur'); this.loadingRessource = false; }
    });
  }

  archiverRessource(r: RessourceResponse): void {
    this._confirmAction({
      icon: 'fas fa-archive', iconColor: '#d97706', title: 'Archiver cette ressource ?', subtitle: r.nom,
      message: 'La ressource ne sera plus disponible à la réservation.',
      confirmLabel: 'Archiver', confirmColor: '#d97706',
      onConfirm: () => this.api.archiverRessource(r.id).subscribe({
        next: () => this.api.getRessourcesByService(this.selectedService!.id).subscribe(res => this.ressources = res),
        error: () => this.toast.error('Erreur')
      })
    });
  }

  desarchiverRessource(r: RessourceResponse): void {
    this._confirmAction({
      icon: 'fas fa-undo', iconColor: '#16a34a', title: 'Réactiver cette ressource ?', subtitle: r.nom,
      message: 'La ressource sera de nouveau disponible à la réservation.',
      confirmLabel: 'Réactiver', confirmColor: '#16a34a',
      onConfirm: () => this.api.desarchiverRessource(r.id).subscribe({
        next: () => this.api.getRessourcesByService(this.selectedService!.id).subscribe(res => this.ressources = res),
        error: () => this.toast.error('Erreur')
      })
    });
  }

  /* ── DIALOGS (identiques SA) ── */

  private _showDeleteConfirm(s: ServiceResponse): void {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const config = this.configs.get(s.id);
    const isRP   = config?.typeService === 'RESSOURCE_PARTAGEE';
    const bg = isDark ? '#16161f' : '#ffffff';
    const text = isDark ? '#f2f2f8' : '#0f0f1a';
    const muted = isDark ? '#a2a2b8' : '#7070a0';
    const cancelBg = isDark ? 'rgba(255,255,255,.06)' : '#f4f4f8';
    const cancelBd = isDark ? 'rgba(255,255,255,.12)' : '#e2e2f0';
    const cancelCl = isDark ? '#a2a2b8' : '#4a4a6a';
    const overlay = this.renderer.createElement('div');
    ['position','inset','background','zIndex','display','alignItems','justifyContent','backdropFilter']
      .forEach((k, i) => this.renderer.setStyle(overlay, k, ['fixed','0','rgba(0,0,0,0.6)','99999','flex','center','center','blur(4px)'][i]));
    const box = this.renderer.createElement('div');
    const rpNote = isRP ? `<div style="display:flex;align-items:center;gap:10px;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.2);border-radius:10px;padding:10px 14px;margin-bottom:16px;text-align:left;font-size:.8rem;color:#34d399"><i class="fas fa-layer-group" style="flex-shrink:0"></i><span>Les ressources associées seront <strong>supprimées automatiquement</strong>.</span></div>` : '';
    const styles: Record<string,string> = { background:bg, border:`1px solid ${isDark?'rgba(239,68,68,.25)':'#fecaca'}`, borderRadius:'20px', padding:'32px 28px', textAlign:'center', maxWidth:'400px', width:'92%', boxShadow:isDark?'0 24px 64px rgba(0,0,0,.6)':'0 16px 48px rgba(0,0,0,.15)', fontFamily:'inherit' };
    Object.entries(styles).forEach(([k,v]) => this.renderer.setStyle(box, k, v));
    box.innerHTML = `<div style="width:52px;height:52px;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;margin:0 auto 16px;color:#ef4444"><i class="fas fa-trash-alt"></i></div><div style="font-size:1rem;font-weight:700;color:${text};margin-bottom:6px">Supprimer ce service ?</div><div style="font-size:.82rem;color:${muted};margin-bottom:14px"><strong style="color:${text}">${s.nom}</strong></div>${rpNote}<div style="font-size:.75rem;color:#ef4444;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:8px;padding:8px 12px;margin-bottom:22px"><i class="fas fa-exclamation-triangle" style="margin-right:5px"></i>Cette action est irréversible.</div><div style="display:flex;gap:8px;justify-content:center"><button id="del-cancel" style="background:${cancelBg};color:${cancelCl};border:1px solid ${cancelBd};padding:9px 20px;border-radius:8px;font-size:.82rem;font-weight:600;cursor:pointer;font-family:inherit">Annuler</button><button id="del-ok" style="background:#ef4444;color:#fff;border:none;padding:9px 22px;border-radius:8px;font-size:.82rem;font-weight:700;cursor:pointer;font-family:inherit"><i class="fas fa-trash-alt" style="margin-right:5px"></i>Supprimer</button></div>`;
    this.renderer.appendChild(overlay, box); this.renderer.appendChild(document.body, overlay);
    const close = () => this.renderer.removeChild(document.body, overlay);
    box.querySelector('#del-cancel')!.addEventListener('click', close);
    box.querySelector('#del-ok')!.addEventListener('click', () => {
      close();
      this.api.deleteService(s.id).subscribe({
        next: () => { this.toast.success('Service supprimé'); this.reloadAll(); },
        error: (err) => {
          if (err.status === 409 || err.status === 400) { this._openLinkedDialog(s, 0, 0, 0); return; }
          this.toast.error('Erreur lors de la suppression');
        }
      });
    });
    overlay.addEventListener('click', (e: Event) => { if (e.target === overlay) close(); });
  }

  private _openLinkedDialog(s: ServiceResponse, nbRes: number, nbFile: number, nbRessources: number): void {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const bg = isDark ? '#16161f' : '#ffffff'; const text = isDark ? '#f2f2f8' : '#0f0f1a';
    const muted = isDark ? '#a2a2b8' : '#7070a0'; const sub = isDark ? '#78788c' : '#9090b0';
    const hintBg = isDark ? 'rgba(255,255,255,.04)' : '#f4f4f8'; const hintBd = isDark ? 'rgba(255,255,255,.08)' : '#e2e2f0';
    const overlay = this.renderer.createElement('div');
    ['position','inset','background','zIndex','display','alignItems','justifyContent','backdropFilter']
      .forEach((k, i) => this.renderer.setStyle(overlay, k, ['fixed','0','rgba(0,0,0,0.6)','99999','flex','center','center','blur(4px)'][i]));
    const box = this.renderer.createElement('div');
    const styles: Record<string,string> = { background:bg, border:`1px solid ${isDark?'rgba(255,255,255,.1)':'#e2e2f0'}`, borderRadius:'20px', padding:'28px 24px', textAlign:'center', maxWidth:'450px', width:'92%', boxShadow:isDark?'0 24px 64px rgba(0,0,0,.6)':'0 16px 48px rgba(0,0,0,.15)', fontFamily:'inherit' };
    Object.entries(styles).forEach(([k,v]) => this.renderer.setStyle(box, k, v));
    const close = () => this.renderer.removeChild(document.body, overlay);
    const items: string[] = [];
    if (nbRes > 0) items.push(`<div style="display:flex;align-items:center;gap:12px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.18);border-radius:12px;padding:12px 14px;text-align:left"><div style="width:34px;height:34px;background:rgba(239,68,68,.1);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#ef4444"><i class="fas fa-calendar-alt"></i></div><div><div style="color:#ef4444;font-weight:700;font-size:.82rem;margin-bottom:2px">${nbRes} réservation${nbRes>1?'s':''}</div><div style="font-size:.74rem;color:${sub}">Réservations actives liées à ce service</div></div></div>`);
    if (nbFile > 0) items.push(`<div style="display:flex;align-items:center;gap:12px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.18);border-radius:12px;padding:12px 14px;text-align:left"><div style="width:34px;height:34px;background:rgba(245,158,11,.1);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#f59e0b"><i class="fas fa-list-ol"></i></div><div><div style="color:#f59e0b;font-weight:700;font-size:.82rem;margin-bottom:2px">${nbFile} entrée${nbFile>1?'s':''} en file d'attente</div><div style="font-size:.74rem;color:${sub}">File d'attente active pour ce service</div></div></div>`);
    if (nbRessources > 0) items.push(`<div style="display:flex;align-items:center;gap:12px;background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.18);border-radius:12px;padding:12px 14px;text-align:left"><div style="width:34px;height:34px;background:rgba(99,102,241,.1);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#818cf8"><i class="fas fa-layer-group"></i></div><div><div style="color:#818cf8;font-weight:700;font-size:.82rem;margin-bottom:2px">${nbRessources} ressource${nbRessources>1?'s':''}</div><div style="font-size:.74rem;color:${sub}">Ressources encore associées</div></div></div>`);
    const itemsHtml = items.length > 0 ? `<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;text-align:left">${items.join('')}</div>` : `<div style="font-size:.88rem;color:${muted};margin-bottom:16px">Ce service est lié à des <strong style="color:${text}">réservations ou configurations</strong> existantes.</div>`;
    box.innerHTML = `<div style="width:48px;height:48px;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.3);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:1.2rem;margin:0 auto 14px;color:#f59e0b"><i class="fas fa-exclamation-triangle"></i></div><div style="font-size:.98rem;font-weight:700;color:${text};margin-bottom:6px">Suppression impossible</div><div style="font-size:.8rem;color:${muted};margin-bottom:16px"><strong style="color:${text}">${s.nom}</strong> est encore lié aux éléments suivants :</div>${itemsHtml}<div style="font-size:.74rem;color:${sub};background:${hintBg};border-radius:10px;padding:10px 12px;border:1px solid ${hintBd};margin-bottom:18px;text-align:left"><i class="fas fa-lightbulb" style="color:#6366f1;margin-right:5px"></i>Supprimez ou dissociez ces éléments, puis réessayez.</div><button id="linked-ok" style="background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:none;padding:10px 0;border-radius:10px;font-size:.85rem;font-weight:700;cursor:pointer;width:100%;font-family:inherit"><i class="fas fa-check" style="margin-right:6px"></i>Compris</button>`;
    this.renderer.appendChild(overlay, box); this.renderer.appendChild(document.body, overlay);
    box.querySelector('#linked-ok')!.addEventListener('click', close);
    overlay.addEventListener('click', (e: Event) => { if (e.target === overlay) close(); });
  }

  private _confirmAction(opts: { icon:string; iconColor:string; title:string; subtitle?:string; message:string; confirmLabel:string; confirmColor:string; onConfirm:()=>void }): void {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const bg = isDark?'#16161f':'#ffffff'; const text = isDark?'#f2f2f8':'#0f0f1a'; const muted = isDark?'#a2a2b8':'#7070a0';
    const cancelBg = isDark?'rgba(255,255,255,.06)':'#f4f4f8'; const cancelBd = isDark?'rgba(255,255,255,.12)':'#e2e2f0'; const cancelCl = isDark?'#a2a2b8':'#4a4a6a';
    const overlay = this.renderer.createElement('div');
    ['position','inset','background','zIndex','display','alignItems','justifyContent','backdropFilter']
      .forEach((k, i) => this.renderer.setStyle(overlay, k, ['fixed','0','rgba(0,0,0,0.6)','99999','flex','center','center','blur(4px)'][i]));
    const box = this.renderer.createElement('div');
    const styles: Record<string,string> = { background:bg, border:`1px solid ${isDark?'rgba(255,255,255,.1)':'#e2e2f0'}`, borderRadius:'20px', padding:'32px 28px', textAlign:'center', maxWidth:'380px', width:'90%', boxShadow:isDark?'0 24px 64px rgba(0,0,0,.6)':'0 16px 48px rgba(0,0,0,.15)', fontFamily:'inherit' };
    Object.entries(styles).forEach(([k,v]) => this.renderer.setStyle(box, k, v));
    const close = () => this.renderer.removeChild(document.body, overlay);
    box.innerHTML = `<div style="width:48px;height:48px;background:${opts.iconColor}18;border:1px solid ${opts.iconColor}40;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:1.1rem;margin:0 auto 14px;color:${opts.iconColor}"><i class="${opts.icon}"></i></div><div style="font-size:1rem;font-weight:700;color:${text};margin-bottom:${opts.subtitle?'4px':'8px'}">${opts.title}</div>${opts.subtitle?`<div style="font-size:.85rem;color:#60a5fa;font-weight:600;margin-bottom:8px">${opts.subtitle}</div>`:''}<div style="font-size:.875rem;color:${muted};margin-bottom:22px;line-height:1.6">${opts.message}</div><div style="display:flex;gap:8px;justify-content:center"><button id="ca-cancel" style="background:${cancelBg};color:${cancelCl};border:1px solid ${cancelBd};padding:9px 20px;border-radius:8px;font-size:.82rem;font-weight:600;cursor:pointer;font-family:inherit">Annuler</button><button id="ca-ok" style="background:${opts.confirmColor};color:#fff;border:none;padding:9px 22px;border-radius:8px;font-size:.82rem;font-weight:700;cursor:pointer;font-family:inherit"><i class="${opts.icon}" style="margin-right:5px"></i>${opts.confirmLabel}</button></div>`;
    this.renderer.appendChild(overlay, box); this.renderer.appendChild(document.body, overlay);
    box.querySelector('#ca-cancel')!.addEventListener('click', close);
    box.querySelector('#ca-ok')!.addEventListener('click', () => { close(); opts.onConfirm(); });
    overlay.addEventListener('click', (e: Event) => { if (e.target === overlay) close(); });
  }

  private _showValidationError(opts: { icon:string; iconColor:string; title:string; message:string; hint:string|null }): void {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const bg = isDark?'#16161f':'#ffffff'; const text = isDark?'#f2f2f8':'#0f0f1a'; const muted = isDark?'#a2a2b8':'#7070a0';
    const hintBg = isDark?'rgba(255,255,255,.04)':'#f4f4f8'; const hintBd = isDark?'rgba(255,255,255,.08)':'#e2e2f0';
    const overlay = this.renderer.createElement('div');
    ['position','inset','background','zIndex','display','alignItems','justifyContent','backdropFilter']
      .forEach((k, i) => this.renderer.setStyle(overlay, k, ['fixed','0','rgba(0,0,0,0.6)','99999','flex','center','center','blur(4px)'][i]));
    const box = this.renderer.createElement('div');
    const styles: Record<string,string> = { background:bg, border:`1px solid ${isDark?'rgba(255,255,255,.1)':'#e2e2f0'}`, borderRadius:'20px', padding:'32px 28px', textAlign:'center', maxWidth:'400px', width:'92%', boxShadow:isDark?'0 24px 64px rgba(0,0,0,.6)':'0 16px 48px rgba(0,0,0,.15)', fontFamily:'inherit' };
    Object.entries(styles).forEach(([k,v]) => this.renderer.setStyle(box, k, v));
    const close = () => this.renderer.removeChild(document.body, overlay);
    const hintHtml = opts.hint ? `<div style="font-size:.74rem;color:${muted};background:${hintBg};border-radius:10px;padding:10px 12px;border:1px solid ${hintBd};margin-bottom:18px;text-align:left;line-height:1.6"><i class="fas fa-info-circle" style="color:#6366f1;margin-right:5px"></i>${opts.hint}</div>` : '';
    box.innerHTML = `<div style="width:52px;height:52px;background:${opts.iconColor}18;border:1px solid ${opts.iconColor}40;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;margin:0 auto 16px;color:${opts.iconColor}"><i class="${opts.icon}"></i></div><div style="font-size:1rem;font-weight:700;color:${text};margin-bottom:8px">${opts.title}</div><div style="font-size:.82rem;color:${muted};margin-bottom:${opts.hint?'14px':'22px'};line-height:1.6">${opts.message}</div>${hintHtml}<button id="val-ok" style="background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:none;padding:10px 0;border-radius:10px;font-size:.85rem;font-weight:700;cursor:pointer;width:100%;font-family:inherit;box-shadow:0 2px 8px rgba(99,102,241,.35)"><i class="fas fa-check" style="margin-right:6px"></i>Compris</button>`;
    this.renderer.appendChild(overlay, box); this.renderer.appendChild(document.body, overlay);
    box.querySelector('#val-ok')!.addEventListener('click', close);
    overlay.addEventListener('click', (ev: Event) => { if (ev.target === overlay) close(); });
  }
}