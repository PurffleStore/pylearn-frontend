import { Injectable } from '@angular/core';
import { VowelCard, ConsonantCard, LetterCard, NavLetter } from '../models/letter.model';

@Injectable({ providedIn: 'root' })
export class LipTrainerService {

  readonly vowelCards: VowelCard[] = [
    // ── A ──
    {
      letter: 'A', type: 'vowel', soundType: 'long', label: 'Long A',
      ipaSymbol: 'aː', lipShape: 'open-wide', accentColor: '#fce7f3',
      lipDesc: '😮 Open your mouth WIDE like a lion! Jaw drops down.',
      hint: '🦁 "aaa" — like when the doctor says "open wide!"',
      exampleWord: 'dag', exampleMeaning: '☀️ day'
    },
    {
      letter: 'A', type: 'vowel', soundType: 'short', label: 'Short A',
      ipaSymbol: 'a', lipShape: 'open-wide', accentColor: '#fce7f3',
      lipDesc: '😮 Open mouth — but shorter and quicker!',
      hint: '🐱 Quick "a" — like in "cat"',
      exampleWord: 'katt', exampleMeaning: '🐱 cat'
    },
    // ── E ──
    {
      letter: 'E', type: 'vowel', soundType: 'long', label: 'Long E',
      ipaSymbol: 'eː', lipShape: 'slight-smile', accentColor: '#ffedd5',
      lipDesc: '😊 Spread your lips like a little smile!',
      hint: '😁 "ay" — like when you say "hey!"',
      exampleWord: 'eld', exampleMeaning: '🔥 fire'
    },
    {
      letter: 'E', type: 'vowel', soundType: 'short', label: 'Short E',
      ipaSymbol: 'ɛ', lipShape: 'slight-smile', accentColor: '#ffedd5',
      lipDesc: '😊 Relaxed smile — short and quick!',
      hint: '✏️ Short "e" — like in "pen"',
      exampleWord: 'penna', exampleMeaning: '✏️ pen'
    },
    // ── I ──
    {
      letter: 'I', type: 'vowel', soundType: 'long', label: 'Long I',
      ipaSymbol: 'iː', lipShape: 'big-smile', accentColor: '#d1fae5',
      lipDesc: '😁 Big wide smile — say "cheese!" for a photo!',
      hint: '😁 "ee" — say "cheeese!" for the camera',
      exampleWord: 'is', exampleMeaning: '🧊 ice'
    },
    {
      letter: 'I', type: 'vowel', soundType: 'short', label: 'Short I',
      ipaSymbol: 'ɪ', lipShape: 'big-smile', accentColor: '#d1fae5',
      lipDesc: '😁 Wide smile — but short and snappy!',
      hint: '⚡ Quick smile — like "ick!"',
      exampleWord: 'fisk', exampleMeaning: '🐟 fish'
    },
    // ── O ──
    {
      letter: 'O', type: 'vowel', soundType: 'long', label: 'Long O',
      ipaSymbol: 'uː', lipShape: 'medium-round', accentColor: '#dbeafe',
      lipDesc: '😮 Make a round circle with your lips — like an "O"!',
      hint: '🌕 "oo" — round lips forward like a kiss',
      exampleWord: 'bok', exampleMeaning: '📚 book'
    },
    {
      letter: 'O', type: 'vowel', soundType: 'short', label: 'Short O',
      ipaSymbol: 'ɔ', lipShape: 'medium-round', accentColor: '#dbeafe',
      lipDesc: '😮 Round lips — but quick, like a short "oh"!',
      hint: '⚽ Quick round — like "ball"',
      exampleWord: 'boll', exampleMeaning: '⚽ ball'
    },
    // ── U ──
    {
      letter: 'U', type: 'vowel', soundType: 'long', label: 'Long U',
      ipaSymbol: 'ʉː', lipShape: 'tight-round', accentColor: '#cffafe',
      lipDesc: '😗 Make a tiny circle — like you\'re about to whistle!',
      hint: '🎵 Whistle shape — tightest round lips!',
      exampleWord: 'hus', exampleMeaning: '🏠 house'
    },
    {
      letter: 'U', type: 'vowel', soundType: 'short', label: 'Short U',
      ipaSymbol: 'ɵ', lipShape: 'tight-round', accentColor: '#cffafe',
      lipDesc: '😗 Tight little circle — but very quick!',
      hint: '⚡ Short whistle — quick tight lips',
      exampleWord: 'full', exampleMeaning: '🍽️ full'
    },
    // ── Y ──
    {
      letter: 'Y', type: 'vowel', soundType: 'long', label: 'Long Y',
      ipaSymbol: 'yː', lipShape: 'conflict-round', accentColor: '#ede9fe',
      lipDesc: '🤔 Tricky! Round lips AND tongue moves forward — try it!',
      hint: '🌟 Special Swedish sound — round lips + say "ee"',
      exampleWord: 'yxa', exampleMeaning: '🪓 axe'
    },
    {
      letter: 'Y', type: 'vowel', soundType: 'short', label: 'Short Y',
      ipaSymbol: 'ʏ', lipShape: 'conflict-round', accentColor: '#ede9fe',
      lipDesc: '🤔 Same tricky shape — but faster!',
      hint: '⚡ Short special Y — quick round + "ee"',
      exampleWord: 'rygg', exampleMeaning: '🔙 back'
    },
    // ── Å ──
    {
      letter: 'Å', type: 'vowel', soundType: 'long', label: 'Long Å',
      ipaSymbol: 'oː', lipShape: 'open-round', accentColor: '#e0e7ff',
      lipDesc: '😮 Open round mouth — push lips forward a little!',
      hint: '⛵ "oh" — open and round, like "awe"',
      exampleWord: 'båt', exampleMeaning: '⛵ boat'
    },
    {
      letter: 'Å', type: 'vowel', soundType: 'short', label: 'Short Å',
      ipaSymbol: 'ɔ', lipShape: 'open-round', accentColor: '#e0e7ff',
      lipDesc: '😮 Open round — but short and snappy!',
      hint: '8️⃣ Short "oh" — like counting "eight"',
      exampleWord: 'åtta', exampleMeaning: '8️⃣ eight'
    },
    // ── Ä ──
    {
      letter: 'Ä', type: 'vowel', soundType: 'long', label: 'Long Ä',
      ipaSymbol: 'ɛː', lipShape: 'slight-smile', accentColor: '#fef3c7',
      lipDesc: '😮 Mouth open + spread wide — like surprised!',
      hint: '🍽️ "aeh" — open and spread, like "eat"',
      exampleWord: 'äta', exampleMeaning: '🍽️ to eat'
    },
    {
      letter: 'Ä', type: 'vowel', soundType: 'short', label: 'Short Ä',
      ipaSymbol: 'ɛ', lipShape: 'slight-smile', accentColor: '#fef3c7',
      lipDesc: '😮 Open spread — but quick and light!',
      hint: '🥚 Short "eh" — like "egg"',
      exampleWord: 'ägg', exampleMeaning: '🥚 egg'
    },
    // ── Ö ──
    {
      letter: 'Ö', type: 'vowel', soundType: 'long', label: 'Long Ö',
      ipaSymbol: 'øː', lipShape: 'conflict-round', accentColor: '#fce7f3',
      lipDesc: '🎺 Trumpet lips! Round + push tongue forward.',
      hint: '🌸 "uh" but round — like "bird" with round lips',
      exampleWord: 'öra', exampleMeaning: '👂 ear'
    },
    {
      letter: 'Ö', type: 'vowel', soundType: 'short', label: 'Short Ö',
      ipaSymbol: 'œ', lipShape: 'conflict-round', accentColor: '#fce7f3',
      lipDesc: '🎺 Trumpet lips — short and quick!',
      hint: '⚡ Quick trumpet lips — short Ö',
      exampleWord: 'höst', exampleMeaning: '🍂 autumn'
    }
  ];

