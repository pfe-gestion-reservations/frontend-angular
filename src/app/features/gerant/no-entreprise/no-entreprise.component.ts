import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-no-entreprise',
  standalone: true,
  imports: [CommonModule],
  templateUrl: `./no-entreprise.component.html`,
  styleUrls: [`./no-entreprise.component.css`]
})
export class NoEntrepriseComponent {
  private auth = inject(AuthService);
  user = this.auth.currentUser();
  get initials(): string {
    return `${this.user?.nom?.charAt(0) ?? ''}${this.user?.prenom?.charAt(0) ?? ''}`.toUpperCase();
  }
  logout(): void { this.auth.logout(); }
}