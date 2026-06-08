import { Component, Input } from '@angular/core';
import { VowelCard } from '../../models/letter.model';

@Component({
  selector: 'app-vowel-card',
  templateUrl: './vowel-card.component.html',
  styleUrls: ['./vowel-card.component.scss']
})
export class VowelCardComponent {
  @Input() card!: VowelCard;
  @Input() compact = false;
}
