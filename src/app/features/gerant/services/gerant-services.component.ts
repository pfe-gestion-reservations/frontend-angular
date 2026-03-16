import { Component, OnInit, inject, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { ServiceResponse, ConfigServiceResponse, RessourceResponse, TypeService } from '../../../core/models/api.models';
import { forkJoin } from 'rxjs';

type ModalStep = 'type' | 'form';

@Component({
  selector: 'app-gerant-services',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: `./gerant-services.component.html`,
  styleUrls: [`./gerant-services.component.css`]
})
export class GerantServicesComponent implements OnInit {
  private api      = inject(ApiService);
  private toast    = inject(ToastService);
  private fb       = inject(FormBuilder);
  private renderer = inject(Renderer2);

  services:  ServiceResponse[]                   = [];
  configs:   Map<number, ConfigServiceResponse>  = new Map();
  ressources: RessourceResponse[]                = [];
  selectedService:  ServiceResponse | null       = null;
  editingService:   ServiceResponse | null       = null;

  // Detail modal
  showDetail       = false;
  detailService:   ServiceResponse | null        = null;
  detailRessources: RessourceResponse[]          = [];

  showArchived     = false;
  showModal        = false;
  showRessourcePanel = false;
  step: ModalStep  = 'type';
  selectedType: TypeService | null = null;
  loading          = false;
  loadingRessource = false;

  inlineRessources: { nom: string; description: string }[] = [];
  showInlineRessourceForm = false;

  get displayedServices(): ServiceResponse[] {
    return this.services;
  }

  form = this.fb.group({
    nom:                    ['', Validators.required],
    description:            [''],
    dureeMinutes:           [null as number | null],
    tarif:                  [null as number | null],
    tarifParPersonne:       [false],
    capaciteMinPersonnes:   [null as number | null],
    capaciteMaxPersonnes:   [null as number | null],
    annulationHeures:       [null as number | null],
    avanceReservationJours: [null as number | null]
  });

  ressourceForm = this.fb.group({
    nom: ['', Validators.required], description: ['']
  });

  inlineRessourceForm = this.fb.group({
    nom: ['', Validators.required], description: ['']
  });

  // ✅ FIX: RESSOURCE_PARTAGEE n'a PAS de file d'attente numérotée
  get autoFlags() {
    return {
      employeObligatoire:   this.selectedType === 'EMPLOYE_DEDIE' || this.selectedType === 'HYBRIDE',
      ressourceObligatoire: this.selectedType === 'RESSOURCE_PARTAGEE' || this.selectedType === 'HYBRIDE',
      reservationEnGroupe:  this.selectedType === 'RESSOURCE_PARTAGEE',
      fileAttenteActive:    this.selectedType !== 'RESSOURCE_PARTAGEE'
    };
  }

  get nomPlaceholder(): string {
    const p: Partial<Record<TypeService, string>> = {
      EMPLOYE_DEDIE: 'Ex: Coupe homme, Consultation médecin...', RESSOURCE_PARTAGEE: 'Ex: Location terrain padel...',
      FILE_ATTENTE_PURE: 'Ex: Consultation pharmacie...', HYBRIDE: 'Ex: Vidange, Révision générale...'
    };
    return this.selectedType ? (p[this.selectedType] ?? 'Nom du service') : 'Nom du service';
  }

  get dureePlaceholder(): string {
    const p: Partial<Record<TypeService, string>> = {
      EMPLOYE_DEDIE: '30 (coupe) / 90 (coloration)', RESSOURCE_PARTAGEE: '90 (padel) / 60 (tennis)', HYBRIDE: '60 (vidange)'
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

  ngOnInit(): void { this.load(); }

  load(): void {
    this.api.getServices().subscribe(services => {
      this.services = services;
      services.forEach(s => this.api.getConfigService(s.id).subscribe({ next: c => this.configs.set(s.id, c), error: () => {} }));
    });
  }

  // ── DETAIL ──────────────────────────────────────────────────────────────────
  openDetail(s: ServiceResponse): void {
    this.detailService = s;
    this.detailRessources = [];
    const c = this.configs.get(s.id);
    if (c?.ressourceObligatoire) {
      this.api.getRessourcesByService(s.id).subscribe(r => this.detailRessources = r);
    }
    this.showDetail = true;
  }

  closeDetail(): void { this.showDetail = false; this.detailService = null; this.detailRessources = []; }

  // ── CREATE / EDIT ────────────────────────────────────────────────────────────
  openCreate(): void {
    this.editingService = null; this.selectedType = null;
    this.form.reset(); this.inlineRessources = []; this.showInlineRessourceForm = false;
    this.inlineRessourceForm.reset(); this.step = 'type'; this.showModal = true;
  }

  selectType(t: TypeService): void {
    this.selectedType = t;
    const duree = this.form.get('dureeMinutes');
    const cMin  = this.form.get('capaciteMinPersonnes');
    const cMax  = this.form.get('capaciteMaxPersonnes');
    duree?.clearValidators(); cMin?.clearValidators(); cMax?.clearValidators();
    if (t !== 'FILE_ATTENTE_PURE') duree?.setValidators(Validators.required);
    if (t === 'RESSOURCE_PARTAGEE') { cMin?.setValidators(Validators.required); cMax?.setValidators(Validators.required); }
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

  addInlineRessource(): void {
    this.inlineRessourceForm.markAllAsTouched();
    if (this.inlineRessourceForm.invalid) return;
    const v = this.inlineRessourceForm.getRawValue();
    this.inlineRessources.push({ nom: v.nom!, description: v.description || '' });
    this.inlineRessourceForm.reset(); this.showInlineRessourceForm = false;
  }

  removeInlineRessource(index: number): void { this.inlineRessources.splice(index, 1); }
  cancelInlineRessource(): void { this.inlineRessourceForm.reset(); this.showInlineRessourceForm = false; }

  closeModal(): void {
    this.showModal = false; this.editingService = null; this.selectedType = null;
    this.form.reset(); this.inlineRessources = []; this.showInlineRessourceForm = false;
    this.inlineRessourceForm.reset();
  }

  save(): void {
    if (this.form.invalid || !this.selectedType) { this.form.markAllAsTouched(); return; }
    if (!this.editingService && this.selectedType === 'RESSOURCE_PARTAGEE' && this.inlineRessources.length === 0) {
      this.toast.error('Veuillez ajouter au moins une ressource.'); return;
    }
    this.loading = true;
    const v = this.form.getRawValue();
    const flags = this.autoFlags;
    const serviceBody: any = { nom: v.nom!, description: v.description || '', dureeMinutes: v.dureeMinutes ?? 0, tarif: v.tarif ?? null, typeService: this.selectedType };
    if (!this.editingService && this.selectedType === 'RESSOURCE_PARTAGEE') serviceBody.ressources = this.inlineRessources;
    const configBody = {
      typeService: this.selectedType, dureeMinutes: v.dureeMinutes,
      capaciteMinPersonnes: v.capaciteMinPersonnes, capaciteMaxPersonnes: v.capaciteMaxPersonnes,
      ...flags, annulationHeures: v.annulationHeures, avanceReservationJours: v.avanceReservationJours,
      tarifParPersonne: v.tarifParPersonne ?? false
    };

    if (!this.editingService && this.selectedType !== 'RESSOURCE_PARTAGEE') {
      const doublon = this.services.find(s =>
        s.nom.trim().toLowerCase() === (v.nom || '').trim().toLowerCase() &&
        s.dureeMinutes === (v.dureeMinutes ?? 0) && String(s.tarif ?? '') === String(v.tarif ?? '')
      );
      if (doublon) {
        this.loading = false; this.closeModal();
        this.openBodyDialog('duplicate');
        return;
      }
    }

    if (this.editingService) {
      this.api.updateService(this.editingService.id, serviceBody).subscribe({
        next: (s) => this.api.saveConfigService({ ...configBody, serviceId: s.id } as any).subscribe({
          next: () => { this.toast.success('Service modifié !'); this.load(); this.closeModal(); this.loading = false; },
          error: () => { this.toast.error('Config échouée'); this.loading = false; }
        }),
        error: () => { this.toast.error('Erreur'); this.loading = false; }
      });
    } else {
      this.api.createService(serviceBody).subscribe({
        next: (s) => {
          const finish = () => { this.toast.success('Service créé !'); this.load(); this.closeModal(); this.loading = false; };
          if (this.selectedType === 'RESSOURCE_PARTAGEE') { finish(); return; }
          this.api.saveConfigService({ ...configBody, serviceId: s.id } as any).subscribe({
            next: () => finish(),
            error: () => { this.toast.error('Config échouée'); this.loading = false; }
          });
        },
        error: (err) => {
          this.closeModal();
          if (err?.status === 409) { const m = err?.error?.message || null; this.openBodyDialog('duplicate', m || undefined); }
          else this.toast.error('Erreur lors de la création');
          this.loading = false;
        }
      });
    }
  }

  openBodyDialog(type: 'duplicate', customMsg?: string): void {
    const overlay = this.renderer.createElement('div');
    this.renderer.setStyle(overlay, 'position', 'fixed'); this.renderer.setStyle(overlay, 'inset', '0');
    this.renderer.setStyle(overlay, 'background', 'rgba(0,0,0,0.65)'); this.renderer.setStyle(overlay, 'z-index', '99999');
    this.renderer.setStyle(overlay, 'display', 'flex'); this.renderer.setStyle(overlay, 'align-items', 'center'); this.renderer.setStyle(overlay, 'justify-content', 'center');
    const box = this.renderer.createElement('div');
    this.renderer.setStyle(box, 'background', '#1e1e2e'); this.renderer.setStyle(box, 'border', '1px solid rgba(255,255,255,0.1)');
    this.renderer.setStyle(box, 'border-radius', '16px'); this.renderer.setStyle(box, 'padding', '36px 32px');
    this.renderer.setStyle(box, 'text-align', 'center'); this.renderer.setStyle(box, 'max-width', '380px'); this.renderer.setStyle(box, 'width', '90%');
    this.renderer.setStyle(box, 'box-shadow', '0 24px 64px rgba(0,0,0,0.6)'); this.renderer.setStyle(box, 'font-family', 'inherit');
    const close = () => this.renderer.removeChild(document.body, overlay);
    box.innerHTML = `<div style="font-size:2.5rem;margin-bottom:14px">⚠️</div><div style="font-size:1.1rem;font-weight:700;color:#fff;margin-bottom:8px">Service déjà existant</div><div style="font-size:.875rem;color:#aaa;margin-bottom:24px;line-height:1.6">${customMsg || 'Un service identique existe déjà.'}</div><button id="dup-ok" style="background:#6366f1;color:#fff;border:none;padding:10px 28px;border-radius:8px;font-size:.9rem;font-weight:600;cursor:pointer">OK</button>`;
    this.renderer.appendChild(overlay, box); this.renderer.appendChild(document.body, overlay);
    box.querySelector('#dup-ok')!.addEventListener('click', close);
    overlay.addEventListener('click', (e: Event) => { if (e.target === overlay) close(); });
  }



  confirmerSuppression(s: ServiceResponse): void {
    forkJoin({
      reservations: this.api.getReservations(),
      fileAttente:  this.api.getFileAttente(),
      ressources:   this.api.getRessourcesByService(s.id),
    }).subscribe({
      next: ({ reservations, fileAttente, ressources }) => {
        const resLiees  = reservations.filter(r => r.serviceId === s.id);
        const fileLiee  = fileAttente.filter(f => f.serviceId === s.id);
        const hasLinks  = resLiees.length > 0 || fileLiee.length > 0 || ressources.length > 0;
        if (hasLinks) {
          this._showLinkedServiceDialog(s, resLiees.length, fileLiee.length, ressources.length);
        } else {
          this._showDeleteServiceConfirm(s);
        }
      },
      error: () => this._showDeleteServiceConfirm(s)
    });
  }

  private _showDeleteServiceConfirm(s: ServiceResponse): void {
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
      <div style="font-size:2.2rem;margin-bottom:12px">🗑️</div>
      <div style="font-size:1.05rem;font-weight:700;color:#fff;margin-bottom:8px">Supprimer ce service ?</div>
      <div style="font-size:.85rem;color:#aaa;margin-bottom:6px;line-height:1.5"><strong style="color:#fff">${s.nom}</strong></div>
      <div style="font-size:.8rem;color:#f87171;margin-bottom:22px">Cette action est irréversible.</div>
      <div style="display:flex;gap:10px;justify-content:center">
        <button id="del-cancel" style="background:transparent;color:#aaa;border:1px solid rgba(255,255,255,0.15);padding:9px 20px;border-radius:8px;font-size:.875rem;cursor:pointer">Annuler</button>
        <button id="del-ok" style="background:#ef4444;color:#fff;border:none;padding:9px 22px;border-radius:8px;font-size:.875rem;font-weight:700;cursor:pointer">Supprimer</button>
      </div>`;
    this.renderer.appendChild(overlay, box); this.renderer.appendChild(document.body, overlay);
    box.querySelector('#del-cancel')!.addEventListener('click', close);
    box.querySelector('#del-ok')!.addEventListener('click', () => {
      close();
      this.api.deleteService(s.id).subscribe({
        next: () => { this.toast.success('Service supprimé'); this.load(); },
        error: (err) => {
          if (err.status === 409 || err.status === 400) { this._showLinkedServiceDialog(s, 0, 0, 0); return; }
          this.toast.error('Erreur lors de la suppression');
        }
      });
    });
    overlay.addEventListener('click', (e: Event) => { if (e.target === overlay) close(); });
  }

  private _showLinkedServiceDialog(s: ServiceResponse, nbRes: number, nbFile: number, nbRessources: number): void {
    const overlay = this.renderer.createElement('div');
    this.renderer.setStyle(overlay, 'position', 'fixed'); this.renderer.setStyle(overlay, 'inset', '0');
    this.renderer.setStyle(overlay, 'background', 'rgba(0,0,0,0.7)'); this.renderer.setStyle(overlay, 'z-index', '99999');
    this.renderer.setStyle(overlay, 'display', 'flex'); this.renderer.setStyle(overlay, 'align-items', 'center'); this.renderer.setStyle(overlay, 'justify-content', 'center');
    const box = this.renderer.createElement('div');
    this.renderer.setStyle(box, 'background', '#1e1e2e'); this.renderer.setStyle(box, 'border', '1px solid rgba(245,158,11,.4)');
    this.renderer.setStyle(box, 'border-radius', '18px'); this.renderer.setStyle(box, 'padding', '32px 28px 28px');
    this.renderer.setStyle(box, 'text-align', 'center'); this.renderer.setStyle(box, 'max-width', '440px'); this.renderer.setStyle(box, 'width', '92%');
    this.renderer.setStyle(box, 'box-shadow', '0 24px 64px rgba(0,0,0,0.7)'); this.renderer.setStyle(box, 'font-family', 'inherit');
    const close = () => this.renderer.removeChild(document.body, overlay);
    const items: string[] = [];
    if (nbRes > 0) items.push(`<div style="display:flex;align-items:center;gap:10px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:10px;padding:10px 14px;text-align:left"><span style="font-size:1.3rem">📅</span><div><div style="color:#fff;font-weight:600;font-size:.88rem">Réservations</div><div style="color:#f87171;font-size:.8rem">${nbRes} réservation${nbRes>1?'s':''} liée${nbRes>1?'s':''}</div></div></div>`);
    if (nbFile > 0) items.push(`<div style="display:flex;align-items:center;gap:10px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:10px;padding:10px 14px;text-align:left"><span style="font-size:1.3rem">🕐</span><div><div style="color:#fff;font-weight:600;font-size:.88rem">File d'attente</div><div style="color:#fbbf24;font-size:.8rem">${nbFile} entrée${nbFile>1?'s':''} en file d'attente</div></div></div>`);
    if (nbRessources > 0) items.push(`<div style="display:flex;align-items:center;gap:10px;background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.2);border-radius:10px;padding:10px 14px;text-align:left"><span style="font-size:1.3rem">🧩</span><div><div style="color:#fff;font-weight:600;font-size:.88rem">Ressources</div><div style="color:#818cf8;font-size:.8rem">${nbRessources} ressource${nbRessources>1?'s':''} associée${nbRessources>1?'s':''}</div></div></div>`);
    const itemsHtml = items.length > 0
      ? `<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:22px">${items.join('')}</div>`
      : `<div style="font-size:.88rem;color:#aaa;margin-bottom:22px">Ce service est lié à des <strong style="color:#fff">réservations, ressources ou configurations</strong> existantes.</div>`;
    box.innerHTML = `
      <div style="width:52px;height:52px;background:rgba(245,158,11,.12);border:2px solid rgba(245,158,11,.35);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.6rem;margin:0 auto 16px">⚠️</div>
      <div style="font-size:1.1rem;font-weight:700;color:#fff;margin-bottom:6px">Suppression impossible</div>
      <div style="font-size:.82rem;color:#94a3b8;margin-bottom:16px">Le service <strong style="color:#f1f5f9">${s.nom}</strong> est encore lié aux éléments suivants :</div>
      ${itemsHtml}
      <div style="font-size:.78rem;color:#64748b;margin-bottom:20px;background:rgba(255,255,255,.03);border-radius:8px;padding:10px;border:1px solid rgba(255,255,255,.06)">💡 Supprimez ou dissociez d'abord ces éléments, puis réessayez.</div>
      <button id="linked-ok" style="background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:none;padding:11px 36px;border-radius:10px;font-size:.9rem;font-weight:600;cursor:pointer;width:100%">Compris</button>`;
    this.renderer.appendChild(overlay, box); this.renderer.appendChild(document.body, overlay);
    box.querySelector('#linked-ok')!.addEventListener('click', close);
    overlay.addEventListener('click', (e: Event) => { if (e.target === overlay) close(); });
  }

  openRessourcePanel(s: ServiceResponse): void {
    this.selectedService = s; this.ressourceForm.reset();
    this.api.getRessourcesByService(s.id).subscribe(r => this.ressources = r); this.showRessourcePanel = true;
  }
  closeRessourcePanel(): void { this.showRessourcePanel = false; this.selectedService = null; this.ressources = []; }

  saveRessource(): void {
    if (this.ressourceForm.invalid || !this.selectedService) return;
    this.loadingRessource = true;
    const v = this.ressourceForm.getRawValue();
    this.api.createRessource({ nom: v.nom!, description: v.description || '', serviceId: this.selectedService.id }).subscribe({
      next: () => { this.toast.success('Ressource ajoutée !'); this.api.getRessourcesByService(this.selectedService!.id).subscribe(r => this.ressources = r); this.ressourceForm.reset(); this.loadingRessource = false; },
      error: () => { this.toast.error('Erreur'); this.loadingRessource = false; }
    });
  }
  archiverRessource(r: RessourceResponse): void { this.api.archiverRessource(r.id).subscribe({ next: () => this.api.getRessourcesByService(this.selectedService!.id).subscribe(res => this.ressources = res), error: () => this.toast.error('Erreur') }); }
  desarchiverRessource(r: RessourceResponse): void { this.api.desarchiverRessource(r.id).subscribe({ next: () => this.api.getRessourcesByService(this.selectedService!.id).subscribe(res => this.ressources = res), error: () => this.toast.error('Erreur') }); }
}