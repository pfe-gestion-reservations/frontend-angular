import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-client-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: `./client-dashboard.component.html`,
  styleUrls: [`./client-dashboard.component.css`]
})
export class ClientDashboardComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });
  loading = false;
  error = '';
  showPwd = false;

  onSubmit(): void {
  if (this.form.invalid) {
    this.form.markAllAsTouched();
    return;
  }

  this.loading = true;
  this.error = '';

  this.auth.login(this.form.value as any).pipe(
    finalize(() => this.loading = false)
  ).subscribe({
    next: () => {
      this.toast.success('Connexion réussie !');
      this.auth.redirectToDashboard();
    },
    error: (err) => {
      console.error(err);
      this.error = err.error?.message || 'Email ou mot de passe incorrect.';
    }
  });
}
}