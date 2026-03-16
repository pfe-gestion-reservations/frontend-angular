import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { AvisResponse } from '../../../core/models/api.models';

@Component({
  selector: 'app-gerant-avis',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div>
    <div class="page-header">
      <div>
        <div class="page-title"><div class="title-icon"><i class="fas fa-star"></i></div>Avis Clients</div>
        <div class="page-subtitle">{{ avis.length }} avis · Note moyenne :
          <strong>{{ avgNote }}/5</strong>
          <span class="inline-stars">
            <i class="fas fa-star" *ngFor="let s of [1,2,3,4,5]" [class.lit]="s <= avgNote"></i>
          </span>
        </div>
      </div>
    </div>

    <!-- FILTRE NOTE -->
    <div class="filter-bar">
      <button class="chip" [class.active]="filterNote === 0" (click)="filterNote = 0; filter()">Tous</button>
      <button class="chip" *ngFor="let n of [5,4,3,2,1]"
        [class.active]="filterNote === n" (click)="filterNote = n; filter()">
        {{ n }} <i class="fas fa-star"></i>
      </button>
      <input class="search-input" [(ngModel)]="q" (ngModelChange)="filter()"
        placeholder="Rechercher...">
    </div>

    <!-- LISTE -->
    <div class="avis-list">
      <div class="avis-card" *ngFor="let a of filtered">
        <div class="avis-left">
          <div class="avatar">{{ a.clientPrenom[0] }}{{ a.clientNom[0] }}</div>
        </div>
        <div class="avis-body">
          <div class="avis-top">
            <span class="client-name">{{ a.clientPrenom }} {{ a.clientNom }}</span>
            <span class="service-tag">{{ a.serviceNom }}</span>
          </div>
          <div class="avis-stars">
            <i class="fas fa-star" *ngFor="let s of [1,2,3,4,5]" [class.lit]="s <= a.note"></i>
            <span class="note-badge" [ngClass]="'n'+a.note">{{ a.note }}/5</span>
          </div>
          <div class="avis-comment" *ngIf="a.commentaire">"{{ a.commentaire }}"</div>
        </div>
        <div class="avis-date">{{ a.dateAvis | date:'dd/MM/yy' }}</div>
      </div>

      <div class="empty-state" *ngIf="filtered.length === 0">
        <i class="fas fa-star-half-alt"></i>
        <h3>Aucun avis</h3>
      </div>
    </div>
  </div>`,
  styles: [`
    .page-subtitle strong { color: var(--accent); }
    .inline-stars { margin-left: 6px; }
    .inline-stars i, .avis-stars i { font-size: .75rem; color: #d1d5db; }
    .inline-stars i.lit, .avis-stars i.lit { color: #f59e0b; }

    /* FILTRES */
    .filter-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
    .chip { padding: 5px 12px; border: 1px solid var(--border); border-radius: 20px; background: var(--bg-secondary); color: var(--text-secondary); font-size: .78rem; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: all .15s; }
    .chip i { font-size: .65rem; color: #f59e0b; }
    .chip:hover { border-color: var(--accent); color: var(--accent); }
    .chip.active { background: var(--accent); color: #fff; border-color: var(--accent); }
    .chip.active i { color: #fff; }
    .search-input { margin-left: auto; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg-secondary); padding: 6px 12px; font-size: .82rem; color: var(--text-primary); outline: none; width: 200px; }
    .search-input:focus { border-color: var(--accent); }

    /* LISTE */
    .avis-list { display: flex; flex-direction: column; gap: 10px; }
    .avis-card { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 16px 20px; display: flex; align-items: flex-start; gap: 14px; transition: border-color .2s; }
    .avis-card:hover { border-color: var(--accent); }

    .avatar { width: 38px; height: 38px; background: var(--accent); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: .8rem; flex-shrink: 0; }

    .avis-body { flex: 1; display: flex; flex-direction: column; gap: 5px; }
    .avis-top { display: flex; align-items: center; gap: 10px; }
    .client-name { font-weight: 600; font-size: .9rem; color: var(--text-primary); }
    .service-tag { font-size: .72rem; background: var(--accent-glow); color: var(--accent); padding: 2px 8px; border-radius: 20px; }
    .avis-stars { display: flex; align-items: center; gap: 3px; }
    .note-badge { margin-left: 8px; font-size: .72rem; font-weight: 700; padding: 1px 7px; border-radius: 20px; }
    .n5, .n4 { background: rgba(34,197,94,.12); color: #16a34a; }
    .n3      { background: rgba(234,179,8,.12); color: #ca8a04; }
    .n2, .n1 { background: rgba(239,68,68,.12); color: #dc2626; }
    .avis-comment { font-size: .82rem; color: var(--text-secondary); font-style: italic; }

    .avis-date { font-size: .72rem; color: var(--text-muted); white-space: nowrap; margin-top: 2px; }
  `]
})
export class EmployeAvisComponent implements OnInit {
  private api = inject(ApiService);

  avis: AvisResponse[]     = [];
  filtered: AvisResponse[] = [];
  avgNote    = 0;
  filterNote = 0;
  q          = '';

  ngOnInit(): void {
    this.api.getAvis().subscribe(d => {
      this.avis    = d;
      this.avgNote = d.length
        ? Math.round(d.reduce((s, a) => s + a.note, 0) / d.length)
        : 0;
      this.filter();
    });
  }

  filter(): void {
    this.filtered = this.avis.filter(a => {
      const matchNote = this.filterNote === 0 || a.note === this.filterNote;
      const matchQ    = !this.q || `${a.clientNom} ${a.clientPrenom} ${a.commentaire || ''}`.toLowerCase().includes(this.q.toLowerCase());
      return matchNote && matchQ;
    });
  }
}