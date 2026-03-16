import { Component, OnInit, OnDestroy, inject, Renderer2 } from '@angular/core';
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
  private api      = inject(ApiService);
  private toast    = inject(ToastService);
  private auth     = inject(AuthService);
  private fb       = inject(FormBuilder);
  private renderer = inject(Renderer2);

  employes:  EmployeResponse[] = [];
  filtered:  EmployeResponse[] = [];  // actifs en premier, archivés en bas

  showModal    = false;
  editing: EmployeResponse | null = null;
  loading      = false;
  searchQuery  = '';

  selectedEmploye: EmployeResponse | null = null;

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

  get entrepriseId(): number | null { return this.auth.getEntrepriseId(); }
  get totalActifs()   { return this.employes.filter(e => !e.archived).length; }
  get totalArchives() { return this.employes.filter(e =>  e.archived).length; }

  ngOnInit(): void { this.load(); }
  ngOnDestroy(): void {}

  load(): void {
    this.api.getEmployes().subscribe(d => {
      this.employes = d;
      this.applyFilter();
      if (this.selectedEmploye) {
        this.selectedEmploye = d.find(e => e.id === this.selectedEmploye!.id) ?? null;
      }
    });
  }

  applyFilter(): void {
    const q = this.searchQuery.toLowerCase();
    this.filtered = this.employes.filter(e =>
      !q || `${e.nom} ${e.prenom} ${e.email} ${e.specialite ?? ''}`.toLowerCase().includes(q)
    );
  }

  initials(e: EmployeResponse) { return `${e.nom?.charAt(0)??''}${e.prenom?.charAt(0)??''}`.toUpperCase(); }
  avColor(e: EmployeResponse)  { return AV_COLORS[(e.id || 0) % AV_COLORS.length]; }

  openDrawer(e: EmployeResponse): void { this.selectedEmploye = e; }
  closeDrawer(): void                  { this.selectedEmploye = null; }

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
    this.api.checkEmployeEmail(this.emailToCheck.trim(), this.entrepriseId ?? undefined).subscribe({
      next: (res: any) => {
        this.checking = false;
        this.checkResult = res;
        const s = res.status ?? res.statut;
        if      (s === 'FREE' && res.archived)         this.step = 'result-archived';
        else if (s === 'LIBRE' && res.archived)        this.step = 'result-archived';
        else if (s === 'FREE')                         this.step = 'result-free';
        else if (s === 'BUSY')                         this.step = 'result-busy';
        else if (s === 'ALREADY_IN_THIS_COMPANY')      this.step = 'result-already';
        else if (s === 'EMAIL_OTHER_ROLE')             this.step = 'result-other-role';
        else if (s === 'NOT_FOUND') {
          this.form.patchValue({ email: this.emailToCheck.trim() });
          this.step = 'new-form';
        }
      },
      error: () => { this.checking = false; this.toast.error('Erreur lors de la vérification'); }
    });
  }

  rattacher(): void {
    if (!this.checkResult?.email) return;
    this.loading = true;
    this.api.rattacherEmploye({ email: this.checkResult.email }).subscribe({
      next: () => { this.toast.success('Employé rattaché !'); this.load(); this.closeModal(); this.loading = false; },
      error: (e: any) => { this.toast.error(e?.error?.message || 'Erreur'); this.loading = false; }
    });
  }

  // Employé archivé → désarchiver ET rattacher à cette entreprise en une seule opération
  desarchiverDepuisModal(): void {
    const id = this.checkResult?.id ?? this.checkResult?.userId;
    if (!id) { this.toast.error('ID employé introuvable'); return; }
    this.loading = true;
    this.api.desarchiverEtRattacherEmploye(id).subscribe({
      next: () => {
        this.closeModal();
        this.api.getEmployes().subscribe(d => {
          this.employes = d;
          this.applyFilter();
          this.loading = false;
          this.toast.success('Employé réactivé et ajouté à votre entreprise !');
        });
      },
      error: (e: any) => { this.toast.error(e?.error?.message || 'Erreur'); this.loading = false; }
    });
  }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading = true;
    this.api.createEmploye({ ...this.form.value as any }).subscribe({
      next: () => { this.toast.success('Employé créé !'); this.closeModal(); this.loading = false; this.load(); },
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

  confirmerArchivage(e: EmployeResponse): void {
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
    this.renderer.setStyle(box, 'border', '1px solid rgba(245,158,11,.35)');
    this.renderer.setStyle(box, 'border-radius', '16px');
    this.renderer.setStyle(box, 'padding', '32px 28px');
    this.renderer.setStyle(box, 'text-align', 'center');
    this.renderer.setStyle(box, 'max-width', '360px');
    this.renderer.setStyle(box, 'width', '90%');
    this.renderer.setStyle(box, 'box-shadow', '0 24px 64px rgba(0,0,0,0.6)');

    const close = () => this.renderer.removeChild(document.body, overlay);

    box.innerHTML = `
      <div style="font-size:2.2rem;margin-bottom:12px">📦</div>
      <div style="font-size:1.05rem;font-weight:700;color:#fff;margin-bottom:8px">Archiver cet employé ?</div>
      <div style="font-size:.85rem;color:#aaa;margin-bottom:6px"><strong style="color:#fff">${e.nom} ${e.prenom}</strong></div>
      <div style="font-size:.8rem;color:#94a3b8;margin-bottom:22px">L'employé sera désactivé mais ses données seront conservées.</div>
      <div style="display:flex;gap:10px;justify-content:center">
        <button id="arch-cancel" style="background:transparent;color:#aaa;border:1px solid rgba(255,255,255,0.15);padding:9px 20px;border-radius:8px;font-size:.875rem;cursor:pointer">Annuler</button>
        <button id="arch-ok" style="background:#f59e0b;color:#fff;border:none;padding:9px 22px;border-radius:8px;font-size:.875rem;font-weight:700;cursor:pointer">Archiver</button>
      </div>`;

    this.renderer.appendChild(overlay, box);
    this.renderer.appendChild(document.body, overlay);

    box.querySelector('#arch-cancel')!.addEventListener('click', close);
    box.querySelector('#arch-ok')!.addEventListener('click', () => {
      close();
      this.api.archiverEmploye(e.id).subscribe({
        next: () => { this.toast.success('Employé archivé'); this.load(); },
        error: () => this.toast.error('Erreur lors de l\'archivage')
      });
    });
    overlay.addEventListener('click', (ev: Event) => { if (ev.target === overlay) close(); });
  }

  desarchiver(e: EmployeResponse): void {
    this.api.desarchiverEmploye(e.id).subscribe({
      next: () => { this.toast.success('Désarchivé'); this.load(); },
      error: () => this.toast.error('Erreur')
    });
  }
}