  readonly consonantCards: ConsonantCard[] = [
    { letter: 'B', type: 'consonant', label: 'B', ipaSymbol: 'b', lipShape: 'neutral', accentColor: '#e0f2fe', lipDesc: '👄 Press lips together, then let them pop open!', hint: '🚗 Same as "b" in English — "buh!"', exampleWord: 'bil', exampleMeaning: '🚗 car' },
    { letter: 'C', type: 'consonant', label: 'C', ipaSymbol: 's / k', lipShape: 'slight-smile', accentColor: '#dcfce7', lipDesc: '🚲 Before E/I/Y: say "s" — Before A/O: say "k"!', hint: '🎯 "s" or "k" — the next vowel decides!', exampleWord: 'cykel', exampleMeaning: '🚲 bicycle' },
    { letter: 'D', type: 'consonant', label: 'D', ipaSymbol: 'd', lipShape: 'neutral', accentColor: '#fef9c3', lipDesc: '👅 Touch tongue tip to the ridge behind top teeth!', hint: '☀️ Same as "d" in English — "duh!"', exampleWord: 'dag', exampleMeaning: '☀️ day' },
    { letter: 'F', type: 'consonant', label: 'F', ipaSymbol: 'f', lipShape: 'neutral', accentColor: '#fce7f3', lipDesc: '🐟 Put upper teeth on lower lip, then blow air out!', hint: '🐟 Same as "f" in English — "fff!"', exampleWord: 'fisk', exampleMeaning: '🐟 fish' },
    { letter: 'G', type: 'consonant', label: 'G', ipaSymbol: 'ɡ / j', lipShape: 'open-wide', accentColor: '#fef3c7', lipDesc: '😊 Hard "g" before A/O/U — soft "y" before E/I/Y!', hint: '✅ "g" or "y" sound — check the next letter!', exampleWord: 'god', exampleMeaning: '😋 good' },
    { letter: 'H', type: 'consonant', label: 'H', ipaSymbol: 'h', lipShape: 'open-wide', accentColor: '#e0f2fe', lipDesc: '🏠 Open mouth and breathe out gently — "hhhh"!', hint: '🏠 Same as "h" in English — soft breath', exampleWord: 'hus', exampleMeaning: '🏠 house' },
    { letter: 'J', type: 'consonant', label: 'J', ipaSymbol: 'j', lipShape: 'slight-smile', accentColor: '#dcfce7', lipDesc: '✅ Always sounds like "y" — like "yes" in English!', hint: '✅ Swedish J = English "y" — always!', exampleWord: 'ja', exampleMeaning: '✅ yes' },
    { letter: 'K', type: 'consonant', label: 'K', ipaSymbol: 'k / ɕ', lipShape: 'slight-smile', accentColor: '#fce7f3', lipDesc: '🐱 Hard "k" before A/O/U — soft "sh" before E/I/Y!', hint: '🐱 "k" or "sh" — the next vowel tells you!', exampleWord: 'katt', exampleMeaning: '🐱 cat' },
    { letter: 'L', type: 'consonant', label: 'L', ipaSymbol: 'l', lipShape: 'neutral', accentColor: '#ede9fe', lipDesc: '👅 Touch tongue tip to the roof of your mouth!', hint: '⭐ Same as "l" in English — clear "lll"', exampleWord: 'lamm', exampleMeaning: '🐑 lamb' },
    { letter: 'M', type: 'consonant', label: 'M', ipaSymbol: 'm', lipShape: 'neutral', accentColor: '#e0e7ff', lipDesc: '🍕 Close lips and hum through your nose — "mmm"!', hint: '🍕 Same as "m" in English — lips together hum', exampleWord: 'mat', exampleMeaning: '🍕 food' },
    { letter: 'N', type: 'consonant', label: 'N', ipaSymbol: 'n', lipShape: 'neutral', accentColor: '#fef9c3', lipDesc: '👅 Touch tongue to ridge, air goes through your nose!', hint: '🆕 Same as "n" in English — "nnn"', exampleWord: 'ny', exampleMeaning: '🆕 new' },
    { letter: 'P', type: 'consonant', label: 'P', ipaSymbol: 'p', lipShape: 'neutral', accentColor: '#fce7f3', lipDesc: '✏️ Press lips together then pop — "puh!"', hint: '✏️ Same as "p" in English — lip pop!', exampleWord: 'penna', exampleMeaning: '✏️ pen' },
    { letter: 'Q', type: 'consonant', label: 'Q', ipaSymbol: 'k', lipShape: 'neutral', accentColor: '#dcfce7', lipDesc: '🔤 Always written with V — sounds like "kv"!', hint: '🔤 Very rare — sounds like "kv" together', exampleWord: 'kvinna', exampleMeaning: '👩 woman' },
    { letter: 'R', type: 'consonant', label: 'R', ipaSymbol: 'r', lipShape: 'slight-smile', accentColor: '#e0f2fe', lipDesc: '🌹 Tap tongue tip on the ridge — gentle little roll!', hint: '🌹 Soft rolled "r" — tongue tip taps lightly', exampleWord: 'röd', exampleMeaning: '🔴 red' },
    { letter: 'S', type: 'consonant', label: 'S', ipaSymbol: 's', lipShape: 'slight-smile', accentColor: '#fef3c7', lipDesc: '🌞 Always a crisp "sss" — never a buzzy "z"!', hint: '🌞 Always "s" like in "sun" — never "z"', exampleWord: 'sol', exampleMeaning: '🌞 sun' },
    { letter: 'T', type: 'consonant', label: 'T', ipaSymbol: 't', lipShape: 'neutral', accentColor: '#ede9fe', lipDesc: '👅 Touch tongue tip to ridge, then let go — "tuh!"', hint: '🏠 Same as "t" in English — crisp and clear', exampleWord: 'tak', exampleMeaning: '🏠 roof' },
    { letter: 'V', type: 'consonant', label: 'V', ipaSymbol: 'v', lipShape: 'neutral', accentColor: '#fce7f3', lipDesc: '👫 Upper teeth on lower lip, buzz with your voice!', hint: '👫 Same as "v" in English — voiced buzz', exampleWord: 'vän', exampleMeaning: '👫 friend' },
    { letter: 'W', type: 'consonant', label: 'W', ipaSymbol: 'v', lipShape: 'neutral', accentColor: '#e0e7ff', lipDesc: '🌐 Sounds exactly like V in Swedish!', hint: '🌐 Rare — just say "v" instead!', exampleWord: 'webb', exampleMeaning: '🌐 web' },
    { letter: 'X', type: 'consonant', label: 'X', ipaSymbol: 'ks', lipShape: 'neutral', accentColor: '#dcfce7', lipDesc: '🎸 Two sounds in one — say "k" then "s" fast!', hint: '🎸 "ks" together — like "bOX"', exampleWord: 'extra', exampleMeaning: '⭐ extra' },
    { letter: 'Z', type: 'consonant', label: 'Z', ipaSymbol: 's', lipShape: 'slight-smile', accentColor: '#fef9c3', lipDesc: '🦓 Looks like Z but sounds like "S" in Swedish!', hint: '🦓 Rare — say "s", not "z"!', exampleWord: 'zoo', exampleMeaning: '🦓 zoo' }
  ];

