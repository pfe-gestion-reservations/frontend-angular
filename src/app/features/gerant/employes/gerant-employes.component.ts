import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import { EmployeResponse } from '../../../core/models/api.models';

type ModalStep = 'email-check' | 'result-busy' | 'result-free' | 'result-already' | 'result-other-role' | 'result-archived' | 'new-form';

const AV_COLORS = [
  '#2563eb','#16a34a','#d97706','#dc2626','#7c3aed',
  '#0284c7','#059669','#ea580c','#9333ea','#0891b2'
];

@Component({
  selector: 'app-gerant-employes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './gerant-employes.component.html',
  styleUrls: ['./gerant-employes.component.css']
})
export class GerantEmployesComponent implements OnInit, OnDestroy {
  private api   = inject(ApiService);
  private toast = inject(ToastService);
  private auth  = inject(AuthService);
  private fb    = inject(FormBuilder);

  employes:  EmployeResponse[] = [];
  filtered:  EmployeResponse[] = [];

  showModal    = false;
  editing: EmployeResponse | null = null;
  loading      = false;
  showArchived = false;
  searchQuery  = '';

  step: ModalStep  = 'email-check';
  emailToCheck     = '';
  checking         = false;
  checkResult: any = null;

  form = this.fb.group({
    nom:        ['', Validators.required],
    prenom:     ['', Validators.required],
    email:      ['', [Validators.required, Validators.email]],
    password:   ['', [Validators.required, Validators.minLength(6)]],
    specialite: ['']
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

  ngOnInit(): void { this.load(); }
  ngOnDestroy(): void {}

  // ─── GET /employes — le back déduit l'entreprise depuis le token GÉRANT ─────
  load(): void {
    this.api.getEmployes().subscribe(d => {
      this.employes = d; this.applyFilter();
    });
  }

  applyFilter(): void {
    const q = this.searchQuery.toLowerCase();
    this.filtered = this.employes.filter(e => {
      const ms = !q || `${e.nom} ${e.prenom} ${e.email} ${e.specialite}`.toLowerCase().includes(q);
      return ms && (this.showArchived ? true : !e.archived);
    });
  }

  initials(e: EmployeResponse) { return `${e.nom?.charAt(0)??''}${e.prenom?.charAt(0)??''}`.toUpperCase(); }
  avColor(e: EmployeResponse)  { return AV_COLORS[(e.id || 0) % AV_COLORS.length]; }

  openCreate(): void {
    this.editing = null;
    this.step = 'email-check';
    this.emailToCheck = '';
    this.checkResult = null;
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
  }

  checkEmail(): void {
    if (!this.emailToCheck.trim()) return;
    this.checking = true;
    this.api.checkEmployeEmail(this.emailToCheck.trim()).subscribe({
      next: (res: any) => {
        this.checking = false;
        this.checkResult = res;
        const s = res.status;
        if      (s === 'FREE')                  this.step = 'result-free';
        else if (s === 'BUSY')                  this.step = 'result-busy';
        else if (s === 'ALREADY_IN_THIS_COMPANY') this.step = 'result-already';
        else if (s === 'EMAIL_OTHER_ROLE')      this.step = 'result-other-role';
        else if (s === 'NOT_FOUND')             {
          this.form.patchValue({ email: this.emailToCheck.trim() });
          this.step = 'new-form';
        }
      },
      error: () => { this.checking = false; this.toast.error('Erreur lors de la vérification'); }
    });
  }

  // ─── Rattacher un employé FREE ────────────────────────────────────────────
  rattacher(): void {
    if (!this.checkResult?.email) return;
    this.loading = true;
    this.api.rattacherEmploye({ email: this.checkResult.email }).subscribe({
      next: () => {
        this.toast.success('Employé rattaché !');
        this.load(); this.closeModal(); this.loading = false;
      },
      error: (e: any) => { this.toast.error(e?.error?.message || 'Erreur'); this.loading = false; }
    });
  }

  // ─── Désarchiver depuis le modal ──────────────────────────────────────────
  desarchiverDepuisModal(): void {
    const id = this.checkResult?.id;
    if (!id) return;
    this.loading = true;
    this.api.desarchiverEmploye(id).subscribe({
      next: () => {
        this.toast.success('Employé désarchivé !');
        this.loading = false; this.load(); this.closeModal();
      },
      error: () => { this.toast.error('Erreur'); this.loading = false; }
    });
  }

  // ─── Créer nouveau compte ─────────────────────────────────────────────────
  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading = true;
    this.api.createEmploye({ ...this.form.value as any }).subscribe({
      next: () => {
        this.toast.success('Employé créé !');
        this.closeModal(); this.loading = false; this.load();
      },
      error: (err: any) => { this.toast.error(err?.error?.message || 'Erreur'); this.loading = false; }
    });
  }

  saveEdit(): void {
    if (this.editForm.invalid || !this.editing) { this.editForm.markAllAsTouched(); return; }
    this.loading = true;
    this.api.updateEmploye(this.editing.id, this.editForm.value as any).subscribe({
      next: () => { this.toast.success('Modifié !'); this.load(); this.closeModal(); this.loading = false; },
      error: () => { this.toast.error('Erreur'); this.loading = false; }
    });
  }

  archiver(e: EmployeResponse): void {
    if (!confirm(`Archiver ${e.nom} ${e.prenom} ?`)) return;
    this.api.archiverEmploye(e.id).subscribe({
      next: () => { this.toast.success('Archivé'); this.load(); },
      error: () => this.toast.error('Erreur')
    });
  }

  desarchiver(e: EmployeResponse): void {
    this.api.desarchiverEmploye(e.id).subscribe({
      next: () => { this.toast.success('Désarchivé'); this.load(); },
      error: () => this.toast.error('Erreur')
    });
  }
}