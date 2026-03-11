import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
  <div class="toast-container">
    @for (t of toast.toasts(); track t.id) {
      <div class="toast {{ t.type }}" (click)="toast.remove(t.id)">
        <i class="fas toast-icon"
          [class.fa-check-circle]="t.type==='success'"
          [class.fa-times-circle]="t.type==='error'"
          [class.fa-exclamation-triangle]="t.type==='warning'"
          [class.fa-info-circle]="t.type==='info'"></i>
        <span class="toast-msg">{{ t.message }}</span>
        <i class="fas fa-times" style="color:var(--text-muted);cursor:pointer;font-size:.75rem"></i>
      </div>
    }
  </div>`
})
export class ToastComponent {
  toast = inject(ToastService);
}
