import { Component, OnInit, inject, HostListener, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  EntrepriseResponse, SecteurResponse, GerantResponse,
  EmployeResponse, RattachementRequest
} from '../../../core/models/api.models';

function phoneValidator(control: AbstractControl): ValidationErrors | null {
  const v = control.value || '';
  return /^[0-9+\s\-()]{0,20}$/.test(v) ? null : { invalidPhone: true };
}

const AV_COLORS = [
  '#2563eb','#16a34a','#d97706','#dc2626','#7c3aed',
  '#0284c7','#059669','#ea580c','#9333ea','#0891b2'
];

@Component({
  selector: 'app-entreprises',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './entreprises.component.html',
  styleUrls: ['./entreprises.component.css']
})
export class EntreprisesComponent implements OnInit {
  private api   = inject(ApiService);
  private toast = inject(ToastService);

  
  private fb    = inject(FormBuilder);

  entreprises:      EntrepriseResponse[] = [];
  filtered:         EntrepriseResponse[] = [];
  secteurs:         SecteurResponse[]    = [];
  gerants:          GerantResponse[]     = [];
  filteredSecteurs: SecteurResponse[]    = [];
  filteredGerants:  GerantResponse[]     = [];

  showModal = false;
  editing: EntrepriseResponse | null = null;
  loading = false;
  searchQuery = '';
  modalStep = 1;

  secteurSearch = '';
  selectedSecteur: SecteurResponse | null = null;
  gerantSearch = '';
  selectedGerant: GerantResponse | null = null;
  showSecteurDropdown = false;
  showGerantDropdown  = false;

  @ViewChild('secteurTrigger') secteurTrigger!: ElementRef;
  @ViewChild('gerantTrigger')  gerantTrigger!:  ElementRef;

  // Détail
  showDetail        = false;
  detailEntreprise: EntrepriseResponse | null = null;
  detailEmployes:   EmployeResponse[] = [];
  loadingEmployes   = false;

  // Ajout employé
  showAddEmploye = false;
  addStep: 'email' | 'nouveau' | 'libre' | 'occupe' | 'archived' | 'other-role' = 'email';
  checkEmailVal  = '';
  checkLoading   = false;
  checkResult: any = null;
  specialiteRattach = '';
  addLoading = false;
  addEmailError = '';


  addForm = this.fb.group({
    nom:        ['', Validators.required],
    prenom:     ['', Validators.required],
    email:      ['', [Validators.required, Validators.email]],
    password:   ['', [Validators.required, Validators.minLength(6)]],
    specialite: ['']
  });

  form = this.fb.group({
    nom:       ['', Validators.required],
    adresse:   ['', Validators.required],
    telephone: ['', [Validators.required, phoneValidator, Validators.pattern('^[0-9]{8,}$')]],
    secteurId: ['', Validators.required],
    gerantId:  ['', Validators.required]
  });

  // ── Computed ──────────────────────────────────────────────────────────────
  get totalEmployes() {
    return this.entreprises.reduce((acc, e) => acc + (e.nombreEmployes ?? 0), 0);
  }
  get totalSecteurs() {
    return new Set(this.entreprises.map(e => e.secteurId)).size;
  }

  // ── Helpers avatar ────────────────────────────────────────────────────────
  entInitials(e: EntrepriseResponse): string {
    return e.nom?.substring(0, 2).toUpperCase() ?? '??';
  }
  entColor(e: EntrepriseResponse): string {
    return AV_COLORS[(e.id || 0) % AV_COLORS.length];
  }
  gerantColor(e: EntrepriseResponse): string {
    return AV_COLORS[(e.gerantId || 0) % AV_COLORS.length];
  }
  gerantColorById(g: GerantResponse): string {
    return AV_COLORS[(g.id || 0) % AV_COLORS.length];
  }
  empColor(emp: EmployeResponse): string {
    return AV_COLORS[(emp.id || 0) % AV_COLORS.length];
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.showSecteurDropdown = false;
    this.showGerantDropdown  = false;
  }

