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
    width: '90%'
  });

  const close = () => document.body.removeChild(overlay);

  box.innerHTML = `
    <div style="color:#ef4444;font-size:1.2rem;margin-bottom:10px">
      <i class="fas fa-times"></i>
    </div>

    <div style="font-weight:700;color:${text};margin-bottom:6px">
      Erreur
    </div>

    <div style="font-size:.85rem;color:${muted};margin-bottom:16px">
      ${message}
    </div>

    <button id="ok-btn"
      style="background:#6366f1;color:#fff;border:none;
      padding:10px;border-radius:8px;width:100%;cursor:pointer">
      OK
    </button>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  box.querySelector('#ok-btn')!.addEventListener('click', close);
}

   delete(s: SecteurResponse): void {
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

  Object.assign(box.style, {
    background: bg,
    border: `1px solid ${border}`,
    borderRadius: '20px',
    padding: '32px 28px',
    textAlign: 'center',
    maxWidth: '380px',
    width: '90%',
    boxShadow: isDark ? '0 24px 64px rgba(0,0,0,0.6)' : '0 16px 48px rgba(0,0,0,0.15)',
    fontFamily: 'Plus Jakarta Sans, sans-serif'
  });

  const close = () => document.body.removeChild(overlay);

  box.innerHTML = `
    <div style="width:52px;height:52px;background:rgba(239,68,68,.12);
         border:1px solid rgba(239,68,68,.3);
         border-radius:14px;display:flex;align-items:center;justify-content:center;
         font-size:1.3rem;margin:0 auto 16px;color:#ef4444">
      <i class="fas fa-layer-group"></i>
    </div>

    <div style="font-size:1rem;font-weight:700;color:${text};margin-bottom:8px">
      Supprimer ce secteur ?
    </div>

    <div style="font-size:.82rem;color:${muted};margin-bottom:20px">
      <strong style="color:${text}">${s.nom}</strong>
    </div>

    <div style="display:flex;gap:8px;justify-content:center">
      <button id="sec-cancel"
        style="padding:9px 20px;border-radius:8px;cursor:pointer">
        Annuler
      </button>

      <button id="sec-ok"
        style="background:#ef4444;color:#fff;border:none;
        padding:9px 22px;border-radius:8px;cursor:pointer">
        Supprimer
      </button>
    </div>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  box.querySelector('#sec-cancel')!.addEventListener('click', close);

  box.querySelector('#sec-ok')!.addEventListener('click', () => {
    close();

    this.api.deleteSecteur(s.id).subscribe({
      next: () => {
        this.toast.success('Secteur supprimé');
        this.load();
        if (this.selectedSecteur?.id === s.id) this.closePanel();
      },
      error: () => {
        this._showErrorPopup(
          "Impossible de supprimer ce secteur car il est lié à une ou plusieurs entreprises"
        );
      }
    });
  });

  overlay.addEventListener('click', (ev: Event) => {
    if (ev.target === overlay) close();
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