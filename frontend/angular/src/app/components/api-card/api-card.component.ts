import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDividerModule } from '@angular/material/divider';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';

@Component({
  selector: 'app-api-card',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  templateUrl: './api-card.component.html',
  styleUrl: './api-card.component.css',
})
export class ApiCardComponent {
  @Input() data: any[] = [];
  @Input() title: string = '';
  @Input() subtitle: string = '';
  @Input() primaryAction: string = '';
  @Input() secondaryAction: string = '';
  @Input() isLoading: boolean = false;
  @Input() isDisabled: boolean = false;
  @Input() showChooser: boolean = false;
  @Input() showBody: boolean = true;
  @Output() onClear = new EventEmitter<void>();
  @Output() onClick = new EventEmitter<void>();
  @Output() onSelect = new EventEmitter<any>();

  showContent: boolean = false;
  selectedValue: string = '';

  clear() {
    this.showContent = false;
    this.selectedValue = '';
    this.onClear.emit();
  }

  click() {
    this.showContent = true;
    this.selectedValue = '';
    this.onClick.emit();
  }

  select(event: any) {
    this.showContent = true;
    this.onSelect.emit(event.value);
  }
}
