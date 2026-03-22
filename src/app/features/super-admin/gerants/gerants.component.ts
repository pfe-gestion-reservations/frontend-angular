import { Component, OnInit, inject, Renderer2 } from '@angular/core';
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
  private api      = inject(ApiService);
  private auth     = inject(AuthService);
  private toast    = inject(ToastService);
  private fb       = inject(FormBuilder);
  private renderer = inject(Renderer2);

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
      switch (s) {
        case 'NOUVEAU':
          this.createForm.patchValue({ email: this.emailToCheck.trim() });
          this.createStep = 'new-form';
          break;
        case 'OCCUPE':
          this.createStep = 'email-occupe';
          break;
        case 'LIBRE':
          this.createStep = 'email-libre';
          break;
        case 'EMAIL_OTHER_ROLE':
          this.createStep = 'email-other-role';
          break;
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

  supprimer(g: GerantResponse): void {
    if (g.entrepriseNom != null && g.entrepriseNom !== '') {
      this._openLinkedDialog(g);
    } else {
      this._showDeleteConfirm(g);
    }
  }

  private _showDeleteConfirm(g: GerantResponse): void {
    const overlay = this.renderer.createElement('div');
    this.renderer.setStyle(overlay, 'position', 'fixed');
    this.renderer.setStyle(overlay, 'inset', '0');
    this.renderer.setStyle(overlay, 'background', 'rgba(0,0,0,0.65)');
    this.renderer.setStyle(overlay, 'z-index', '99999');
    this.renderer.setStyle(overlay, 'display', 'flex');
    this.renderer.setStyle(overlay, 'align-items', 'center');
    this.renderer.setStyle(overlay, 'justify-content', 'center');
    const box = this.renderer.createElement('div');
    this.renderer.setStyle(box, 'background', '#1e1e2e');
    this.renderer.setStyle(box, 'border', '1px solid rgba(239,68,68,.3)');
    this.renderer.setStyle(box, 'border-radius', '16px');
    this.renderer.setStyle(box, 'padding', '32px 28px');
    this.renderer.setStyle(box, 'text-align', 'center');
    this.renderer.setStyle(box, 'max-width', '380px');
    this.renderer.setStyle(box, 'width', '90%');
    this.renderer.setStyle(box, 'box-shadow', '0 24px 64px rgba(0,0,0,0.6)');
    this.renderer.setStyle(box, 'font-family', 'inherit');
    const close = () => this.renderer.removeChild(document.body, overlay);
    box.innerHTML = `
      <div style="font-size:2.2rem;margin-bottom:12px">🗑️</div>
      <div style="font-size:1.05rem;font-weight:700;color:#fff;margin-bottom:8px">Supprimer ce gérant ?</div>
      <div style="font-size:.875rem;color:#94a3b8;margin-bottom:14px">
        <strong style="color:#fff">${g.nom} ${g.prenom}</strong>
      </div>
      <div style="font-size:.78rem;color:#f87171;margin-bottom:22px">⚠️ Cette action est irréversible.</div>
      <div style="display:flex;gap:10px;justify-content:center">
        <button id="del-cancel" style="background:transparent;color:#aaa;border:1px solid rgba(255,255,255,0.15);padding:9px 20px;border-radius:8px;font-size:.875rem;cursor:pointer">Annuler</button>
        <button id="del-ok" style="background:#ef4444;color:#fff;border:none;padding:9px 22px;border-radius:8px;font-size:.875rem;font-weight:700;cursor:pointer">Supprimer</button>
      </div>
    `;
    this.renderer.appendChild(overlay, box);
    this.renderer.appendChild(document.body, overlay);
    box.querySelector('#del-cancel')!.addEventListener('click', close);
    box.querySelector('#del-ok')!.addEventListener('click', () => {
      close();
      this.api.supprimerGerant(g.id).subscribe({
        next: () => { this.toast.success('Gérant supprimé définitivement.'); this.load(); },
        error: () => this.toast.error('Erreur lors de la suppression')
      });
    });
    overlay.addEventListener('click', (ev: Event) => { if (ev.target === overlay) close(); });
  }

  private _openLinkedDialog(g: GerantResponse): void {
    const overlay = this.renderer.createElement('div');
    this.renderer.setStyle(overlay, 'position', 'fixed');
    this.renderer.setStyle(overlay, 'inset', '0');
    this.renderer.setStyle(overlay, 'background', 'rgba(0,0,0,0.7)');
    this.renderer.setStyle(overlay, 'z-index', '99999');
    this.renderer.setStyle(overlay, 'display', 'flex');
    this.renderer.setStyle(overlay, 'align-items', 'center');
    this.renderer.setStyle(overlay, 'justify-content', 'center');
    const box = this.renderer.createElement('div');
    this.renderer.setStyle(box, 'background', '#1e1e2e');
    this.renderer.setStyle(box, 'border', '1px solid rgba(245,158,11,.4)');
    this.renderer.setStyle(box, 'border-radius', '18px');
    this.renderer.setStyle(box, 'padding', '32px 28px 28px');
    this.renderer.setStyle(box, 'text-align', 'center');
    this.renderer.setStyle(box, 'max-width', '440px');
    this.renderer.setStyle(box, 'width', '92%');
    this.renderer.setStyle(box, 'box-shadow', '0 24px 64px rgba(0,0,0,0.7)');
    this.renderer.setStyle(box, 'font-family', 'inherit');
    const close = () => this.renderer.removeChild(document.body, overlay);
    box.innerHTML = `
      <div style="width:52px;height:52px;background:rgba(245,158,11,.12);border:2px solid rgba(245,158,11,.35);
           border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.6rem;margin:0 auto 16px">⚠️</div>
      <div style="font-size:1.1rem;font-weight:700;color:#fff;margin-bottom:6px">Suppression impossible</div>
      <div style="font-size:.82rem;color:#94a3b8;margin-bottom:18px;line-height:1.5">
        <strong style="color:#f1f5f9">${g.nom} ${g.prenom}</strong> est encore assigné à une entreprise :
      </div>
      <div style="display:flex;align-items:center;gap:12px;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.25);
           border-radius:10px;padding:14px 16px;text-align:left;margin-bottom:18px">
        <span style="font-size:1.5rem;flex-shrink:0">🏢</span>
        <div>
          <div style="color:#6ee7b7;font-weight:700;font-size:.88rem;margin-bottom:3px">Entreprise gérée</div>
          <div style="color:#fff;font-size:.85rem;font-weight:600">${g.entrepriseNom ?? ''}</div>
          <div style="color:#94a3b8;font-size:.76rem;margin-top:3px">Réassignez un autre gérant à cette entreprise avant de supprimer.</div>
        </div>
      </div>
      <div style="font-size:.76rem;color:#64748b;margin-bottom:20px;line-height:1.5;background:rgba(255,255,255,.03);
           border-radius:8px;padding:10px;border:1px solid rgba(255,255,255,.06)">
        💡 Archivez le gérant pour le désactiver tout en gardant son entreprise opérationnelle.
      </div>
      <button id="linked-ok"
        style="background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:none;
        padding:11px 36px;border-radius:10px;font-size:.9rem;font-weight:600;cursor:pointer;
        width:100%;transition:opacity .2s"
        onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
        Compris
      </button>
    `;
    this.renderer.appendChild(overlay, box);
    this.renderer.appendChild(document.body, overlay);
    box.querySelector('#linked-ok')!.addEventListener('click', close);
    overlay.addEventListener('click', (ev: Event) => { if (ev.target === overlay) close(); });
  }

  // ── DÉSARCHIVER ──
  desarchiver(g: GerantResponse): void {
    this.api.desarchiverGerant(g.id).subscribe({
      next: () => { this.toast.success('Gérant désarchivé'); this.load(); },
      error: () => this.toast.error('Erreur')
    });
  }
}