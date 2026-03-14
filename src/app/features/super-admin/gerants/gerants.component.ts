import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { GerantResponse } from '../../../core/models/api.models';

type GerantCreateStep = 'email-check' | 'email-occupe' | 'email-libre' | 'email-other-role' | 'new-form';

@Component({
  selector: 'app-gerants',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './gerants.component.html',
  styleUrls: ['./gerants.component.css']
})
export class GerantsComponent implements OnInit {
  private api   = inject(ApiService);
  private auth  = inject(AuthService);
  private toast = inject(ToastService);
  private fb    = inject(FormBuilder);

  gerants:  GerantResponse[] = [];
  filtered: GerantResponse[] = [];
  showModal  = false;
  showCreate      = false;
  showCreateModal = false;

  // Flux email-check création gérant
  createStep: GerantCreateStep = 'email-check';
  emailToCheck  = '';
  checking      = false;
  checkResult: any = null;
  editing: GerantResponse | null = null;
  loading      = false;
  showArchived    = false;
  selectedGerant: GerantResponse | null = null;

  // Création
  createForm = this.fb.group({
    nom:      ['', Validators.required],
    prenom:   ['', Validators.required],
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });
  createLoading = false;
  createError   = '';
  createdId     = 0;
  createdEmail  = '';
  justCreated   = false;

  // Édition
  editForm = this.fb.group({
    nom:      ['', Validators.required],
    prenom:   ['', Validators.required],
    email:    ['', [Validators.required, Validators.email]],
    password: ['']
  });

  // Archivage avec remplaçant
  showArchiverModal = false;
  gerantAArchiver: GerantResponse | null = null;
  gerantsDisponibles: GerantResponse[] = [];
  selectedRemplacantId: number | null = null;
  archiverLoading = false;
  gerantSearch = '';

  get filteredRemplacants(): GerantResponse[] {
    const q = this.gerantSearch.toLowerCase();
    return this.gerantsDisponibles.filter(g =>
      `${g.nom} ${g.prenom} ${g.email}`.toLowerCase().includes(q)
    );
  }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.api.getGerants().subscribe(d => { this.gerants = d; this.applyFilter(); });
  }

  applyFilter(): void {
    const list = this.showArchived ? this.gerants : this.gerants.filter(g => !g.archived);
    this.filtered = [...list.filter(g => !g.archived), ...list.filter(g => g.archived)];
  }

  // ── DRAWER ──
  openDrawer(g: GerantResponse): void  { this.selectedGerant = g; }
  closeDrawer(): void                  { this.selectedGerant = null; }

  // ── CRÉATION ──
  toggleCreate(): void { this.showCreate = !this.showCreate; this.justCreated = false; this.createError = ''; this.createForm.reset(); }

  openCreateModal(): void {
    this.justCreated    = false;
    this.createError    = '';
    this.createStep     = 'email-check';
    this.emailToCheck   = '';
    this.checkResult    = null;
    this.createForm.reset();
    this.showCreateModal = true;
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.createStep      = 'email-check';
    this.emailToCheck    = '';
    this.checkResult     = null;
    this.createForm.reset();
    this.createError = '';
  }

  doCheckGerantEmail(): void {
    if (!this.emailToCheck.trim()) return;
    this.checking = true;
    this.api.checkGerantEmail(this.emailToCheck.trim()).subscribe({
      next: (res: any) => {
        this.checking    = false;
        this.checkResult = res;
        const s = res.statut || res.status;
        if (s === 'NOUVEAU') {
          // Aucun compte → on peut créer
          this.createForm.patchValue({ email: this.emailToCheck.trim() });
          this.createStep = 'new-form';
        } else if (s === 'OCCUPE') {
          // Gérant actif déjà assigné à une entreprise
          this.createStep = 'email-occupe';
        } else if (s === 'LIBRE') {
          // Gérant archivé ou sans entreprise
          this.createStep = 'email-libre';
        } else {
          // Autre rôle (client, employé, super-admin...)
          this.createStep = 'email-other-role';
        }
      },
      error: () => { this.checking = false; this.toast.error('Erreur lors de la vérification'); }
    });
  }

  onCreate(): void {
    if (this.createForm.invalid) { this.createForm.markAllAsTouched(); return; }
    this.createLoading = true;
    this.createError   = '';
    this.justCreated   = false;
    this.auth.createGerant(this.createForm.value as any).subscribe({
      next: (res: any) => {
        this.createLoading = false;
        this.load();
        this.closeCreateModal();
        this.toast.success('Gérant créé !');
      },
      error: (e: any) => {
        this.createError   = e?.error?.message || e?.error || 'Erreur lors de la création';
        this.createLoading = false;
      }
    });
  }

  // ── ÉDITION ──
  openEdit(g: GerantResponse): void {
    this.editing = g;
    this.editForm.patchValue({ nom: g.nom, prenom: g.prenom, email: g.email, password: '' });
    this.showModal = true;
  }
  closeModal(): void { this.showModal = false; this.editing = null; this.editForm.reset(); }

  onEdit(): void {
    if (this.editForm.invalid || !this.editing) { this.editForm.markAllAsTouched(); return; }
    this.loading = true;
    this.api.updateGerant(this.editing.id, this.editForm.value as any).subscribe({
      next: () => { this.toast.success('Gérant modifié !'); this.load(); this.closeModal(); this.loading = false; },
      error: (e: any) => { this.toast.error(e?.error?.message || 'Erreur'); this.loading = false; }
    });
  }

  // ── ARCHIVER — ouvre modal pour choisir remplaçant ──
  openArchiver(g: GerantResponse): void {
    this.gerantAArchiver   = g;
    this.selectedRemplacantId = null;
    this.gerantSearch      = '';
    this.archiverLoading   = false;
    this.showArchiverModal = true;
    // Charger les gérants disponibles comme remplaçants (non archivés, sans entreprise, != gérant archivé)
    this.api.getGerantsDisponibles().subscribe(d => {
      this.gerantsDisponibles = d.filter(x => x.id !== g.id);
    });
  }

  closeArchiverModal(): void { this.showArchiverModal = false; this.gerantAArchiver = null; }

  confirmerArchivage(): void {
    if (!this.gerantAArchiver) return;
    this.archiverLoading = true;
    this.api.archiverGerant(this.gerantAArchiver.id, this.selectedRemplacantId ?? undefined).subscribe({
      next: () => {
        this.toast.success('Gérant archivé avec succès !');
        this.archiverLoading   = false;
        this.showArchiverModal  = false;
        this.gerantAArchiver    = null;
        this.load();
      },
      error: (e: any) => {
        this.toast.error(e?.error?.message || e?.error || 'Erreur lors de l\'archivage');
        this.archiverLoading = false;
      }
    });
  }

  // ── DÉSARCHIVER depuis modal création ──
  desarchiverDepuisModal(): void {
    if (!this.checkResult?.userId && !this.checkResult?.id) return;
    const id = this.checkResult.userId || this.checkResult.id;
    this.api.desarchiverGerant(id).subscribe({
      next: () => {
        this.toast.success('Gérant désarchivé !');
        this.load();
        this.closeCreateModal();
      },
      error: () => this.toast.error('Erreur lors du désarchivage')
    });
  }

  // ── DÉSARCHIVER ──
  desarchiver(g: GerantResponse): void {
    this.api.desarchiverGerant(g.id).subscribe({
      next: () => { this.toast.success('Gérant désarchivé'); this.load(); },
      error: () => this.toast.error('Erreur')
    });
  }
}