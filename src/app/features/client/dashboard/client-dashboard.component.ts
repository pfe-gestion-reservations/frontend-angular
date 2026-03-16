import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { ReservationResponse } from '../../../core/models/api.models';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-client-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
<div style="max-width:900px;margin:0 auto;padding-bottom:40px">

  <!-- HEADER -->
  <div style="margin-bottom:28px">
    <div style="font-size:1.5rem;font-weight:800;color:#111">
      Bonjour, <span style="background:linear-gradient(135deg,#3b82f6,#6366f1);-webkit-background-clip:text;-webkit-text-fill-color:transparent">{{ userName }}</span> 👋
    </div>
    <div style="font-size:.875rem;color:#888;margin-top:4px">Voici un aperçu de votre espace client</div>
  </div>

  <!-- STATS -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:28px">
    <div style="background:#fff;border:1.5px solid #e5e7eb;border-radius:16px;padding:20px;position:relative;overflow:hidden">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="width:42px;height:42px;border-radius:12px;background:rgba(59,130,246,.1);color:#3b82f6;display:flex;align-items:center;justify-content:center;font-size:.95rem">
          <i class="fas fa-calendar-check"></i>
        </div>
        <div>
          <div style="font-size:1.8rem;font-weight:800;color:#111;line-height:1">{{ total }}</div>
          <div style="font-size:.72rem;color:#888;text-transform:uppercase;letter-spacing:.04em;margin-top:3px">Réservations</div>
        </div>
      </div>
      <div style="position:absolute;bottom:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#3b82f6,#6366f1)"></div>
    </div>
    <div style="background:#fff;border:1.5px solid #e5e7eb;border-radius:16px;padding:20px;position:relative;overflow:hidden">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="width:42px;height:42px;border-radius:12px;background:rgba(16,185,129,.1);color:#10b981;display:flex;align-items:center;justify-content:center;font-size:.95rem">
          <i class="fas fa-check-circle"></i>
        </div>
        <div>
          <div style="font-size:1.8rem;font-weight:800;color:#111;line-height:1">{{ terminees }}</div>
          <div style="font-size:.72rem;color:#888;text-transform:uppercase;letter-spacing:.04em;margin-top:3px">Terminées</div>
        </div>
      </div>
      <div style="position:absolute;bottom:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#10b981,#34d399)"></div>
    </div>
    <div style="background:#fff;border:1.5px solid #e5e7eb;border-radius:16px;padding:20px;position:relative;overflow:hidden">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="width:42px;height:42px;border-radius:12px;background:rgba(245,158,11,.1);color:#f59e0b;display:flex;align-items:center;justify-content:center;font-size:.95rem">
          <i class="fas fa-star"></i>
        </div>
        <div>
          <div style="font-size:1.8rem;font-weight:800;color:#111;line-height:1">{{ avisCount }}</div>
          <div style="font-size:.72rem;color:#888;text-transform:uppercase;letter-spacing:.04em;margin-top:3px">Avis laissés</div>
        </div>
      </div>
      <div style="position:absolute;bottom:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#f59e0b,#fbbf24)"></div>
    </div>
  </div>

  <!-- INFO BOX : comment ça marche -->
  <div style="background:linear-gradient(135deg,#eff6ff,#eef2ff);border:1.5px solid rgba(99,102,241,.2);border-radius:16px;padding:20px 24px;margin-bottom:28px;display:flex;align-items:flex-start;gap:14px">
    <div style="width:40px;height:40px;border-radius:10px;background:rgba(99,102,241,.12);color:#6366f1;display:flex;align-items:center;justify-content:center;font-size:.95rem;flex-shrink:0;margin-top:2px">
      <i class="fas fa-info-circle"></i>
    </div>
    <div>
      <div style="font-weight:700;font-size:.95rem;color:#4f46e5;margin-bottom:6px">Comment prendre rendez-vous ?</div>
      <div style="font-size:.85rem;color:#555;line-height:1.6">
        Contactez directement <strong>l'établissement</strong> pour réserver. Votre réservation apparaîtra ici dès qu'elle sera enregistrée par notre équipe.
        Vous pouvez suivre son statut en temps réel et l'annuler si nécessaire.
      </div>
    </div>
  </div>

  <!-- PROCHAINS RDV -->
  <div style="background:#fff;border:1.5px solid #e5e7eb;border-radius:16px;overflow:hidden">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #f3f4f6">
      <div style="display:flex;align-items:center;gap:8px;font-weight:700;font-size:.95rem;color:#111">
        <i class="fas fa-calendar-alt" style="color:#3b82f6"></i> Mes prochains rendez-vous
      </div>
      <a routerLink="/client/reservations"
        style="font-size:.78rem;color:#3b82f6;font-weight:600;text-decoration:none;display:flex;align-items:center;gap:4px">
        Voir tout <i class="fas fa-arrow-right" style="font-size:.65rem"></i>
      </a>
    </div>

    <div *ngIf="upcoming.length === 0" style="text-align:center;padding:40px;color:#aaa">
      <i class="fas fa-calendar" style="font-size:1.8rem;opacity:.2;display:block;margin-bottom:10px"></i>
      <p style="font-size:.875rem">Aucun rendez-vous à venir</p>
    </div>

    <div *ngFor="let r of upcoming; let last = last"
      style="display:flex;align-items:center;gap:14px;padding:14px 20px"
      [style.borderBottom]="last ? 'none' : '1px solid #f9fafb'">

      <div style="width:4px;height:44px;border-radius:4px;flex-shrink:0"
        [style.background]="r.statut==='CONFIRMEE'?'#3b82f6':r.statut==='EN_ATTENTE'?'#f59e0b':r.statut==='EN_COURS'?'#6366f1':'#10b981'"></div>

      <div style="width:40px;height:40px;border-radius:10px;background:rgba(99,102,241,.1);color:#6366f1;display:flex;align-items:center;justify-content:center;font-size:.9rem;flex-shrink:0">
        <i class="fas fa-concierge-bell"></i>
      </div>

      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:.9rem;color:#111">{{ r.serviceNom }}</div>
        <div style="font-size:.75rem;color:#888;margin-top:2px;display:flex;align-items:center;gap:8px">
          <span><i class="fas fa-calendar" style="margin-right:3px;font-size:.65rem"></i>{{ r.heureDebut | date:'dd/MM/yyyy' }}</span>
          <span><i class="fas fa-clock" style="margin-right:3px;font-size:.65rem"></i>{{ r.heureDebut | date:'HH:mm' }}</span>
          <span *ngIf="r.employeNom"><i class="fas fa-user-tie" style="margin-right:3px;font-size:.65rem"></i>{{ r.employeNom }}</span>
        </div>
      </div>

      <span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:.7rem;font-weight:700;text-transform:uppercase;white-space:nowrap;flex-shrink:0"
        [style.background]="r.statut==='CONFIRMEE'?'rgba(59,130,246,.1)':r.statut==='EN_ATTENTE'?'rgba(245,158,11,.1)':r.statut==='EN_COURS'?'rgba(99,102,241,.1)':'rgba(16,185,129,.1)'"
        [style.color]="r.statut==='CONFIRMEE'?'#2563eb':r.statut==='EN_ATTENTE'?'#d97706':r.statut==='EN_COURS'?'#4f46e5':'#059669'">
        {{ statutLabel(r.statut) }}
      </span>
    </div>
  </div>

</div>`
})
export class ClientDashboardComponent implements OnInit {
  private api  = inject(ApiService);
  private auth = inject(AuthService);

  total = 0; terminees = 0; avisCount = 0;
  upcoming: ReservationResponse[] = [];

  get userName(): string {
    const u = this.auth.currentUser();
    return u ? ((u.prenom ?? '') + ' ' + (u.nom ?? '')).trim() : '';
  }

  ngOnInit(): void {
    forkJoin({ r: this.api.getReservations(), a: this.api.getAvis() }).subscribe(d => {
      this.total     = d.r.length;
      this.terminees = d.r.filter(r => r.statut === 'TERMINEE').length;
      this.avisCount = d.a.length;
      this.upcoming  = d.r
        .filter(r => !['TERMINEE','ANNULEE'].includes(r.statut))
        .sort((a, b) => new Date(a.heureDebut).getTime() - new Date(b.heureDebut).getTime())
        .slice(0, 5);
    });
  }

  statutLabel(s: string): string {
    const l: Record<string,string> = { EN_ATTENTE:'En attente', CONFIRMEE:'Confirmée', EN_COURS:'En cours', TERMINEE:'Terminée', ANNULEE:'Annulée' };
    return l[s] ?? s;
  }
}