  ngOnInit(): void {
    this.load();
    this.api.getSecteurs().subscribe(d => { this.secteurs = d; this.filteredSecteurs = d; });
    this.api.getGerantsDisponibles().subscribe(d => { this.gerants = d; this.filteredGerants = this.availableGerants(); });
  }

  load(): void {
    this.api.getEntreprises().subscribe(d => { this.entreprises = d; this.applyFilter(); });
  }

  applyFilter(): void {
    const q = this.searchQuery.toLowerCase();
    this.filtered = !q ? [...this.entreprises]
      : this.entreprises.filter(e =>
          `${e.nom} ${e.secteurNom} ${e.gerantNom} ${e.gerantPrenom} ${e.telephone} ${e.adresse}`.toLowerCase().includes(q)
        );
  }

  private availableGerants(): GerantResponse[] {
    const assignedIds = new Set(this.entreprises.map(e => e.gerantId));
    if (this.editing) assignedIds.delete(this.editing.gerantId);
    return this.gerants.filter(g => !assignedIds.has(g.id));
  }

  onlyNumbers(event: KeyboardEvent): boolean {
    if (!/[0-9+\s\-()\\b]/.test(event.key) && event.key.length === 1) { event.preventDefault(); return false; }
    return true;
  }

  openDrop(which: 'secteur' | 'gerant'): void {
    const refName = which === 'secteur' ? 'secteurTrigger' : 'gerantTrigger';
    setTimeout(() => {
      const el = (this as any)[refName]?.nativeElement as HTMLElement;
      if (el) {
        const r = el.getBoundingClientRect();
        document.documentElement.style.setProperty('--dd-top',   `${r.bottom + 5}px`);
        document.documentElement.style.setProperty('--dd-left',  `${r.left}px`);
        document.documentElement.style.setProperty('--dd-width', `${r.width}px`);
      }
    }, 0);
    if (which === 'secteur') { this.showSecteurDropdown = true; this.showGerantDropdown = false; this.filteredSecteurs = this.secteurs; }
    else { this.showGerantDropdown = true; this.showSecteurDropdown = false; this.filteredGerants = this.availableGerants(); }
  }

  clearSecteur(): void { this.selectedSecteur = null; this.secteurSearch = ''; this.form.get('secteurId')?.setValue(''); this.filteredSecteurs = this.secteurs; }
  clearGerant():  void { this.selectedGerant  = null; this.gerantSearch  = ''; this.form.get('gerantId')?.setValue('');  this.filteredGerants  = this.availableGerants(); }
  filterSecteurs(): void { const q = this.secteurSearch.toLowerCase(); this.filteredSecteurs = this.secteurs.filter(s => s.nom.toLowerCase().includes(q)); }
  filterGerants():  void { const q = this.gerantSearch.toLowerCase();  this.filteredGerants  = this.availableGerants().filter(g => `${g.nom} ${g.prenom} ${g.email}`.toLowerCase().includes(q)); }
  selectSecteur(s: SecteurResponse): void { this.selectedSecteur = s; this.form.get('secteurId')?.setValue(String(s.id)); this.showSecteurDropdown = false; }
  selectGerant(g: GerantResponse):   void { this.selectedGerant  = g; this.form.get('gerantId')?.setValue(String(g.id));  this.showGerantDropdown  = false; }

  openDetail(e: EntrepriseResponse): void {
    this.detailEntreprise = e;
    this.detailEmployes   = [];
    this.loadingEmployes  = true;
    this.showDetail       = true;
    this.api.getEmployesByEntreprise(e.id).subscribe({
      next: emps => { this.detailEmployes = emps.filter(e => !e.archived); this.loadingEmployes = false; },
      error: ()   => { this.loadingEmployes = false; }
    });
  }
  closeDetail(): void { this.showDetail = false; this.detailEntreprise = null; this.detailEmployes = []; }

