import { Component, Input } from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [NgClass],
  template: `
    <button [type]="type" [ngClass]="class" [disabled]="disabled">
      <ng-content></ng-content>
    </button>
  `,
  styleUrls: ['./button.component.css']
})
export class ButtonComponent {
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() class = '';
  @Input() disabled = false;
}
