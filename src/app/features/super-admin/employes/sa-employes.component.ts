import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { EmployeResponse, EntrepriseResponse } from '../../../core/models/api.models';

type ModalStep = 'email-check' | 'result-employe-exists' | 'result-other-role' | 'result-archived' | 'new-form';

const AV_COLORS = [
  '#2563eb','#16a34a','#d97706','#dc2626','#7c3aed',
  '#0284c7','#059669','#ea580c','#9333ea','#0891b2'
];

@Component({
  selector: 'app-sa-employes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './sa-employes.component.html',
  styleUrls: ['./sa-employes.component.css']
})
export class SaEmployesComponent implements OnInit, OnDestroy {
  private api   = inject(ApiService);
  private toast = inject(ToastService);
  private fb    = inject(FormBuilder);

  employes:     EmployeResponse[]    = [];
  filtered:     EmployeResponse[]    = [];
  entreprises:  EntrepriseResponse[] = [];
  filteredEnts: EntrepriseResponse[] = [];

  showModal    = false;
  editing: EmployeResponse | null = null;
  loading      = false;
  showArchived = false;
  searchQuery  = '';

  selectedEntrepriseId: number | null = null;
  entDropOpen = false;
  entSearch   = '';

  step: ModalStep  = 'email-check';
  emailToCheck     = '';
  checking         = false;
  checkResult: any = null;

  // Dropdown entreprise dans le modal new-form
  modalEntDropOpen  = false;
  modalEntSearch    = '';
  filteredModalEnts: EntrepriseResponse[] = [];
  selectedModalEnt: EntrepriseResponse | null = null;

  form = this.fb.group({
    nom:          ['', Validators.required],
    prenom:       ['', Validators.required],
    email:        ['', [Validators.required, Validators.email]],
    password:     ['', [Validators.required, Validators.minLength(6)]],
    specialite:   [''],
    entrepriseId: [null as number | null, Validators.required]
  });

  editForm = this.fb.group({
    nom:        ['', Validators.required],
    prenom:     ['', Validators.required],
    email:      ['', [Validators.required, Validators.email]],
    password:   [''],
    specialite: ['']
  });

  get totalActifs()   { return this.employes.filter(e => !e.archived).length; }
  get totalArchives() { return this.employes.filter(e =>  e.archived).length; }

  private clickListener = () => { this.entDropOpen = false; };

  ngOnInit(): void {
    document.addEventListener('click', this.clickListener);
    this.api.getEntreprises().subscribe(e => {
      this.entreprises = e;
      this.filteredEnts = [...e];
      this.filteredModalEnts = [...e];
    });
    this.load();
  }
  ngOnDestroy(): void { document.removeEventListener('click', this.clickListener); }

  load(): void {
    const obs = this.selectedEntrepriseId
      ? this.api.getEmployesByEntreprise(this.selectedEntrepriseId)
      : this.api.getEmployes();
    obs.subscribe(d => { this.employes = d; this.applyFilter(); });
  }

  // Recharge la liste PUIS exécute le callback (évite le refresh manuel)
  private reloadThen(cb: () => void): void {
    const obs = this.selectedEntrepriseId
      ? this.api.getEmployesByEntreprise(this.selectedEntrepriseId)
      : this.api.getEmployes();
    obs.subscribe(d => { this.employes = d; this.applyFilter(); cb(); });
  }

  applyFilter(): void {
    const q = this.searchQuery.toLowerCase();
    this.filtered = this.employes.filter(e => {
      const ms = !q || `${e.nom} ${e.prenom} ${e.email} ${e.specialite}`.toLowerCase().includes(q);
      return ms && (this.showArchived ? true : !e.archived);
    });
  }

  getEntNom(id: number | null) { return this.entreprises.find(e => e.id === id)?.nom || ''; }

  filterEnts() {
    const q = this.entSearch.toLowerCase();
    this.filteredEnts = this.entreprises.filter(e => e.nom.toLowerCase().includes(q));
  }
  selectEnt(e: EntrepriseResponse) { this.selectedEntrepriseId = e.id; this.entDropOpen = false; this.load(); }
  clearEnt() { this.selectedEntrepriseId = null; this.entSearch = ''; this.filteredEnts = [...this.entreprises]; this.entDropOpen = false; this.load(); }

  initials(e: EmployeResponse) { return `${e.nom?.charAt(0)??''}${e.prenom?.charAt(0)??''}`.toUpperCase(); }
  avColor(e: EmployeResponse)  { return AV_COLORS[(e.id || 0) % AV_COLORS.length]; }