  // ── AJOUTER EMPLOYÉ ──────────────────────────────────────────────────────
  openAddEmploye(): void { this.showAddEmploye = true; this.resetAddEmploye(); }
  closeAddEmploye(): void { this.showAddEmploye = false; this.addEmailError = ''; }

  resetAddEmploye(): void {
    this.addStep = 'email';
    this.checkEmailVal = '';
    this.checkResult = null;
    this.specialiteRattach = '';
    this.addEmailError = '';
    this.addForm.reset();
  }

  doCheckEmail(): void {
    this.addEmailError = '';
    const email = this.checkEmailVal.trim();
    if (!email) return;

    const emailRegex = /^[a-zA-Z0-9._%+\-]{4,}@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      this.addEmailError = 'Email invalide — au moins 4 caractères avant le @, ex: prenom.nom@gmail.com';
      return;
    }

    this.checkLoading = true;
    this.api.checkEmailEmploye(email, this.detailEntreprise?.id).subscribe({
      next: (r: any) => {
        this.checkResult = r;
        this.checkLoading = false;
        switch (r.status) {
          case 'NOT_FOUND':               this.addForm.patchValue({ email }); this.addStep = 'nouveau'; break;
          case 'FREE':                    this.addStep = 'libre';      break;
          case 'BUSY':                    this.addStep = 'occupe';     break;
          case 'ALREADY_IN_THIS_COMPANY': this.addStep = 'occupe';     break;
          case 'ARCHIVED':                this.addStep = 'archived';   break;
          case 'EMAIL_OTHER_ROLE':        this.addStep = 'other-role'; break;
          default:                        this.addForm.patchValue({ email }); this.addStep = 'nouveau';
        }
      },
      error: (e: any) => {
        this.checkLoading = false;
        this.toast.error(e?.error?.message || 'Erreur lors de la vérification');
      }
    });
  }

  doRattacher(): void {
    if (!this.checkResult?.email || !this.detailEntreprise) return;
    this.addLoading = true;
    const req: RattachementRequest = { email: this.checkResult.email, entrepriseId: this.detailEntreprise.id, specialite: this.specialiteRattach || undefined };
    this.api.rattacherEmploye(req).subscribe({
      next: () => { this.toast.success('Employé rattaché !'); this.addLoading = false; this.closeAddEmploye(); this.openDetail(this.detailEntreprise!); },
      error: (e: any) => { this.toast.error(e?.error?.message || 'Erreur'); this.addLoading = false; }
    });
  }

  doDesarchiverEtAssocier(): void {
    if (!this.checkResult?.email || !this.detailEntreprise) return;
    this.addLoading = true;
    const req: RattachementRequest = { email: this.checkResult.email, entrepriseId: this.detailEntreprise.id, specialite: this.specialiteRattach || undefined };
    this.api.rattacherEmploye(req).subscribe({
      next: () => { this.toast.success('Employé désarchivé et associé !'); this.addLoading = false; this.closeAddEmploye(); this.openDetail(this.detailEntreprise!); },
      error: (e: any) => { this.toast.error(e?.error?.message || 'Erreur'); this.addLoading = false; }
    });
  }

  doCreateEmploye(): void {
    if (this.addForm.invalid) { this.addForm.markAllAsTouched(); return; }
    this.addLoading = true;
    const v = this.addForm.value;
    this.api.createEmploye({ ...v as any, entrepriseId: this.detailEntreprise?.id }).subscribe({
      next: () => { this.toast.success('Employé créé !'); this.addLoading = false; this.closeAddEmploye(); this.openDetail(this.detailEntreprise!); },
      error: (e: any) => { this.toast.error(e?.error?.message || 'Erreur'); this.addLoading = false; }
    });
  }

  archiverEmploye(emp: EmployeResponse): void {
    this.api.archiverEmploye(emp.id).subscribe({
      next: () => { this.toast.success('Employé archivé'); this.openDetail(this.detailEntreprise!); },
      error: () => this.toast.error('Erreur')
    });
  }

  desarchiverEmploye(emp: EmployeResponse): void {
    this.api.desarchiverEmploye(emp.id).subscribe({
      next: () => { this.toast.success('Employé désarchivé'); this.openDetail(this.detailEntreprise!); },
      error: () => this.toast.error('Erreur')
    });
  }

  openModal(e?: EntrepriseResponse): void {
    this.editing = e ?? null;
    this.selectedSecteur = null; this.selectedGerant = null;
    this.secteurSearch = ''; this.gerantSearch = '';
    this.filteredSecteurs = this.secteurs; this.filteredGerants = this.availableGerants();
    this.modalStep = e ? 2 : 1;
    if (e) {
      this.form.patchValue({ nom: e.nom, adresse: e.adresse, telephone: e.telephone });
      const s = this.secteurs.find(x => x.id === e.secteurId);
      const g = this.gerants.find(x => x.id === e.gerantId);
      if (s) this.selectSecteur(s);
      if (g) this.selectGerant(g);
    } else { this.form.reset(); }
    this.showModal = true;
  }
  closeModal(): void { this.showModal = false; this.form.reset(); this.editing = null; this.selectedSecteur = null; this.selectedGerant = null; this.modalStep = 1; }

  goToStep2(): void {
    ['nom', 'telephone', 'adresse'].forEach(f => this.form.get(f)?.markAsTouched());
    const step1Valid = this.form.get('nom')?.valid && this.form.get('telephone')?.valid && this.form.get('adresse')?.valid;
    if (step1Valid) { this.modalStep = 2; }
  }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading = true;
    const v = this.form.value;
    const body = { ...v, secteurId: +v.secteurId!, gerantId: +v.gerantId! } as any;
    const req = this.editing ? this.api.updateEntreprise(this.editing.id, body) : this.api.createEntreprise(body);
    req.subscribe({
      next: () => { this.toast.success('Entreprise enregistrée !'); this.load(); this.closeModal(); this.loading = false; },
      error: (e: any) => { this.toast.error(e?.error?.message || e?.error || 'Erreur'); this.loading = false; }
    });
  }

  _showDeleteEntrepriseConfirm(e: EntrepriseResponse): void {
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    background: 'rgba(0,0,0,0.6)',
    zIndex: '99999',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(4px)'
  });

  const box = document.createElement('div');

  const bg     = isDark ? '#16161f' : '#ffffff';
  const border = isDark ? 'rgba(239,68,68,.25)' : '#fecaca';
  const text   = isDark ? '#f2f2f8' : '#0f0f1a';
  const muted  = isDark ? '#a2a2b8' : '#7070a0';
  const btnCancelBg     = isDark ? 'rgba(255,255,255,.06)' : '#f4f4f8';
  const btnCancelBorder = isDark ? 'rgba(255,255,255,.12)' : '#e2e2f0';
  const btnCancelColor  = isDark ? '#a2a2b8' : '#4a4a6a';

  Object.assign(box.style, {
    background: bg,
    border: `1px solid ${border}`,
    borderRadius: '20px',
    padding: '32px 28px',
    textAlign: 'center',
    maxWidth: '380px',
    width: '90%',
    boxShadow: isDark ? '0 24px 64px rgba(0,0,0,0.6)' : '0 16px 48px rgba(0,0,0,0.15)',
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    animation: 'slideUp .2s cubic-bezier(.34,1.56,.64,1)'
  });

  const close = () => document.body.removeChild(overlay);

  box.innerHTML = `
    <div style="width:52px;height:52px;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);
         border-radius:14px;display:flex;align-items:center;justify-content:center;
         font-size:1.3rem;margin:0 auto 16px;color:#ef4444">
      <i class="fas fa-building"></i>
    </div>

    <div style="font-size:1rem;font-weight:700;color:${text};margin-bottom:8px;letter-spacing:-0.01em">
      Supprimer cette entreprise ?
    </div>

    <div style="font-size:.82rem;color:${muted};margin-bottom:8px;line-height:1.5">
      <strong style="color:${text}">${e.nom}</strong>
    </div>

    <div style="font-size:.75rem;color:#ef4444;background:rgba(239,68,68,.08);
         border:1px solid rgba(239,68,68,.2);
         border-radius:8px;padding:8px 12px;margin-bottom:22px">
      <i class="fas fa-exclamation-triangle" style="margin-right:5px"></i>
      Cette action est irréversible.
    </div>

    <div style="display:flex;gap:8px;justify-content:center">
      <button id="ent-del-cancel"
        style="background:${btnCancelBg};color:${btnCancelColor};
        border:1px solid ${btnCancelBorder};
        padding:9px 20px;border-radius:8px;
        font-size:.82rem;font-weight:600;cursor:pointer">
        Annuler
      </button>

      <button id="ent-del-ok"
        style="background:#ef4444;color:#fff;border:none;
        padding:9px 22px;border-radius:8px;
        font-size:.82rem;font-weight:700;cursor:pointer">
        <i class="fas fa-trash-alt" style="margin-right:5px"></i>
        Supprimer
      </button>
    </div>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  box.querySelector('#ent-del-cancel')!.addEventListener('click', close);

  box.querySelector('#ent-del-ok')!.addEventListener('click', () => {
    close();
    this.api.deleteEntreprise(e.id).subscribe({
    next: () => {
      this.toast.success('Entreprise supprimée');
      this.load();
    },
    error: () => {
      this._showErrorPopup('Vous ne pouvez pas supprimer cette entreprise car elle est relié à plusieurs éléments');
    }
  });
  });

  overlay.addEventListener('click', (ev: Event) => {
    if (ev.target === overlay) close();
  });
}

private _showErrorPopup(message: string): void {
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    background: 'rgba(0,0,0,0.6)',
    zIndex: '99999',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(4px)'
  });

  const box = document.createElement('div');

  const bg    = isDark ? '#16161f' : '#ffffff';
  const text  = isDark ? '#f2f2f8' : '#0f0f1a';
  const muted = isDark ? '#a2a2b8' : '#7070a0';

  Object.assign(box.style, {
    background: bg,
    border: `1px solid rgba(239,68,68,.25)`,
    borderRadius: '20px',
    padding: '28px 24px',
    textAlign: 'center',
    maxWidth: '360px',
    width: '90%',
    boxShadow: isDark ? '0 24px 64px rgba(0,0,0,0.6)' : '0 16px 48px rgba(0,0,0,0.15)',
    fontFamily: 'Plus Jakarta Sans, sans-serif'
  });

  const close = () => document.body.removeChild(overlay);

  box.innerHTML = `
    <div style="width:48px;height:48px;background:rgba(239,68,68,.12);
         border:1px solid rgba(239,68,68,.3);
         border-radius:14px;display:flex;align-items:center;justify-content:center;
         font-size:1.2rem;margin:0 auto 14px;color:#ef4444">
      <i class="fas fa-times"></i>
    </div>

    <div style="font-size:.95rem;font-weight:700;color:${text};margin-bottom:6px">
      Une erreur est survenue
    </div>

    <div style="font-size:.8rem;color:${muted};margin-bottom:18px;line-height:1.5">
      ${message}
    </div>

    <button id="error-ok"
      style="background:linear-gradient(135deg,#6366f1,#4f46e5);
      color:#fff;border:none;padding:10px 0;border-radius:10px;
      font-size:.85rem;font-weight:700;cursor:pointer;
      width:100%">
      Compris
    </button>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  box.querySelector('#error-ok')!.addEventListener('click', close);

  overlay.addEventListener('click', (ev: Event) => {
    if (ev.target === overlay) close();
  });
}
}