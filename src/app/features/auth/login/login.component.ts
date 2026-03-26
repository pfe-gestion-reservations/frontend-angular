import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `<div class="auth-page">
    <div class="auth-bg">
      <div class="auth-orb auth-orb1"></div>
      <div class="auth-orb auth-orb2"></div>
    </div>
    <div class="auth-card">
      <div class="auth-logo">
        <div class="auth-logo-icon"><i class="fas fa-calendar-check"></i></div>
        <h1>Book Space</h1>
        <p>Plateforme de gestion des réservations</p>
      </div>
      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <div class="form-group">
          <label class="form-label">Email</label>
          <div class="input-icon-wrap">
            <i class="fas fa-envelope"></i>
            <input formControlName="email" type="email" class="form-control" placeholder="email@exemple.com"
              [class.is-invalid]="form.get('email')?.invalid && form.get('email')?.touched">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Mot de passe</label>
          <div class="input-icon-wrap">
            <i class="fas fa-lock"></i>
            <input formControlName="password" [type]="showPwd ? 'text' : 'password'" class="form-control" placeholder="••••••••"
              [class.is-invalid]="form.get('password')?.invalid && form.get('password')?.touched">
            <button type="button" class="pwd-toggle" (click)="showPwd=!showPwd">
              <i class="fas" [class.fa-eye]="!showPwd" [class.fa-eye-slash]="showPwd"></i>
            </button>
          </div>
        </div>

        <!-- Affichage de l'erreur -->
        <div class="auth-error" *ngIf="error">
          <i class="fas fa-exclamation-circle"></i> {{ error }}
        </div>

        <button type="submit" class="btn btn-primary btn-full" [disabled]="loading">
          <span *ngIf="loading" class="spinner-sm"></span>
            <span *ngIf="!loading"><i class="fas fa-sign-in-alt"></i> Se connecter</span>
        </button>
      </form>

      <div class="auth-footer">
        <span>Nouveau client ?</span>
        <a routerLink="/auth/signup">Créer un compte</a>
      </div>
    </div>
  </div>
  `,
  styles: [`.auth-page {
    min-height: 100vh;
    display: flex; align-items: center; justify-content: center;
    position: relative; overflow: hidden;
    background: var(--bg-primary);
  }
  .auth-bg { position: absolute; inset: 0; pointer-events: none; }
  .auth-orb { position: absolute; border-radius: 50%; filter: blur(80px); opacity: .3; }
  .auth-orb1 { width: 400px; height: 400px; background: radial-gradient(circle, var(--accent), transparent); top: -100px; left: -100px; }
  .auth-orb2 { width: 300px; height: 300px; background: radial-gradient(circle, var(--info), transparent); bottom: -80px; right: -80px; }
  .auth-card { position: relative; z-index: 1; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: 40px; width: 100%; max-width: 420px; box-shadow: var(--shadow-lg); animation: slideUp .3s ease; }
  .auth-logo { text-align: center; margin-bottom: 32px; }
  .auth-logo-icon { width: 64px; height: 64px; background: var(--accent-glow); border: 2px solid rgba(240,165,0,.4); border-radius: var(--radius-lg); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; color: var(--accent); margin: 0 auto 16px; }
  .auth-logo h1 { font-size: 1.6rem; color: var(--text-primary); }
  .auth-logo p { color: var(--text-secondary); font-size: .875rem; margin-top: 4px; }
  .input-icon-wrap { position: relative; }
  .input-icon-wrap > i:first-child { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: .85rem; pointer-events: none; }
  .input-icon-wrap .form-control { padding-left: 38px; padding-right: 38px; }
  .pwd-toggle { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: .85rem; padding: 0; transition: color .2s; }
  .pwd-toggle:hover { color: var(--accent); }
  .auth-error { background: rgba(248,81,73,.1); border: 1px solid rgba(248,81,73,.3); border-radius: var(--radius-md); padding: 10px 14px; color: var(--danger); font-size: .875rem; margin-bottom: 16px; display: flex; gap: 8px; align-items: center; }
  .btn-full { width: 100%; justify-content: center; padding: 12px; font-size: 1rem; }
  .spinner-sm { width: 16px; height: 16px; border: 2px solid rgba(0,0,0,.3); border-top-color: #0d1117; border-radius: 50%; animation: spin .7s linear infinite; display: inline-block; }
  .auth-footer { text-align: center; margin-top: 20px; font-size: .875rem; color: var(--text-secondary); }
  .auth-footer a { color: var(--accent); margin-left: 6px; font-weight: 600; }
  `]
})
export class LoginComponent {
  private fb     = inject(FormBuilder);
  private auth   = inject(AuthService);
  private toast  = inject(ToastService);
  private router = inject(Router);

  form = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });
  loading = false;
  error   = '';
  showPwd = false;

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.error   = '';

    this.auth.login(this.form.value as any).pipe(
      finalize(() => this.loading = false)
    ).subscribe({
      next: () => {
        this.toast.success('Connexion réussie !');
        this.auth.redirectToDashboard();
      },
      error: (err) => {
        if (err.status === 403 && err.error?.reason) {
          this.router.navigate(['/auth/compte-bloque'], {
            state: {
              reason: err.error.reason,
              email: this.form.value.email
            }
      });
    return;
  }


  this.error = this.getErrorMessage(err);
}
    });
  }

getErrorMessage(error: any): string {
  const msg = error?.error?.message?.toLowerCase() || '';

  if (msg.includes('bad credentials')) {
    return 'Email ou mot de passe incorrect.';
  }

  if (msg.includes('disabled')) {
    return 'Compte désactivé.';
  }

  return error?.error?.message || 'Une erreur est survenue';
}
}