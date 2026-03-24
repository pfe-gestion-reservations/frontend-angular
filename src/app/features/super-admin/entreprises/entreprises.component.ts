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
    telephone: ['', [Validators.required, phoneValidator]],
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
    if (e) {
      this.form.patchValue({ nom: e.nom, adresse: e.adresse, telephone: e.telephone });
      const s = this.secteurs.find(x => x.id === e.secteurId);
      const g = this.gerants.find(x => x.id === e.gerantId);
      if (s) this.selectSecteur(s);
      if (g) this.selectGerant(g);
    } else { this.form.reset(); }
    this.showModal = true;
  }
  closeModal(): void { this.showModal = false; this.form.reset(); this.editing = null; this.selectedSecteur = null; this.selectedGerant = null; }

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

  delete(e: EntrepriseResponse): void {
    if (!confirm(`Supprimer "${e.nom}" ?`)) return;
    this.api.deleteEntreprise(e.id).subscribe({
      next: () => { this.toast.success('Supprimée'); this.load(); },
      error: () => this.toast.error('Erreur')
    });
  }
}