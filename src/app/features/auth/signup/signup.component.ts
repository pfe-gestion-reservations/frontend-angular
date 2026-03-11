import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
  <div class="auth-page">
    <div class="auth-bg">
      <div class="auth-orb auth-orb1"></div>
      <div class="auth-orb auth-orb2"></div>
    </div>
    <div class="auth-card">
      <div class="auth-logo">
        <div class="auth-logo-icon"><i class="fas fa-user-plus"></i></div>
        <h1>Créer un compte</h1>
        <p>Rejoignez Book Space en tant que client</p>
      </div>
      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Nom</label>
            <input formControlName="nom" class="form-control" placeholder="Dupont">
          </div>
          <div class="form-group">
            <label class="form-label">Prénom</label>
            <input formControlName="prenom" class="form-control" placeholder="Jean">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input formControlName="email" type="email" class="form-control" placeholder="jean.dupont@email.com">
        </div>
        <div class="form-group">
          <label class="form-label">Téléphone</label>
          <input formControlName="numtel" class="form-control" placeholder="+216 XX XXX XXX">
        </div>
        <div class="form-group">
          <label class="form-label">Mot de passe</label>
          <input formControlName="password" type="password" class="form-control" placeholder="••••••••">
        </div>
        @if (error) {
          <div class="auth-error"><i class="fas fa-exclamation-circle"></i> {{ error }}</div>
        }
        <button type="submit" class="btn btn-primary btn-full" [disabled]="loading">
          @if (loading) { Création... } @else { <i class="fas fa-user-check"></i> Créer mon compte }
        </button>
      </form>
      <div class="auth-footer">
        <span>Déjà un compte ?</span>
        <a routerLink="/auth/login">Se connecter</a>
      </div>
    </div>
  </div>`,
  styles: [`
  .auth-page { min-height:100vh;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;background:var(--bg-primary); }
  .auth-bg { position:absolute;inset:0;pointer-events:none; }
  .auth-orb { position:absolute;border-radius:50%;filter:blur(80px);opacity:.3; }
  .auth-orb1 { width:400px;height:400px;background:radial-gradient(circle,var(--success),transparent);top:-100px;right:-100px; }
  .auth-orb2 { width:300px;height:300px;background:radial-gradient(circle,var(--purple),transparent);bottom:-80px;left:-80px; }
  .auth-card { position:relative;z-index:1;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-xl);padding:36px;width:100%;max-width:460px;box-shadow:var(--shadow-lg);animation:slideUp .3s ease; }
  .auth-logo { text-align:center;margin-bottom:28px; }
  .auth-logo-icon { width:56px;height:56px;background:rgba(63,185,80,.15);border:2px solid rgba(63,185,80,.4);border-radius:var(--radius-lg);display:flex;align-items:center;justify-content:center;font-size:1.3rem;color:var(--success);margin:0 auto 12px; }
  .auth-logo h1 { font-size:1.4rem;color:var(--text-primary); }
  .auth-logo p { color:var(--text-secondary);font-size:.875rem;margin-top:4px; }
  .auth-error { background:rgba(248,81,73,.1);border:1px solid rgba(248,81,73,.3);border-radius:var(--radius-md);padding:10px 14px;color:var(--danger);font-size:.875rem;margin-bottom:16px;display:flex;gap:8px;align-items:center; }
  .btn-full { width:100%;justify-content:center;padding:12px;font-size:1rem; }
  .auth-footer { text-align:center;margin-top:16px;font-size:.875rem;color:var(--text-secondary); }
  .auth-footer a { color:var(--accent);margin-left:6px;font-weight:600; }
  `]
})
export class SignupComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);

  form = this.fb.group({
    nom: ['', Validators.required],
    prenom: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    numtel: ['', Validators.required]
  });
  loading = false;
  error = '';

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading = true; this.error = '';
    this.auth.signup(this.form.value as any).subscribe({
      next: () => { this.toast.success('Compte créé ! Connectez-vous.'); this.router.navigate(['/auth/login']); },
      error: (e) => { this.error = e?.error || 'Erreur lors de la création du compte.'; this.loading = false; }
    });
  }
}
