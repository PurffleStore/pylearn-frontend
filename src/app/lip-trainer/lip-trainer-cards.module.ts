import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VowelCardComponent } from './components/vowel-card/vowel-card.component';
import { ConsonantCardComponent } from './components/consonant-card/consonant-card.component';

/**
 * LipTrainerCardsModule
 * ---------------------
 * Declares and exports the reusable pronunciation card components:
 *   - <app-vowel-card>     — for all 9 Swedish vowels (long & short)
 *   - <app-consonant-card> — for all 20 Swedish consonants
 *
 * Import this module in any feature module that needs to display
 * Lip Trainer cards.
 *
 * Data is supplied via LipTrainerService (providedIn: 'root'),
 * and models live in ./models/letter.model.ts.
 *
 * Usage example:
 *   <app-vowel-card [card]="myVowelCard"></app-vowel-card>
 *   <app-consonant-card [card]="myConsonantCard"></app-consonant-card>
 *   <app-vowel-card [card]="myVowelCard" [compact]="true"></app-vowel-card>
 */
@NgModule({
  declarations: [
    VowelCardComponent,
    ConsonantCardComponent,
  ],
  imports: [
    CommonModule,
  ],
  exports: [
    VowelCardComponent,
    ConsonantCardComponent,
  ],
})
export class LipTrainerCardsModule {}
