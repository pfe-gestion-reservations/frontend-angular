import { Component, OnInit, inject, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { GerantResponse } from '../../../core/models/api.models';

type GerantCreateStep = 'email-check' | 'email-occupe' | 'email-libre' | 'email-other-role' | 'new-form';

const AV_COLORS = [
  '#2563eb','#16a34a','#d97706','#dc2626','#7c3aed',
  '#0284c7','#059669','#ea580c','#9333ea','#0891b2'
];

@Component({
  selector: 'app-gerants',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './gerants.component.html',
  styleUrls: ['./gerants.component.css']
})
export class GerantsComponent implements OnInit {
  private api      = inject(ApiService);
  private auth     = inject(AuthService);
  private toast    = inject(ToastService);
  private fb       = inject(FormBuilder);
  private renderer = inject(Renderer2);

  gerants:  GerantResponse[] = [];
  filtered: GerantResponse[] = [];

  showModal       = false;
  showCreateModal = false;
  showArchived    = false;
  searchQuery     = '';

  emailError = '';

  // Flux email-check création gérant
  createStep: GerantCreateStep = 'email-check';
  emailToCheck  = '';
  checking      = false;
  checkResult: any = null;
  editing: GerantResponse | null = null;
  loading       = false;

  // Détail (remplace le drawer)
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

  // ── Computed ──────────────────────────────────────────────────────────────
  get totalActifs()   { return this.gerants.filter(g => !g.archived).length; }
  get totalArchives() { return this.gerants.filter(g =>  g.archived).length; }

  get filteredRemplacants(): GerantResponse[] {
    const q = this.gerantSearch.toLowerCase();
    return this.gerantsDisponibles.filter(g =>
      `${g.nom} ${g.prenom} ${g.email}`.toLowerCase().includes(q)
    );
  }

  // ── Helpers avatar ────────────────────────────────────────────────────────
  initials(g: GerantResponse | null): string {
    if (!g) return '';
    return `${g.nom?.charAt(0) ?? ''}${g.prenom?.charAt(0) ?? ''}`.toUpperCase();
  }

  avColor(g: GerantResponse | null): string {
    if (!g) return AV_COLORS[0];
    return AV_COLORS[(g.id || 0) % AV_COLORS.length];
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  ngOnInit(): void { this.load(); }

  load(): void {
    this.api.getGerants().subscribe(d => {
      this.gerants = d;
      this.applyFilter();
      if (this.selectedGerant)
        this.selectedGerant = d.find(g => g.id === this.selectedGerant!.id) ?? null;
    });
  }

  applyFilter(): void {
    const q = this.searchQuery.toLowerCase();
    this.filtered = this.gerants.filter(g => {
      const ms = !q || `${g.nom} ${g.prenom} ${g.email}`.toLowerCase().includes(q);
      return ms && (this.showArchived ? true : !g.archived);
    });
  }

  // ── Détail (modal) ────────────────────────────────────────────────────────
  openDrawer(g: GerantResponse): void  { this.selectedGerant = g; }
  closeDrawer(): void                  { this.selectedGerant = null; }

  // ── Création ──────────────────────────────────────────────────────────────
  openCreateModal(): void {
    this.createError    = '';
    this.createStep     = 'email-check';
    this.emailToCheck   = '';
    this.checkResult    = null;
    this.createForm.reset();
    this.createLoading  = false;
    this.showCreateModal = true;
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.createStep      = 'email-check';
    this.emailToCheck    = '';
    this.checkResult     = null;
    this.createForm.reset();
    this.createError     = '';
    this.createLoading   = false;
  }

  doCheckGerantEmail(): void {
  this.emailError = '';
  const email = this.emailToCheck.trim();
  if (!email) return;

  const emailRegex = /^[a-zA-Z0-9._%+\-]{4,}@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    this.emailError = 'Email invalide — au moins 4 caractères avant le @, ex: prenom.nom@gmail.com';
    return;
  }

  this.checking = true;
  this.api.checkGerantEmail(email).subscribe({
    next: (res: any) => {
      this.checking    = false;
      this.checkResult = res;
      const s = res.statut || res.status;
      switch (s) {
        case 'NOUVEAU':
          this.createForm.patchValue({ email });
          this.createStep = 'new-form';
          break;
        case 'OCCUPE':
          this.createStep = 'email-occupe';
          break;
        case 'LIBRE':
          this.createStep = 'email-libre';
          break;
        case 'EMAIL_OTHER_ROLE':
        default:
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
    this.auth.createGerant(this.createForm.value as any).subscribe({
      next: () => {
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

  // ── Désarchiver depuis modal création ─────────────────────────────────────
  desarchiverDepuisModal(): void {
    if (!this.checkResult?.userId && !this.checkResult?.id) return;
    const id = this.checkResult.userId || this.checkResult.id;
    this.createLoading = true;
    this.api.desarchiverGerant(id).subscribe({
      next: () => {
        this.toast.success('Gérant désarchivé !');
        this.load();
        this.closeCreateModal();
        this.createLoading = false;
      },
      error: () => { this.toast.error('Erreur lors du désarchivage'); this.createLoading = false; }
    });
  }

  // ── Édition ───────────────────────────────────────────────────────────────
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
      next: () => {
        this.toast.success('Gérant modifié !');
        this.load();
        this.closeModal();
        this.loading = false;
      },
      error: (e: any) => { this.toast.error(e?.error?.message || 'Erreur'); this.loading = false; }
    });
  }

  // ── Archivage ─────────────────────────────────────────────────────────────
  openArchiver(g: GerantResponse): void {
    this.gerantAArchiver      = g;
    this.selectedRemplacantId = null;
    this.gerantSearch         = '';
    this.archiverLoading      = false;
    this.showArchiverModal    = true;
    this.api.getGerantsDisponibles().subscribe(d => {
      this.gerantsDisponibles = d.filter(x => x.id !== g.id);
    });
  }

  closeArchiverModal(): void { this.showArchiverModal = false; this.gerantAArchiver = null; }

  private _openNoRemplacantDialog(): void {
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

  const overlay = this.renderer.createElement('div');
  this.renderer.setStyle(overlay, 'position', 'fixed');
  this.renderer.setStyle(overlay, 'inset', '0');
  this.renderer.setStyle(overlay, 'background', 'rgba(0,0,0,0.6)');
  this.renderer.setStyle(overlay, 'z-index', '99999');
  this.renderer.setStyle(overlay, 'display', 'flex');
  this.renderer.setStyle(overlay, 'align-items', 'center');
  this.renderer.setStyle(overlay, 'justify-content', 'center');
  this.renderer.setStyle(overlay, 'backdrop-filter', 'blur(4px)');

  const box = this.renderer.createElement('div');

  const bg    = isDark ? '#16161f' : '#ffffff';
  const text  = isDark ? '#f2f2f8' : '#0f0f1a';
  const muted = isDark ? '#a2a2b8' : '#7070a0';

  this.renderer.setStyle(box, 'background', bg);
  this.renderer.setStyle(box, 'border-radius', '20px');
  this.renderer.setStyle(box, 'padding', '28px 24px');
  this.renderer.setStyle(box, 'text-align', 'center');
  this.renderer.setStyle(box, 'max-width', '420px');
  this.renderer.setStyle(box, 'width', '92%');

  const close = () => this.renderer.removeChild(document.body, overlay);

  box.innerHTML = `
    <div style="width:48px;height:48px;background:rgba(239,68,68,.12);
      border-radius:14px;display:flex;align-items:center;justify-content:center;
      margin:0 auto 14px;color:#ef4444">
      <i class="fas fa-exclamation-triangle"></i>
    </div>

    <div style="font-size:1rem;font-weight:700;color:${text};margin-bottom:8px">
      Remplaçant requis
    </div>

    <div style="font-size:.85rem;color:${muted};margin-bottom:18px">
      Ce gérant est assigné à une entreprise.<br>
      Vous devez sélectionner un gérant remplaçant avant de l’archiver.
    </div>

    <button id="ok-btn"
      style="background:#6366f1;color:#fff;border:none;
      padding:10px 20px;border-radius:10px;font-weight:700;cursor:pointer">
      Compris
    </button>
  `;

  this.renderer.appendChild(overlay, box);
  this.renderer.appendChild(document.body, overlay);

  box.querySelector('#ok-btn')!.addEventListener('click', close);
  overlay.addEventListener('click', (e: any) => {
    if (e.target === overlay) close();
  });
}

    confirmerArchivage(): void {
      if (!this.gerantAArchiver) return;

      // 🔥 CAS IMPORTANT
      if (this.gerantAArchiver.entrepriseNom && !this.selectedRemplacantId) {
        this._openNoRemplacantDialog();
        return;
      }

      this.archiverLoading = true;

      this.api.archiverGerant(
        this.gerantAArchiver.id,
        this.selectedRemplacantId ?? undefined
      ).subscribe({
        next: () => {
          this.toast.success('Gérant archivé avec succès !');
          this.archiverLoading   = false;
          this.showArchiverModal = false;
          this.gerantAArchiver   = null;
          this.load();
        },
        error: (e: any) => {
          this.toast.error(e?.error?.message || e?.error || 'Erreur lors de l\'archivage');
          this.archiverLoading = false;
        }
      });
    }

  desarchiver(g: GerantResponse): void {
    this.api.desarchiverGerant(g.id).subscribe({
      next: () => { this.toast.success('Désarchivé'); this.load(); },
      error: () => this.toast.error('Erreur')
    });
  }

  // ── Suppression ───────────────────────────────────────────────────────────
  supprimer(g: GerantResponse): void {
    if (g.entrepriseNom != null && g.entrepriseNom !== '') {
      this._openLinkedDialog(g);
    } else {
      this._showDeleteConfirm(g);
    }
  }

  private _showDeleteConfirm(g: GerantResponse): void {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const overlay = this.renderer.createElement('div');
    this.renderer.setStyle(overlay, 'position', 'fixed');
    this.renderer.setStyle(overlay, 'inset', '0');
    this.renderer.setStyle(overlay, 'background', 'rgba(0,0,0,0.6)');
    this.renderer.setStyle(overlay, 'z-index', '99999');
    this.renderer.setStyle(overlay, 'display', 'flex');
    this.renderer.setStyle(overlay, 'align-items', 'center');
    this.renderer.setStyle(overlay, 'justify-content', 'center');
    this.renderer.setStyle(overlay, 'backdrop-filter', 'blur(4px)');

    const box = this.renderer.createElement('div');
    const bg     = isDark ? '#16161f' : '#ffffff';
    const border = isDark ? 'rgba(239,68,68,.25)' : '#fecaca';
    const text   = isDark ? '#f2f2f8' : '#0f0f1a';
    const muted  = isDark ? '#a2a2b8' : '#7070a0';
    const btnCancelBg     = isDark ? 'rgba(255,255,255,.06)' : '#f4f4f8';
    const btnCancelBorder = isDark ? 'rgba(255,255,255,.12)' : '#e2e2f0';
    const btnCancelColor  = isDark ? '#a2a2b8' : '#4a4a6a';

    this.renderer.setStyle(box, 'background', bg);
    this.renderer.setStyle(box, 'border', `1px solid ${border}`);
    this.renderer.setStyle(box, 'border-radius', '20px');
    this.renderer.setStyle(box, 'padding', '32px 28px');
    this.renderer.setStyle(box, 'text-align', 'center');
    this.renderer.setStyle(box, 'max-width', '380px');
    this.renderer.setStyle(box, 'width', '90%');
    this.renderer.setStyle(box, 'box-shadow', isDark ? '0 24px 64px rgba(0,0,0,0.6)' : '0 16px 48px rgba(0,0,0,0.15)');
    this.renderer.setStyle(box, 'font-family', 'Plus Jakarta Sans, sans-serif');
    this.renderer.setStyle(box, 'animation', 'slideUp .2s cubic-bezier(.34,1.56,.64,1)');

    const close = () => this.renderer.removeChild(document.body, overlay);

    box.innerHTML = `
      <div style="width:52px;height:52px;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);
           border-radius:14px;display:flex;align-items:center;justify-content:center;
           font-size:1.3rem;margin:0 auto 16px;color:#ef4444">
        <i class="fas fa-trash-alt"></i>
      </div>
      <div style="font-size:1rem;font-weight:700;color:${text};margin-bottom:8px;letter-spacing:-0.01em">
        Supprimer ce gérant ?
      </div>
      <div style="font-size:.82rem;color:${muted};margin-bottom:8px;line-height:1.5">
        <strong style="color:${text}">${g.nom} ${g.prenom}</strong>
      </div>
      <div style="font-size:.75rem;color:#ef4444;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);
           border-radius:8px;padding:8px 12px;margin-bottom:22px">
        <i class="fas fa-exclamation-triangle" style="margin-right:5px"></i>
        Cette action est irréversible.
      </div>
      <div style="display:flex;gap:8px;justify-content:center">
        <button id="del-cancel" style="background:${btnCancelBg};color:${btnCancelColor};
          border:1px solid ${btnCancelBorder};padding:9px 20px;border-radius:8px;
          font-size:.82rem;font-weight:600;cursor:pointer;font-family:inherit">Annuler</button>
        <button id="del-ok" style="background:#ef4444;color:#fff;border:none;
          padding:9px 22px;border-radius:8px;font-size:.82rem;font-weight:700;
          cursor:pointer;font-family:inherit">
          <i class="fas fa-trash-alt" style="margin-right:5px"></i>Supprimer
        </button>
      </div>
    `;
    this.renderer.appendChild(overlay, box);
    this.renderer.appendChild(document.body, overlay);
    box.querySelector('#del-cancel')!.addEventListener('click', close);
    box.querySelector('#del-ok')!.addEventListener('click', () => {
      close();
      this.api.supprimerGerant(g.id).subscribe({
        next: () => { this.load(); this.toast.success('Gérant supprimé définitivement.'); },
        error: () => this.toast.error('Erreur lors de la suppression')
      });
    });
    overlay.addEventListener('click', (ev: Event) => { if (ev.target === overlay) close(); });
  }

  private _openLinkedDialog(g: GerantResponse): void {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const overlay = this.renderer.createElement('div');
    this.renderer.setStyle(overlay, 'position', 'fixed');
    this.renderer.setStyle(overlay, 'inset', '0');
    this.renderer.setStyle(overlay, 'background', 'rgba(0,0,0,0.6)');
    this.renderer.setStyle(overlay, 'z-index', '99999');
    this.renderer.setStyle(overlay, 'display', 'flex');
    this.renderer.setStyle(overlay, 'align-items', 'center');
    this.renderer.setStyle(overlay, 'justify-content', 'center');
    this.renderer.setStyle(overlay, 'backdrop-filter', 'blur(4px)');

    const box = this.renderer.createElement('div');
    const bg    = isDark ? '#16161f' : '#ffffff';
    const text  = isDark ? '#f2f2f8' : '#0f0f1a';
    const muted = isDark ? '#a2a2b8' : '#7070a0';
    const sub   = isDark ? '#78788c' : '#9090b0';
    const hintBg     = isDark ? 'rgba(255,255,255,.04)' : '#f4f4f8';
    const hintBorder = isDark ? 'rgba(255,255,255,.08)' : '#e2e2f0';
    const btnBg = 'linear-gradient(135deg,#6366f1,#4f46e5)';

    this.renderer.setStyle(box, 'background', bg);
    this.renderer.setStyle(box, 'border', `1px solid ${isDark ? 'rgba(255,255,255,.1)' : '#e2e2f0'}`);
    this.renderer.setStyle(box, 'border-radius', '20px');
    this.renderer.setStyle(box, 'padding', '28px 24px');
    this.renderer.setStyle(box, 'text-align', 'center');
    this.renderer.setStyle(box, 'max-width', '420px');
    this.renderer.setStyle(box, 'width', '92%');
    this.renderer.setStyle(box, 'box-shadow', isDark ? '0 24px 64px rgba(0,0,0,0.6)' : '0 16px 48px rgba(0,0,0,0.15)');
    this.renderer.setStyle(box, 'font-family', 'Plus Jakarta Sans, sans-serif');

    const close = () => this.renderer.removeChild(document.body, overlay);

    box.innerHTML = `
      <div style="width:48px;height:48px;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.3);
           border-radius:14px;display:flex;align-items:center;justify-content:center;
           font-size:1.2rem;margin:0 auto 14px;color:#f59e0b">
        <i class="fas fa-exclamation-triangle"></i>
      </div>
      <div style="font-size:.98rem;font-weight:700;color:${text};margin-bottom:6px;letter-spacing:-0.01em">
        Suppression impossible
      </div>
      <div style="font-size:.8rem;color:${muted};margin-bottom:16px;line-height:1.5">
        <strong style="color:${text}">${g.nom} ${g.prenom}</strong> est encore assigné à une entreprise.
      </div>
      <div style="display:flex;align-items:center;gap:12px;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.2);
           border-radius:12px;padding:12px 14px;text-align:left;margin-bottom:14px">
        <div style="width:34px;height:34px;background:rgba(34,197,94,.12);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#22c55e;font-size:.9rem">
          <i class="fas fa-building"></i>
        </div>
        <div>
          <div style="color:#22c55e;font-weight:700;font-size:.82rem;margin-bottom:2px">Entreprise rattachée</div>
          <div style="color:${muted};font-size:.74rem">${g.entrepriseNom ?? ''}</div>
        </div>
      </div>
      <div style="font-size:.74rem;color:${sub};background:${hintBg};
           border-radius:10px;padding:10px 12px;border:1px solid ${hintBorder};
           margin-bottom:18px;text-align:left;line-height:1.6">
        <i class="fas fa-lightbulb" style="color:#6366f1;margin-right:5px"></i>
        Réassignez un autre gérant à cette entreprise avant de supprimer.<br>
        <span>Ou <strong style="color:${muted}">archivez</strong> le gérant pour le désactiver sans perdre les données.</span>
      </div>
      <button id="linked-ok"
        style="background:${btnBg};color:#fff;border:none;
        padding:10px 0;border-radius:10px;font-size:.85rem;font-weight:700;cursor:pointer;
        width:100%;font-family:inherit;box-shadow:0 2px 8px rgba(99,102,241,.35)">
        <i class="fas fa-check" style="margin-right:6px"></i>Compris
      </button>
    `;
    this.renderer.appendChild(overlay, box);
    this.renderer.appendChild(document.body, overlay);
    box.querySelector('#linked-ok')!.addEventListener('click', close);
    overlay.addEventListener('click', (ev: Event) => { if (ev.target === overlay) close(); });
  }
}