import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { AvisResponse } from '../../../core/models/api.models';

@Component({
  selector: 'app-employe-avis',
  standalone: true,
  imports: [CommonModule],
  template: `
  <div>
    <div class="page-header">
      <div><div class="page-title"><div class="title-icon"><i class="fas fa-star"></i></div>Avis</div><div class="page-subtitle">Avis des clients de l'entreprise</div></div>
      <div *ngIf="avis.length" style="background:var(--accent-glow);border:1px solid rgba(240,165,0,.3);border-radius:var(--radius-md);padding:8px 16px;color:var(--accent)">
        <i class="fas fa-star"></i> Moyenne : <strong>{{ avgNote }}</strong>/5
      </div>
    </div>
    <div class="avis-grid">
      @for (a of avis; track a.id) {
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
            <div style="width:40px;height:40px;background:var(--bg-hover);border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-weight:700;color:var(--accent)">{{ a.clientNom[0] }}</div>
            <div style="flex:1"><div style="font-weight:600">{{ a.clientNom }} {{ a.clientPrenom }}</div><div style="font-size:.75rem;color:var(--text-muted)">{{ a.dateAvis | date:'dd/MM/yyyy' }}</div></div>
            <div class="stars">@for (i of [1,2,3,4,5]; track i) { <i class="fas fa-star star" [class.filled]="i<=a.note"></i> }</div>
          </div>
          <div style="font-size:.8rem;color:var(--text-secondary);margin-bottom:8px">{{ a.serviceNom }}</div>
          @if (a.commentaire) { <p style="font-size:.875rem;font-style:italic;border-left:2px solid var(--accent);padding-left:12px;color:var(--text-primary)">"{{ a.commentaire }}"</p> }
        </div>
      }
      @empty { <div class="empty-state"><i class="fas fa-star"></i><h3>Aucun avis</h3></div> }
    </div>
  </div>`,
  styles: [`.avis-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}`]
})
export class EmployeAvisComponent implements OnInit {
  private api = inject(ApiService);
  avis: AvisResponse[] = []; avgNote = 0;
  ngOnInit() { this.api.getAvis().subscribe(d => { this.avis = d; this.avgNote = d.length ? +(d.reduce((s,a) => s+a.note, 0)/d.length).toFixed(1) : 0; }); }
}