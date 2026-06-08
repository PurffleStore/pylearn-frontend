export type SoundType = 'long' | 'short';
export type LetterType = 'vowel' | 'consonant';
export type LipShape =
  | 'open-wide'
  | 'slight-smile'
  | 'big-smile'
  | 'medium-round'
  | 'tight-round'
  | 'open-round'
  | 'conflict-round'
  | 'neutral';

export interface VowelCard {
  letter: string;
  type: 'vowel';
  soundType: SoundType;
  label: string;           // e.g. "Long A"
  ipaSymbol: string;       // e.g. "aː"
  lipShape: LipShape;
  lipDesc: string;
  hint: string;            // one-line sound hint
  accentColor: string;     // pastel hex
  exampleWord: string;     // Swedish word
  exampleMeaning: string;
}

export interface ConsonantCard {
  letter: string;
  type: 'consonant';
  label: string;           // e.g. "Consonant B"
  ipaSymbol: string;
  lipShape: LipShape;
  lipDesc: string;
  hint: string;
  accentColor: string;
  exampleWord: string;
  exampleMeaning: string;
}

export type LetterCard = VowelCard | ConsonantCard;

export interface NavLetter {
  letter: string;
  type: LetterType;
}