  openCreate(): void {
    this.editing = null;
    this.step = 'email-check';
    this.emailToCheck = '';
    this.checkResult = null;
    this.selectedModalEnt = null;
    this.modalEntSearch = '';
    this.filteredModalEnts = [...this.entreprises];
    this.form.reset();
    this.showModal = true;
  }

  openEdit(e: EmployeResponse): void {
    this.editing = e;
    this.editForm.patchValue({ nom: e.nom, prenom: e.prenom, email: e.email, specialite: e.specialite });
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editing = null;
    this.form.reset();
    this.editForm.reset();
    this.emailToCheck = '';
    this.checkResult = null;
    this.selectedModalEnt = null;
    this.modalEntSearch = '';
    this.modalEntDropOpen = false;
  }

  // ── Vérification email ──────────────────────────────────────────────────
  checkEmail(): void {
    if (!this.emailToCheck.trim()) return;
    this.checking = true;
    this.api.checkEmployeEmail(this.emailToCheck.trim(), this.selectedEntrepriseId ?? undefined).subscribe({
      next: (res: any) => {
        this.checking = false;
        this.checkResult = res;
        const s = res.status;
        // ── Archivé en priorité absolue ─────────────────────────────────
        if (res.archived) {
          this.step = 'result-archived';
        } else if (s === 'FREE' || s === 'BUSY' || s === 'ALREADY_IN_THIS_COMPANY') {
          // Email appartient à un employé (actif, libre ou rattaché)
          this.step = 'result-employe-exists';
        } else if (s === 'EMAIL_OTHER_ROLE') {
          // Email appartient à un autre rôle (client, gérant, SA...)
          this.step = 'result-other-role';
        } else {
          // NOT_FOUND → formulaire création
          this.form.patchValue({ email: this.emailToCheck.trim() });
          this.step = 'new-form';
        }
      },
      error: () => { this.checking = false; this.toast.error('Erreur lors de la vérification'); }
    });
  }

  // ── Désarchiver depuis modal ────────────────────────────────────────────
  desarchiverDepuisModal(): void {
    const id = this.checkResult?.id ?? this.checkResult?.userId;
    if (!id) { this.toast.error('ID employé introuvable'); return; }
    this.loading = true;
    this.api.desarchiverEtRattacherEmploye(id).subscribe({
      next: () => {
        this.closeModal();
        this.reloadThen(() => {
          this.loading = false;
          this.toast.success('Employé désarchivé et rattaché !');
        });
      },
      error: (e: any) => { this.toast.error(e?.error?.message || 'Erreur'); this.loading = false; }
    });
  }

  // ── Dropdown entreprise dans le modal ──────────────────────────────────
  filterModalEnts(): void {
    const q = this.modalEntSearch.toLowerCase();
    this.filteredModalEnts = this.entreprises.filter(e => e.nom.toLowerCase().includes(q));
  }
  selectModalEnt(e: EntrepriseResponse): void {
    this.selectedModalEnt = e;
    this.form.patchValue({ entrepriseId: e.id });
    this.modalEntDropOpen = false;
  }
  clearModalEnt(): void {
    this.selectedModalEnt = null;
    this.form.patchValue({ entrepriseId: null });
    this.modalEntSearch = '';
    this.filteredModalEnts = [...this.entreprises];
  }

  // ── Créer nouveau employé ───────────────────────────────────────────────
  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading = true;
    this.api.createEmploye(this.form.value as any).subscribe({
      next: () => { this.closeModal(); this.reloadThen(() => { this.loading = false; this.toast.success('Employé créé !'); }); },
      error: (err: any) => { this.toast.error(err?.error?.message || 'Erreur'); this.loading = false; }
    });
  }

  saveEdit(): void {
    if (this.editForm.invalid || !this.editing) { this.editForm.markAllAsTouched(); return; }
    this.loading = true;
    this.api.updateEmploye(this.editing.id, this.editForm.value as any).subscribe({
      next: () => { this.closeModal(); this.reloadThen(() => { this.loading = false; this.toast.success('Modifié !'); }); },
      error: () => { this.toast.error('Erreur'); this.loading = false; }
    });
  }

  archiver(e: EmployeResponse): void {
    if (!confirm(`Archiver ${e.nom} ${e.prenom} ?`)) return;
    this.api.archiverEmploye(e.id).subscribe({
      next: () => { this.reloadThen(() => this.toast.success('Archivé')); },
      error: () => this.toast.error('Erreur')
    });
  }

  desarchiver(e: EmployeResponse): void {
    this.api.desarchiverEmploye(e.id).subscribe({
      next: () => { this.reloadThen(() => this.toast.success('Désarchivé')); },
      error: () => this.toast.error('Erreur')
    });
  }
}