  readonly navLetters: NavLetter[] = [
    { letter: 'A', type: 'vowel' }, { letter: 'B', type: 'consonant' },
    { letter: 'C', type: 'consonant' }, { letter: 'D', type: 'consonant' },
    { letter: 'E', type: 'vowel' }, { letter: 'F', type: 'consonant' },
    { letter: 'G', type: 'consonant' }, { letter: 'H', type: 'consonant' },
    { letter: 'I', type: 'vowel' }, { letter: 'J', type: 'consonant' },
    { letter: 'K', type: 'consonant' }, { letter: 'L', type: 'consonant' },
    { letter: 'M', type: 'consonant' }, { letter: 'N', type: 'consonant' },
    { letter: 'O', type: 'vowel' }, { letter: 'P', type: 'consonant' },
    { letter: 'Q', type: 'consonant' }, { letter: 'R', type: 'consonant' },
    { letter: 'S', type: 'consonant' }, { letter: 'T', type: 'consonant' },
    { letter: 'U', type: 'vowel' }, { letter: 'V', type: 'consonant' },
    { letter: 'W', type: 'consonant' }, { letter: 'X', type: 'consonant' },
    { letter: 'Y', type: 'vowel' }, { letter: 'Z', type: 'consonant' },
    { letter: 'Å', type: 'vowel' }, { letter: 'Ä', type: 'vowel' },
    { letter: 'Ö', type: 'vowel' }
  ];

  getVowelCards(letter: string): VowelCard[] {
    return this.vowelCards.filter(c => c.letter === letter);
  }

  getConsonantCard(letter: string): ConsonantCard | undefined {
    return this.consonantCards.find(c => c.letter === letter);
  }

  getAllCards(): LetterCard[] {
    return [...this.vowelCards, ...this.consonantCards];
  }
}
