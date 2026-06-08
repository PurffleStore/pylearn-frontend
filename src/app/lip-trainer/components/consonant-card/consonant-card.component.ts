import { Component, Input } from '@angular/core';
import { ConsonantCard } from '../../models/letter.model';

@Component({
  selector: 'app-consonant-card',
  templateUrl: './consonant-card.component.html',
  styleUrls: ['./consonant-card.component.scss']
})
export class ConsonantCardComponent {
  @Input() card!: ConsonantCard;
  @Input() compact = false;
}
