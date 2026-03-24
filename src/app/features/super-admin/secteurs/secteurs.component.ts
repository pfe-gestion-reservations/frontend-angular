  import { Component, OnInit, inject } from '@angular/core';
  import { CommonModule } from '@angular/common';
  import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
  import { ApiService } from '../../../core/services/api.service';
  import { ToastService } from '../../../core/services/toast.service';
  import { SecteurResponse, EntrepriseResponse } from '../../../core/models/api.models';

  const AV_COLORS = [
    '#2563eb','#16a34a','#d97706','#dc2626','#7c3aed',
    '#0284c7','#059669','#ea580c','#9333ea','#0891b2'
  ];

  @Component({
    selector: 'app-secteurs',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, FormsModule],
    templateUrl: './secteurs.component.html',
    styleUrls: ['./secteurs.component.css']
  })
  export class SecteursComponent implements OnInit {
    private api   = inject(ApiService);
    private toast = inject(ToastService);
    private fb    = inject(FormBuilder);

    secteurs: SecteurResponse[]  = [];
    filtered: SecteurResponse[]  = [];
    showModal  = false;
    editing: SecteurResponse | null = null;
    loading    = false;
    searchQuery = '';

    selectedSecteur: SecteurResponse | null = null;
    entreprisesDuSecteur: EntrepriseResponse[] = [];
    loadingEntreprises = false;
    showEntreprisesPanel = false;

    form = this.fb.group({ nom: ['', Validators.required] });

    // ── Computed ──────────────────────────────────────────────────────────────
    get totalEntreprises(): number {
      return this.entreprisesDuSecteur.length;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    secteurColor(s: SecteurResponse): string {
      return AV_COLORS[(s.id || 0) % AV_COLORS.length];
    }

    // ── Init ──────────────────────────────────────────────────────────────────
    ngOnInit(): void { this.load(); }

    load(): void {
      this.api.getSecteurs().subscribe(d => { this.secteurs = d; this.applyFilter(); });
    }

    applyFilter(): void {
      const q = this.searchQuery.toLowerCase();
      this.filtered = !q ? [...this.secteurs]
        : this.secteurs.filter(s => s.nom.toLowerCase().includes(q));
    }

    // ── CRUD ──────────────────────────────────────────────────────────────────
    openModal(s?: SecteurResponse): void {
      this.editing = s ?? null;
      this.form.patchValue({ nom: s?.nom ?? '' });
      this.showModal = true;
    }

    closeModal(): void { this.showModal = false; this.form.reset(); this.editing = null; }

    save(): void {
      if (this.form.invalid) { this.form.markAllAsTouched(); return; }
      this.loading = true;
      const req = this.editing
        ? this.api.updateSecteur(this.editing.id, this.form.value as any)
        : this.api.createSecteur(this.form.value as any);
      req.subscribe({
        next: () => { this.toast.success('Secteur enregistré !'); this.load(); this.closeModal(); this.loading = false; },
        error: () => { this.toast.error('Erreur'); this.loading = false; }
      });
    }

    delete(s: SecteurResponse): void {
      if (!confirm(`Supprimer "${s.nom}" ?`)) return;
      this.api.deleteSecteur(s.id).subscribe({
        next: () => {
          this.toast.success('Secteur supprimé');
          this.load();
          if (this.selectedSecteur?.id === s.id) this.closePanel();
        },
        error: () => this.toast.error('Erreur')
      });
    }

    // ── Détail ────────────────────────────────────────────────────────────────
    openSecteur(s: SecteurResponse): void {
      this.selectedSecteur      = s;
      this.entreprisesDuSecteur = [];
      this.loadingEntreprises   = true;
      this.showEntreprisesPanel = true;
      this.api.getEntreprisesBySecteur(s.id).subscribe({
        next: e => { this.entreprisesDuSecteur = e; this.loadingEntreprises = false; },
        error: () => { this.loadingEntreprises = false; }
      });
    }

    closePanel(): void {
      this.showEntreprisesPanel = false;
      this.selectedSecteur      = null;
      this.entreprisesDuSecteur = [];
    }
  }