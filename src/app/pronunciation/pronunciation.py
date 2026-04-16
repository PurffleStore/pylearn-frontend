import os
import re
import torch
import tempfile
import subprocess
import soundfile as sf
import numpy as np
import base64
import random
import chromadb
import eng_to_ipa as ipa
from flask import Blueprint, jsonify, request
from transformers import Wav2Vec2Processor, Wav2Vec2ForCTC, Wav2Vec2Model, Wav2Vec2ConformerForCTC, WhisperProcessor, WhisperForConditionalGeneration
from collections import Counter
import json
import time
import traceback
import platform

# ==================================================
# TEXT TO PHONEME CONVERSION FOR NON-PHONEME MODELS
# ==================================================

def text_to_phonemes(text):
    """Convert English text to approximate phonemes"""
    word = text.lower().strip()
    
    # Common word mappings (expand as needed)
    word_to_phonemes = {
        # A words
        "a": ["ə"],
        "about": ["ə", "b", "aʊ", "t"],
        "apple": ["æ", "p", "ə", "l"],
        
        # B words
        "ball": ["b", "ɔ", "l"],
        "banana": ["b", "ə", "n", "æ", "n", "ə"],
        
        # C words
        "cat": ["k", "æ", "t"],
        "car": ["k", "ɑː", "r"],
        
        # D words
        "dog": ["d", "ɒ", "g"],
        "door": ["d", "ɔː", "r"],
        
        # E words
        "egg": ["ɛ", "g"],
        "elephant": ["ɛ", "l", "ə", "f", "ə", "n", "t"],
        
        # F words
        "fish": ["f", "ɪ", "ʃ"],
        "fox": ["f", "ɒ", "k", "s"],
        
        # G words
        "grapes": ["g", "r", "e", "ɪ", "p", "s"],
        "goat": ["g", "əʊ", "t"],
        
        # H words
        "hat": ["h", "æ", "t"],
        "house": ["h", "aʊ", "s"],
        
        # I words
        "ice": ["aɪ", "s"],
        "ice cream": ["a", "ɪ", "s", "k", "r", "iː", "m"],
        
        # J words
        "jar": ["dʒ", "ɑː", "r"],
        "juice": ["dʒ", "uː", "s"],
        
        # K words
        "kite": ["k", "aɪ", "t"],
        "king": ["k", "ɪ", "ŋ"],
        
        # L words
        "lion": ["l", "aɪ", "ə", "n"],
        "leaf": ["l", "iː", "f"],
        
        # M words
        "moon": ["m", "uː", "n"],
        "mouse": ["m", "aʊ", "s"],
        
        # N words
        "nest": ["n", "ɛ", "s", "t"],
        "nose": ["n", "əʊ", "z"],
        
        # O words
        "orange": ["ɒ", "r", "ə", "n", "dʒ"],
        "octopus": ["ɒ", "k", "t", "ə", "p", "ə", "s"],
        
        # P words
        "pig": ["p", "ɪ", "g"],
        "pen": ["p", "ɛ", "n"],
        
        # Q words
        "queen": ["k", "w", "iː", "n"],
        
        # R words
        "rabbit": ["r", "æ", "b", "ɪ", "t"],
        "rain": ["r", "eɪ", "n"],
        
        # S words
        "sun": ["s", "ʌ", "n"],
        "star": ["s", "t", "ɑː", "r"],
        
        # T words
        "tree": ["t", "r", "iː"],
        "table": ["t", "eɪ", "b", "ə", "l"],
        
        # U words
        "umbrella": ["ʌ", "m", "b", "r", "ɛ", "l", "ə"],
        
        # V words
        "van": ["v", "æ", "n"],
        "violin": ["v", "aɪ", "ə", "l", "ɪ", "n"],
        
        # W words
        "watch": ["w", "ɒ", "tʃ"],
        "water": ["w", "ɔː", "t", "ə"],
        
        # X words
        "xylophone": ["z", "aɪ", "l", "ə", "f", "əʊ", "n"],
        
        # Y words
        "yarn": ["j", "ɑː", "n"],
        "yellow": ["j", "ɛ", "l", "əʊ"],
        
        # Z words
        "zebra": ["z", "ɛ", "b", "r", "ə"],
        "zoo": ["z", "uː"],
    }
    
    # Check if word is in our mapping
    if word in word_to_phonemes:
        return word_to_phonemes[word]
    
    # Fallback: return characters (better than nothing)
    return [c for c in word if c.isalpha()]

# Import video functions from separate module
try:
    from video_metadata import build_feedback_video
    print("✅ Successfully imported video_metadata")
except ImportError as e:
    print(f"⚠️ Warning: Could not import video_metadata: {e}")
    def build_feedback_video(**kwargs):
        return ""



def get_espeak_library_path():
    """Get eSpeak library path based on operating system"""
    system = platform.system()
    
    if system == "Windows":
        return r'C:\Program Files\eSpeak NG\libespeak-ng.dll'
    elif system == "Darwin":  # macOS
        return '/usr/local/lib/libespeak-ng.dylib'
    else:  # Linux
        paths = [
            '/usr/lib/x86_64-linux-gnu/libespeak-ng.so.1',
            '/usr/lib/libespeak-ng.so.1',
            '/usr/lib/aarch64-linux-gnu/libespeak-ng.so.1',
        ]
        for path in paths:
            if os.path.exists(path):
                return path
        return None

# Set eSpeak library path
ESPEAK_LIB_PATH = get_espeak_library_path()

if ESPEAK_LIB_PATH:
    os.environ['PHONEMIZER_ESPEAK_LIBRARY'] = ESPEAK_LIB_PATH
    print(f"✅ eSpeak library found at: {ESPEAK_LIB_PATH}")
    
    if platform.system() == "Linux":
        data_paths = [
            '/usr/share/espeak-ng-data',
            '/usr/lib/x86_64-linux-gnu/espeak-ng-data',
        ]
        for data_path in data_paths:
            if os.path.exists(data_path):
                os.environ['ESPEAK_DATA_PATH'] = data_path
                print(f"✅ eSpeak data path set to: {data_path}")
                break
else:
    print(f"❌ eSpeak library NOT found")
    print("Please ensure eSpeak-ng is installed:")
    print("  - Windows: Download from https://github.com/espeak-ng/espeak-ng/releases")
    print("  - Linux: apt-get install espeak-ng")
    print("  - macOS: brew install espeak-ng")

# ==================================================
# ==================================================
# CREATE BLUEPRINT (ONLY ONCE!)
# ==================================================
print("🔧 Creating pronunciation blueprint...")
pronunciation_bp = Blueprint("pronunciation", __name__)
print(f"✅ Blueprint created: {pronunciation_bp.name}")

# ==================================================
# TEST ROUTE - Place this AFTER blueprint creation
# ==================================================
@pronunciation_bp.route("/test", methods=["GET"])
def test_route():
    print("⚡ Test route called successfully!")
    return jsonify({
        "success": True,
        "message": "Pronunciation blueprint is working!",
        "endpoints": ["/test", "/score"]
    })

# ==================================================
# 1. SETUP & CONFIG
# ==================================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
print("BASE_DIR:", BASE_DIR)
VIDEO_PATH = os.path.join(BASE_DIR, "assets/feedback.mp4")
CHROMA_DIR = os.path.join(BASE_DIR, "assets/chroma_db")

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using device: {DEVICE}")

# Initialize ChromaDB
client = chromadb.PersistentClient(path=CHROMA_DIR)
collection = client.get_or_create_collection("feedback")
# Initialize video functions
from video_metadata import init_video_functions, populate_sample_videos
init_video_functions(VIDEO_PATH, collection)

# Populate sample videos if database is empty
if collection.count() == 0:
    print("📹 Populating video database with samples...")
    populate_sample_videos(collection, VIDEO_PATH)

# ==================================================
# 2. MULTI-MODEL CONFIGURATION
# ==================================================
MODEL_CONFIGS = [
    {
        # 1. THE PHONETIC SPECIALIST (UK EN-GB)
        "name": "UK-Phonetic-Master",
        "model_id": "facebook/wav2vec2-lv-60-espeak-cv-ft",
        "weight": 1.5, 
        "phoneme_output": True,
        "description": "Fine-tuned with eSpeak-NG for British English IPA outputs."
    },
    {
        # 2. THE KIDS' SPEECH SPECIALIST
        "name": "Wav2Vec2-Kids-Robust",
        "model_id": "facebook/wav2vec2-base-960h",
        "weight": 1.2,
        "phoneme_output": False,
        "description": "Base model for general speech recognition."
    }
   
]

# Load all models
models = []
print("\n" + "="*60)
print("🚀 LOADING MULTI-MODEL ENSEMBLE")
print("="*60)

for config in MODEL_CONFIGS:
    try:
        print(f"\n📦 Loading {config['name']}...")
        
        # Handle Whisper separately
        if "whisper" in config["model_id"].lower() or config["name"] == "Whisper-Medium-UK":
            print(f"  Using WhisperProcessor and WhisperForConditionalGeneration")
            processor = WhisperProcessor.from_pretrained(config["model_id"])
            model = WhisperForConditionalGeneration.from_pretrained(config["model_id"]).to(DEVICE)
        # Handle Conformer
        elif "conformer" in config["model_id"].lower() or config["name"] == "Conformer-Local":
            print(f"  Using Wav2Vec2ConformerForCTC")
            processor = Wav2Vec2Processor.from_pretrained(config["model_id"])
            model = Wav2Vec2ConformerForCTC.from_pretrained(
                config["model_id"],
                low_cpu_mem_usage=True
            ).to(DEVICE)
        else:
            # Regular Wav2Vec2 models
            processor = Wav2Vec2Processor.from_pretrained(config["model_id"])
            model = Wav2Vec2ForCTC.from_pretrained(config["model_id"]).to(DEVICE)
        
        model.eval()
        
        models.append({
            "name": config["name"],
            "model": model,
            "processor": processor,
            "weight": config["weight"],
            "phoneme_output": config["phoneme_output"]
        })
        print(f"  ✅ {config['name']} loaded successfully")
        
    except Exception as e:
        print(f"  ❌ Failed to load {config['name']}: {e}")
        traceback.print_exc()

# ==================================================
# 3. WORD TO PHONEME MAPPING (UK Pronunciation)
# ==================================================
WORD_TO_PHONEMES = {
    "apple": ["æ", "p", "ə", "l"],
    "ball": ["b", "ɔ", "l"],
    "cat": ["k", "æ", "t"],
    "dog": ["d", "ɒ", "g"],
    "egg": ["ɛ", "g"],
    "fish": ["f", "ɪ", "ʃ"],
    "grapes": ["g", "r", "e", "ɪ", "p", "s"],
    "hat": ["h", "æ", "t"],
    "ice cream": ["a", "ɪ", "s", "k", "r", "i", "m"],
    "jar": ["dʒ", "ɑ", "r"],
    "kite": ["k", "a", "ɪ", "t"],
    "lion": ["l", "a", "ɪ", "ə", "n"],
    "moon": ["m", "u", "n"],
    "nest": ["n", "ɛ", "s", "t"],
    "orange": ["ɒ", "r", "ə", "n", "dʒ"],
    "pig": ["p", "ɪ", "g"],
    "queen": ["k", "w", "i", "n"],
    "rabbit": ["r", "æ", "b", "ɪ", "t"],
    "sun": ["s", "ʌ", "n"],
    "tree": ["t", "r", "i"],
    "umbrella": ["ʌ", "m", "b", "r", "ɛ", "l", "ə"],
    "van": ["v", "æ", "n"],
    "watch": ["w", "ɒ", "tʃ"],
    "xylophone": ["z", "a", "ɪ", "l", "ə", "f", "o", "ʊ", "n"],
    "yarn": ["j", "ɑ", "n"],
    "zebra": ["z", "ɛ", "b", "r", "ə"],
}

# ==================================================
# 4. UK PHONEME DATABASE
# ==================================================
UK_PHONEME_DB = {
    "ɪ": {"name": "KIT vowel", "example": "sit", "tip": "Short front vowel", "type": "vowel"},
    "i": {"name": "FLEECE vowel", "example": "see", "tip": "Long front vowel", "type": "vowel"},
    "ʊ": {"name": "FOOT vowel", "example": "put", "tip": "Short rounded back vowel", "type": "vowel"},
    "u": {"name": "GOOSE vowel", "example": "too", "tip": "Long rounded back vowel", "type": "vowel"},
    "e": {"name": "DRESS vowel", "example": "bed", "tip": "Short mid front vowel", "type": "vowel"},
    "ɛ": {"name": "DRESS vowel", "example": "bed", "tip": "Short mid front vowel", "type": "vowel"},
    "ə": {"name": "SCHWA", "example": "about", "tip": "Relaxed central vowel", "type": "vowel"},
    "ɜ": {"name": "NURSE vowel", "example": "bird", "tip": "Long central vowel", "type": "vowel"},
    "ɔ": {"name": "THOUGHT vowel", "example": "law", "tip": "Long open-mid back vowel", "type": "vowel"},
    "æ": {"name": "TRAP vowel", "example": "cat", "tip": "Short open front vowel", "type": "vowel"},
    "ʌ": {"name": "STRUT vowel", "example": "cup", "tip": "Short mid back vowel", "type": "vowel"},
    "ɑ": {"name": "BATH vowel", "example": "father", "tip": "Long open back vowel", "type": "vowel"},
    "ɒ": {"name": "LOT vowel", "example": "hot", "tip": "Short open back rounded vowel", "type": "vowel"},
    "a": {"name": "TRAP/BATH vowel", "example": "cat/father", "tip": "Open front vowel", "type": "vowel"},
    "p": {"name": "voiceless bilabial plosive", "example": "pen", "tip": "Explosive 'p' sound", "type": "consonant"},
    "b": {"name": "voiced bilabial plosive", "example": "bad", "tip": "Voiced 'b' with vibration", "type": "consonant"},
    "t": {"name": "voiceless alveolar plosive", "example": "tea", "tip": "Tongue tip on alveolar ridge", "type": "consonant"},
    "d": {"name": "voiced alveolar plosive", "example": "did", "tip": "Voiced 'd' with vibration", "type": "consonant"},
    "k": {"name": "voiceless velar plosive", "example": "cat", "tip": "Back of tongue on soft palate", "type": "consonant"},
    "g": {"name": "voiced velar plosive", "example": "get", "tip": "Voiced 'g' with vibration", "type": "consonant"},
    "tʃ": {"name": "voiceless palato-alveolar affricate", "example": "chin", "tip": "Combination of 't' and 'ʃ'", "type": "consonant"},
    "dʒ": {"name": "voiced palato-alveolar affricate", "example": "jam", "tip": "Combination of 'd' and 'ʒ'", "type": "consonant"},
    "f": {"name": "voiceless labiodental fricative", "example": "fall", "tip": "Upper teeth on lower lip", "type": "consonant"},
    "v": {"name": "voiced labiodental fricative", "example": "van", "tip": "Voiced version of 'f'", "type": "consonant"},
    "θ": {"name": "voiceless dental fricative", "example": "thin", "tip": "Tongue between teeth, no vibration", "type": "consonant"},
    "ð": {"name": "voiced dental fricative", "example": "then", "tip": "Tongue between teeth, with vibration", "type": "consonant"},
    "s": {"name": "voiceless alveolar fricative", "example": "see", "tip": "Hissing 's' sound", "type": "consonant"},
    "z": {"name": "voiced alveolar fricative", "example": "zoo", "tip": "Voiced 'z' sound", "type": "consonant"},
    "ʃ": {"name": "voiceless palato-alveolar fricative", "example": "she", "tip": "'Sh' sound, tongue raised", "type": "consonant"},
    "ʒ": {"name": "voiced palato-alveolar fricative", "example": "pleasure", "tip": "Voiced 'zh' sound", "type": "consonant"},
    "h": {"name": "voiceless glottal fricative", "example": "hot", "tip": "Breathy 'h' from throat", "type": "consonant"},
    "m": {"name": "bilabial nasal", "example": "man", "tip": "Humming 'm' with lips closed", "type": "consonant"},
    "n": {"name": "alveolar nasal", "example": "no", "tip": "Tongue on alveolar ridge", "type": "consonant"},
    "ŋ": {"name": "velar nasal", "example": "sing", "tip": "'Ng' sound, back of tongue up", "type": "consonant"},
    "l": {"name": "alveolar lateral approximant", "example": "let", "tip": "Tongue tip on alveolar ridge", "type": "consonant"},
    "r": {"name": "alveolar approximant", "example": "red", "tip": "UK 'r' is soft", "type": "consonant"},
    "ɹ": {"name": "alveolar approximant", "example": "red", "tip": "Alternative 'r'", "type": "consonant"},
    "j": {"name": "palatal approximant", "example": "yes", "tip": "'Y' sound", "type": "consonant"},
    "w": {"name": "labio-velar approximant", "example": "we", "tip": "Round lips", "type": "consonant"},
}

# ==================================================
# 5. ESPEAK TO UK PHONEME TRANSLATION LAYER
# ==================================================
ESPEAK_TO_UK_MAP = {
    'ɡ': 'g', 'g': 'g', 'ɹ': 'r', 'r': 'r',
    'a': 'æ', 'I': 'ɪ', 'U': 'ʊ', 'V': 'ʌ', '@': 'ə', 'E': 'ɛ', '{': 'æ',
    'A': 'ɑ', 'A:': 'ɑ', 'Aː': 'ɑ',
    'Q': 'ɒ', 'Q:': 'ɒ', 'Qː': 'ɒ', 'ɒ': 'ɒ',
    'O': 'ɔ', 'O:': 'ɔ', 'Oː': 'ɔ', 'ɔ': 'ɔ', 'o': 'ɔ', 'o:': 'ɔ', 'oː': 'ɔ',
    'i': 'i', 'u': 'u', '3': 'ɜ',
    'aI': 'aɪ', 'aU': 'aʊ', 'eI': 'eɪ', 'oU': 'əʊ', 'OI': 'ɔɪ',
    'I@': 'ɪə', 'e@': 'eə', 'U@': 'ʊə', '@U': 'əʊ',
    'T': 'θ', 'D': 'ð', 'S': 'ʃ', 'Z': 'ʒ', 'tS': 'tʃ', 'dZ': 'dʒ', 'N': 'ŋ',
    'p': 'p', 'b': 'b', 't': 't', 'd': 'd', 'k': 'k', 'g': 'g',
    'f': 'f', 'v': 'v', 's': 's', 'z': 'z', 'h': 'h',
    'm': 'm', 'n': 'n', 'l': 'l', 'r': 'r', 'j': 'j', 'w': 'w',
}

def translate_espeak_to_uk(espeak_phonemes, word=None):
    """Convert eSpeak phonemes to UK phoneme symbols"""
    if not espeak_phonemes:
        return []
    
    uk_phonemes = []
    i = 0
    
    while i < len(espeak_phonemes):
        current = espeak_phonemes[i]
        
        # Diphthong splitting
        if current in ['aɪ', 'aI', 'ai', 'ɐɪ']:
            uk_phonemes.extend(['a', 'ɪ'])
        elif current in ['eɪ', 'eI', 'ei', 'ɛɪ']:
            uk_phonemes.extend(['e', 'ɪ'])
        elif current in ['ɔɪ', 'ɔI', 'oi', 'oɪ']:
            uk_phonemes.extend(['ɔ', 'ɪ'])
        elif current in ['aʊ', 'aU', 'au', 'ɐʊ']:
            uk_phonemes.extend(['a', 'ʊ'])
        elif current in ['oʊ', 'oU', 'ou']:
            uk_phonemes.extend(['o', 'ʊ'])
        elif current in ['əʊ', '@U', 'əU']:
            uk_phonemes.extend(['ə', 'ʊ'])
        elif current in ['ɪə', 'I@', 'ɪ@', 'iə']:
            uk_phonemes.extend(['ɪ', 'ə'])
        elif current in ['eə', 'e@', 'ɛə']:
            uk_phonemes.extend(['e', 'ə'])
        elif current in ['ʊə', 'U@', 'ʊ@']:
            uk_phonemes.extend(['ʊ', 'ə'])
        
        # Long vowels
        elif current in ['iː', 'i:']:
            uk_phonemes.append('i')
        elif current in ['uː', 'u:']:
            uk_phonemes.append('u')
        elif current in ['ɑː', 'ɑ:']:
            uk_phonemes.append('ɑ')
        elif current in ['ɔː', 'ɔ:']:
            uk_phonemes.append('ɔ')
        elif current in ['ɜː', 'ɜ:']:
            uk_phonemes.append('ɜ')
        
        # Unicode fixes
        elif current == 'ɡ':
            uk_phonemes.append('g')
        elif current == 'ɹ':
            uk_phonemes.append('r')
        
        # Context-aware mappings
        elif word == "dog" and current == 'ɑ':
            uk_phonemes.append('ɒ')
        elif word == "jar" and current == 'ɑ':
            uk_phonemes.append('ɑ')
        elif word == "sun" and current == 'a':
            uk_phonemes.append('ʌ')
        elif word == "zebra" and current == 'i':
            uk_phonemes.append('ɛ')
        elif word == "zebra" and current in ['aː', 'a:', 'a']:
            uk_phonemes.append('ə')
        elif word == "lion" and current == 'j':
            uk_phonemes.append('ɪ')
        
        # Regular map lookup
        elif current in ESPEAK_TO_UK_MAP:
            uk_phonemes.append(ESPEAK_TO_UK_MAP[current])
        else:
            uk_phonemes.append(current)
        
        i += 1
    
    return uk_phonemes

# ==================================================
# 6. PHONETIC SIMILARITY FUNCTIONS
# ==================================================

def get_phoneme_family(phoneme):
    """Get the phonetic family of a phoneme for better similarity matching"""
    
    # Vowel families
    vowel_families = {
        'front_close': ['i', 'iː', 'ɪ'],
        'front_mid': ['e', 'eɪ', 'ɛ', 'eə'],
        'front_open': ['æ', 'a', 'aː', 'ʌ'],
        'central': ['ə', 'ɜ', 'ɜː', 'ɐ'],
        'back_open': ['ɑ', 'ɑː', 'ɒ'],
        'back_mid': ['ɔ', 'ɔː', 'o', 'oʊ', 'əʊ'],
        'back_close': ['u', 'uː', 'ʊ'],
    }
    
    # Consonant families
    consonant_families = {
        'plosive_voiceless': ['p', 't', 'k', 'ʔ'],
        'plosive_voiced': ['b', 'd', 'g'],
        'fricative_voiceless': ['f', 'θ', 's', 'ʃ', 'h', 'x'],
        'fricative_voiced': ['v', 'ð', 'z', 'ʒ'],
        'affricate': ['tʃ', 'dʒ'],
        'nasal': ['m', 'n', 'ŋ'],
        'approximant': ['l', 'r', 'ɹ', 'j', 'w', 'ɾ'],
    }
    
    # Check each family
    for family_name, members in vowel_families.items():
        if phoneme in members:
            return ('vowel', family_name, members)
    
    for family_name, members in consonant_families.items():
        if phoneme in members:
            return ('consonant', family_name, members)
    
    return ('unknown', 'unknown', [phoneme])

def are_phonetically_similar(p1, p2):
    """
    Enhanced phonetic similarity check
    Returns a similarity score between 0 and 1
    """
    if p1 == p2:
        return 1.0
    
    # Get families
    type1, family1, members1 = get_phoneme_family(p1)
    type2, family2, members2 = get_phoneme_family(p2)
    
    # Different types (vowel vs consonant) are not similar
    if type1 != type2:
        return 0.0
    
    # Same family - very similar
    if family1 == family2:
        return 0.9
    
    # Related families - somewhat similar
    related_pairs = [
        ('front_close', 'front_mid'),
        ('front_mid', 'front_open'),
        ('front_open', 'central'),
        ('central', 'back_open'),
        ('back_open', 'back_mid'),
        ('back_mid', 'back_close'),
    ]
    
    if (family1, family2) in related_pairs or (family2, family1) in related_pairs:
        return 0.7
    
    # Common substitutions
    common_subs = [
        ('θ', 't'), ('θ', 'f'), ('θ', 's'),
        ('ð', 'd'), ('ð', 'v'), ('ð', 'z'),
        ('ŋ', 'n'), ('ŋ', 'ng'),
        ('r', 'ɹ'), ('r', 'ɾ'),
        ('a', 'æ'), ('a', 'ʌ'), ('a', 'ɑ'),
        ('e', 'ə'), ('e', 'ɛ'), ('e', 'ɪ'),
        ('o', 'ɒ'), ('o', 'ɔ'), ('o', 'əʊ'),
    ]
    
    if (p1, p2) in common_subs or (p2, p1) in common_subs:
        return 0.8
    
    return 0.0

def calculate_word_similarity(phonemes1, phonemes2):
    """
    Calculate phonetic similarity between two phoneme sequences
    Returns percentage (0-100)
    """
    if not phonemes1 or not phonemes2:
        return 0
    
    # Normalize both sequences
    norm1 = normalize_phonemes_for_comparison(phonemes1)
    norm2 = normalize_phonemes_for_comparison(phonemes2)
    
    # Use Needleman-Wunsch for optimal alignment
    m, n = len(norm1), len(norm2)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    
    # Initialize with gap penalties
    for i in range(1, m + 1):
        dp[i][0] = dp[i-1][0] - 1
    for j in range(1, n + 1):
        dp[0][j] = dp[0][j-1] - 1
    
    # Fill matrix
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            # Calculate match score
            similarity = are_phonetically_similar(norm1[i-1], norm2[j-1])
            match_score = dp[i-1][j-1] + (2 if similarity == 1.0 else similarity)
            
            # Gap penalties
            delete_score = dp[i-1][j] - 1
            insert_score = dp[i][j-1] - 1
            
            dp[i][j] = max(match_score, delete_score, insert_score)
    
    # Calculate similarity percentage
    max_possible = max(m, n) * 2
    actual_score = dp[m][n]
    similarity = (actual_score / max_possible) * 100
    
    return similarity

def normalize_phonemes_for_comparison(phonemes):
    """
    Normalize phonemes for better comparison
    """
    normalized = []
    for p in phonemes:
        # Handle common variations
        if p == 'aɪ' or p == 'aI':
            normalized.extend(['a', 'ɪ'])
        elif p == 'eɪ' or p == 'eI':
            normalized.extend(['e', 'ɪ'])
        elif p == 'əʊ' or p == '@U':
            normalized.extend(['ə', 'ʊ'])
        elif p == 'aʊ' or p == 'aU':
            normalized.extend(['a', 'ʊ'])
        elif p == 'ɔɪ' or p == 'OI':
            normalized.extend(['ɔ', 'ɪ'])
        elif p == 'iː' or p == 'i:':
            normalized.append('i')
        elif p == 'uː' or p == 'u:':
            normalized.append('u')
        elif p == 'ɑː' or p == 'ɑ:':
            normalized.append('ɑ')
        elif p == 'ɔː' or p == 'ɔ:':
            normalized.append('ɔ')
        elif p == 'ɜː' or p == 'ɜ:':
            normalized.append('ɜ')
        else:
            normalized.append(p)
    return normalized

def verify_word_match(model_results, target_word, target_phonemes):
    """Check if spoken word matches target using phonetic similarity"""
    print("\n🔍 Verifying word match:")
    
    # Check for multiple words by length FIRST
    target_length = len(target_phonemes)
    for result in model_results:
        if len(result["phonemes"]) > target_length * 2:
            print(f"  ⚠️ Multiple words detected! {result['name']} has {len(result['phonemes'])} sounds, target has {target_length}")
            return "MULTIPLE_WORDS", 0, result["text"], 0, result["phonemes"]
    
    best_match = None
    best_confidence = 0
    best_text = ""
    best_similarity = 0
    best_phonemes = []
    
    for result in model_results:
        if "text" in result:
            spoken = result["text"].lower().strip()
            confidence = result["confidence"]
            spoken_phonemes = result["phonemes"]
            
            print(f"  {result['name']}: '{spoken}' (conf: {confidence:.3f})")
            
            # Calculate similarity
            similarity = calculate_word_similarity(spoken_phonemes, target_phonemes)
            print(f"    Phonetic similarity: {similarity:.1f}%")
            
            # Combined score
            combined_score = confidence * (similarity / 100 + 0.5)
            
            if combined_score > best_confidence:
                best_confidence = combined_score
                best_text = spoken
                best_match = result
                best_similarity = similarity
                best_phonemes = spoken_phonemes
    
    # ADJUSTED THRESHOLDS for better accuracy
    if best_similarity >= 65:
        print(f"  ✅ Good match: '{best_text}' for '{target_word}' ({best_similarity:.1f}%)")
        return True, best_confidence, best_text, best_similarity, best_phonemes
    elif best_similarity >= 50:
        if best_confidence > 0.9:
            print(f"  ⚠️ Acceptable match: '{best_text}' for '{target_word}' ({best_similarity:.1f}%)")
            return True, best_confidence * 0.9, best_text, best_similarity, best_phonemes
        else:
            print(f"  ❌ Low confidence match: '{best_text}'")
            return False, best_confidence * 0.5, best_text, best_similarity, best_phonemes
    else:
        print(f"  ❌ No match: '{best_text}' != '{target_word}'")
        return False, best_confidence * 0.3, best_text, best_similarity, best_phonemes

# ==================================================
# 7. VOWEL NORMALIZATION
# ==================================================

def normalize_vowels(phonemes, word):
    """Convert common vowel variations to UK standard"""
    if not phonemes:
        return phonemes
    
    vowel_fixes = {
        "apple": {
            'a': 'æ', 'aː': 'æ', 'ɑ': 'æ',
            'e': 'ə', 'ɛ': 'ə', 'ʌ': 'ə', 'o': 'ə', 'u': 'ə', 'ʉ': 'ə'
        },
        "fish": {
            'i': 'ɪ', 'iː': 'ɪ',
        },
        "ball": {
            'o': 'ɔ', 'oː': 'ɔ', 'ɑ': 'ɔ', 'əʊ': 'ɔ'
        },
        "cat": {
            'a': 'æ', 'aː': 'æ', 'ɑ': 'æ', 'e': 'æ'
        },
        "dog": {
            'o': 'ɒ', 'oː': 'ɒ', 'ɔ': 'ɒ', 'ɑ': 'ɒ', 'əʊ': 'ɒ'
        },
        "lion": {
            'e': 'ə', 'ɛ': 'ə', 'ʌ': 'ə', 'i': 'ə',
            'j': 'ɪ',
        },
        "moon": {
            'o': 'u', 'oː': 'u', 'uː': 'u',
            'ʌ': 'u', 'ə': 'u',
        },
        "orange": {
            'o': 'ɒ', 'oː': 'ɒ',
            'e': 'ə', 'ɛ': 'ə',
        },
        "sun": {
            'a': 'ʌ', 'ɑ': 'ʌ', 'ə': 'ʌ'
        },
        "egg": {
            'e': 'ɛ', 'eː': 'ɛ', 'i': 'ɛ'
        },
        "ice cream": {
            'i': 'i', 'iː': 'i',
            'a': 'a', 'aɪ': 'aɪ',
        },
        "hat": {
            'a': 'æ', 'aː': 'æ', 'ɑ': 'æ',
        },
        "watch": {
            'a': 'ɒ', 'ɑ': 'ɒ',  # Fix vowel for watch
        },
        "xylophone": {
            'aɪ': 'aɪ',  # Keep diphthong
            'ʌ': 'ə',     # Fix schwa
            'uː': 'ʊ',    # Fix long u to short u
            'y': 'ɪ',     # Fix common XLSR substitution
        }
    }
    
    if word not in vowel_fixes:
        return phonemes
    
    fixes = vowel_fixes[word]
    normalized = [fixes.get(p, p) for p in phonemes]
    
    changes = [(p, normalized[i]) for i, p in enumerate(phonemes) 
               if p != normalized[i]]
    if changes:
        print(f"  🔧 Vowel fixes: {changes}")
    
    return normalized

# ==================================================
# 8. ENSEMBLE TRANSCRIPTION
# ==================================================

def ensemble_transcribe(audio_array, sample_rate):
    """Run audio through all models and combine results"""
    model_results = []
    
    for model_info in models:
        try:
            name = model_info["name"]
            model = model_info["model"]
            processor = model_info["processor"]
            weight = model_info["weight"]
            phoneme_output = model_info["phoneme_output"]
            
            # Handle different model types
            if "whisper" in name.lower() or "whisper" in str(model.__class__).lower():
                # Whisper expects 16kHz audio and returns text directly
                inputs = processor(audio_array, sampling_rate=sample_rate, 
                                  return_tensors="pt").to(DEVICE)
                
                with torch.no_grad():
                    generated_ids = model.generate(inputs["input_features"])
                
                transcription = processor.batch_decode(generated_ids, skip_special_tokens=True)[0].strip().lower()
                confidence = 0.95  # Default high confidence
                
            else:
                # Wav2Vec2 models
                inputs = processor(audio_array, sampling_rate=sample_rate,
                                 return_tensors="pt", padding=True).to(DEVICE)
                
                with torch.no_grad():
                    logits = model(inputs.input_values).logits
                
                pred_ids = torch.argmax(logits, dim=-1)
                transcription = processor.batch_decode(pred_ids)[0].strip().lower()
                
                # Get confidence score
                probs = torch.nn.functional.softmax(logits, dim=-1)
                confidence = probs.max(dim=-1)[0].mean().item()
            
            # Handle output based on model type
            if phoneme_output:
                # Phoneme models (like eSpeak) give phonemes directly
                phonemes = transcription.split()
                text = ''.join([p for p in phonemes if p.isalpha()])
            else:
                # Text models need conversion to phonemes
                text = transcription
                # Convert text to phonemes using our mapping
                phonemes = text_to_phonemes(transcription)
            
            model_results.append({
                "name": name,
                "transcription": transcription,
                "text": text,
                "phonemes": phonemes,
                "confidence": confidence,
                "weight": weight
            })
            
        except Exception as e:
            print(f"  ⚠️ {name} failed: {e}")
            traceback.print_exc()
            continue
    
    return model_results

# ==================================================
# NEW HELPER FUNCTION FOR DIPHTHONG EXPANSION
# ==================================================
def expand_phonemes(phonemes):
    """Expand diphthongs for length comparison and normalize Unicode"""
    expanded = []
    for p in phonemes:
        # Normalize Unicode characters first
        if p == 'ɡ':  # U+0261 script g
            p = 'g'   # Convert to regular g
        elif p == 'ɹ': # U+0279 turned r
            p = 'r'   # Convert to regular r
        
        # Then handle diphthongs
        if p in ['eɪ', 'aɪ', 'ɔɪ', 'aʊ', 'əʊ', 'oʊ']:
            if p == 'eɪ':
                expanded.extend(['e', 'ɪ'])
            elif p == 'aɪ':
                expanded.extend(['a', 'ɪ'])
            elif p == 'ɔɪ':
                expanded.extend(['ɔ', 'ɪ'])
            elif p == 'aʊ':
                expanded.extend(['a', 'ʊ'])
            elif p == 'əʊ' or p == 'oʊ':
                expanded.extend(['ə', 'ʊ'])
        else:
            expanded.append(p)
    return expanded

def ensemble_vote(model_results, word):
    """Intelligent ensemble voting with phonetic word verification"""
    if not model_results:
        return None, 0
    
    target = WORD_TO_PHONEMES.get(word, [])
    target_length = len(target)
    
    # eSpeak perfect match shortcut
    espeak_result = next((r for r in model_results if "eSpeak" in r["name"]), None)
    if espeak_result:
        espeak_phonemes = espeak_result["phonemes"]
        if espeak_phonemes == target:
            print(f"\n✨ ESPEAK PERFECT MATCH FOUND!")
            print(f"   eSpeak: {espeak_phonemes} = Target: {target}")
            similarity = calculate_word_similarity(espeak_phonemes, target)
            if similarity >= 90:
                print(f"✅ Using eSpeak perfect match (similarity: {similarity:.1f}%)")
                result = normalize_vowels(espeak_phonemes.copy(), word)
                print(f"\n✅ Final ensemble result: {result}")
                return result, 1.0
    
    # Step 1: Verify word match
    word_match, word_confidence, spoken_text, similarity, spoken_phonemes = verify_word_match(
        model_results, word, target
    )
    
    if word_match == "MULTIPLE_WORDS":
        print(f"\n⚠️ MULTIPLE WORDS DETECTED! You said too many words")
        return "MULTIPLE_WORDS", 0
    
    if not word_match:
        print(f"\n❌ WORD MISMATCH! You said '{spoken_text}', not '{word}'")
        return None, 0
    
    print(f"\n✅ Word verified: '{word}' (similarity: {similarity:.1f}%)")
    
    # Step 2: Length validation using EXPANDED phonemes
    models_with_correct_length = []
    for result in model_results:
        expanded_phonemes = expand_phonemes(result["phonemes"])
        if len(expanded_phonemes) == target_length and result["confidence"] > 0.8:
            models_with_correct_length.append(result["name"])
    
    if models_with_correct_length:
        print(f"\n📏 Models with correct length ({target_length} sounds): {', '.join(models_with_correct_length)}")
    else:
        length_diffs = []
        for r in model_results:
            expanded = expand_phonemes(r["phonemes"])
            length_diffs.append(abs(len(expanded) - target_length))
        length_diff = min(length_diffs)
        
        if length_diff >= 1:
            print(f"\n❌ LENGTH MISMATCH! All models have wrong number of sounds")
            for r in model_results:
                expanded = expand_phonemes(r["phonemes"])
                print(f"   {r['name']}: {len(expanded)} sounds ({r['phonemes']} → expanded: {expanded})")
            print(f"   Target '{word}' has {target_length} sounds: {target}")
            return None, 0
    
    # Step 3: Position matching
    print(f"\n🎯 Target phonemes: {target}")
    
    max_length = max([len(r["phonemes"]) for r in model_results] + [target_length])
    
    position_votes = [[] for _ in range(max_length)]
    position_confidence = [[] for _ in range(max_length)]
    position_models = [[] for _ in range(max_length)]
    
    for result in model_results:
        phonemes = result["phonemes"]
        confidence = result["confidence"]
        name = result["name"]
        
        print(f"\n  {name}: {phonemes} (conf: {confidence:.3f})")
        
        for i, p in enumerate(phonemes):
            if i < len(position_votes):
                position_votes[i].append(p)
                position_confidence[i].append(confidence)
                position_models[i].append(name)
    
    ensemble_result = []
    used_positions = set()
    
    for target_pos, target_phoneme in enumerate(target):
        best_match = None
        best_score = 0
        
        for model_pos in range(len(position_votes)):
            if model_pos in used_positions:
                continue
                
            votes = position_votes[model_pos]
            if not votes:
                continue
            
            if target_phoneme in votes:
                count = votes.count(target_phoneme)
                valid_indices = [i for i, v in enumerate(votes) if v == target_phoneme 
                               and position_confidence[model_pos][i] > 0.8]
                count = len(valid_indices)
                if count > 0:
                    avg_conf = sum(position_confidence[model_pos][i] for i in valid_indices) / count
                    score = count * avg_conf * 2
                    
                    if score > best_score:
                        best_score = score
                        best_match = (model_pos, target_phoneme)
        
        if best_match:
            pos, phoneme = best_match
            ensemble_result.append(phoneme)
            used_positions.add(pos)
            print(f"  ✓ Position {target_pos+1}: Using '{phoneme}' from position {pos+1}")
        else:
            if position_votes[target_pos]:
                high_conf_votes = []
                for i, v in enumerate(position_votes[target_pos]):
                    if position_confidence[target_pos][i] > 0.8:
                        high_conf_votes.append(v)
                
                if high_conf_votes:
                    most_common = max(set(high_conf_votes), key=high_conf_votes.count)
                    ensemble_result.append(most_common)
                    used_positions.add(target_pos)
                    print(f"  ~ Position {target_pos+1}: Using '{most_common}' from high conf models")
                else:
                    ensemble_result.append(target_phoneme)
                    print(f"  ! Position {target_pos+1}: Fallback to '{target_phoneme}'")
            else:
                ensemble_result.append(target_phoneme)
                print(f"  ! Position {target_pos+1}: Fallback to '{target_phoneme}'")
    
    # Step 4: Check extra sounds
    extra_sounds = []
    
    expanded_target = []
    for phoneme in target:
        if phoneme == 'eɪ':
            expanded_target.extend(['e', 'ɪ'])
        elif phoneme == 'aɪ':
            expanded_target.extend(['a', 'ɪ'])
        elif phoneme == 'ɔɪ':
            expanded_target.extend(['ɔ', 'ɪ'])
        elif phoneme == 'aʊ':
            expanded_target.extend(['a', 'ʊ'])
        elif phoneme == 'əʊ':
            expanded_target.extend(['ə', 'ʊ'])
        else:
            expanded_target.append(phoneme)
    
    print(f"\n📊 Expanded target for comparison: {expanded_target}")
    
    reliable_models = []
    for result in model_results:
        name = result["name"]
        phonemes = result["phonemes"]
        confidence = result["confidence"]
        if len(phonemes) == target_length or confidence > 0.95:
            reliable_models.append(name)
    
    if reliable_models:
        print(f"📏 Reliable models: {', '.join(reliable_models)}")
    
    # Track which target positions have been matched
    matched_target_positions = set()
    
    for pos in range(len(position_votes)):
        if pos not in used_positions and position_votes[pos]:
            reliable_votes = []
            reliable_confidences = []
            reliable_model_list = []
            
            for i, model_name in enumerate(position_models[pos]):
                if model_name in reliable_models:
                    reliable_votes.append(position_votes[pos][i])
                    reliable_confidences.append(position_confidence[pos][i])
                    reliable_model_list.append(model_name)
            
            if len(reliable_votes) < 2:
                continue
                
            vote_counts = {}
            for v in reliable_votes:
                vote_counts[v] = vote_counts.get(v, 0) + 1
            
            most_common_sound = max(vote_counts.items(), key=lambda x: x[1])
            sound, count = most_common_sound
            
            if count < len(reliable_votes) / 2:
                continue
            
            # Normalize the sound for comparison
            norm_sound = sound
            if norm_sound == 'ɡ':
                norm_sound = 'g'
            elif norm_sound == 'ɹ':
                norm_sound = 'r'
            
            # Check if this position corresponds to a target position
            if pos < len(expanded_target):
                # This position HAS a target sound - it's NOT extra!
                target_at_pos = expanded_target[pos]
                
                # Normalize target sound
                norm_target = target_at_pos
                if norm_target == 'ɡ':
                    norm_target = 'g'
                elif norm_target == 'ɹ':
                    norm_target = 'r'
                
                # If they match or are similar, it's a match, not extra
                if norm_sound == norm_target or are_phonetically_similar(sound, target_at_pos):
                    print(f"  ✓ Sound '{sound}' at position {pos+1} matches target '{target_at_pos}' - not extra")
                    matched_target_positions.add(pos)
                    continue
                else:
                    # Wrong sound at correct position - vowel/consonant issue, NOT extra!
                    print(f"  ℹ️ Wrong sound '{sound}' at position {pos+1} (should be '{target_at_pos}') - vowel/consonant issue")
                    continue
            
            # If we get here, this position is BEYOND the target length - truly extra!
            # Check if this sound matches any UNMATCHED target position
            sound_needed = False
            for target_pos, target_sound in enumerate(expanded_target):
                if target_pos in matched_target_positions:
                    continue
                    
                norm_target = target_sound
                if norm_target == 'ɡ':
                    norm_target = 'g'
                elif norm_target == 'ɹ':
                    norm_target = 'r'
                
                if norm_sound == norm_target or are_phonetically_similar(sound, target_sound):
                    # This sound matches an unmatched target position
                    sound_needed = True
                    print(f"  ✓ Sound '{sound}' at position {pos+1} matches target at position {target_pos+1}")
                    matched_target_positions.add(target_pos)
                    break
            
            if not sound_needed:
                avg_conf = sum(reliable_confidences) / len(reliable_confidences)
                models_involved = ", ".join(set(reliable_model_list))
                print(f"  ⚠️ TRULY EXTRA sound '{sound}' at position {pos+1} (beyond word length, agreed by: {models_involved})")
                extra_sounds.append(sound)
    
    if extra_sounds:
        print(f"\n❌ TRULY EXTRA SOUNDS DETECTED (beyond word length): {extra_sounds}")
        return None, 0
    
    # Step 5: Final length check
    if len(ensemble_result) != target_length:
        print(f"\n❌ FINAL LENGTH MISMATCH! Got {len(ensemble_result)} sounds, expected {target_length}")
        print(f"   Ensemble result: {ensemble_result}")
        print(f"   Target: {target}")
        return None, 0
    
    # Step 6: Vowel normalization
    ensemble_result = normalize_vowels(ensemble_result, word)
    
    print(f"\n✅ Final ensemble result: {ensemble_result}")
    return ensemble_result, 1.0

# ==================================================
# 9. GET REFERENCE PHONEMES
# ==================================================
def get_uk_pronunciation(word):
    """Get UK phonemes for a word"""
    word_key = word.lower().strip()
    
    if word_key in WORD_TO_PHONEMES:
        print(f"Using pre-defined UK phonemes for '{word_key}': {WORD_TO_PHONEMES[word_key]}")
        return WORD_TO_PHONEMES[word_key].copy()
    
    try:
        ipa_str = ipa.convert(word_key)
        clean_ipa = re.sub(r'[ˈˌ]', '', ipa_str)
        uk_phonemes = [c for c in clean_ipa if c.isalpha() or c in UK_PHONEME_DB]
        return uk_phonemes
    except:
        return [c for c in word_key if c.isalpha()]

def get_word_info(word):
    phonemes = get_uk_pronunciation(word)
    vowel_count = sum(1 for p in phonemes 
                     if UK_PHONEME_DB.get(p, {}).get('type') in ['vowel', 'diphthong'])
    
    if vowel_count == 1:
        stress = "only"
    elif vowel_count == 2:
        stress = "first"
    else:
        stress = "second"
    
    return {"syllables": vowel_count, "stress": stress}

# ==================================================
# 10. PHONEME MATCHING
# ==================================================
def is_exact_phoneme_match(ref, stu):
    if not stu or not ref:
        return False
    
    if ref == stu:
        return True
    
    variations = {
        'θ': ['t', 'f', 's'],
        'ð': ['d', 'v', 'z'],
        'ŋ': ['n', 'ng'],
        'r': ['ɹ', 'ɾ'],
        'i': ['iː'],
        'u': ['uː'],
        'ɑ': ['ɑː', 'a'],
        'ɔ': ['ɔː', 'ɒ'],
        'ɜ': ['ɜː', 'ə'],
    }
    
    if ref in variations and stu in variations[ref]:
        return 0.8
    
    return False

# ==================================================
# 11. PRONUNCIATION ANALYSIS
# ==================================================
def analyze_pronunciation_strict(student_phonemes, reference_phonemes):
    if not student_phonemes:
        return {
            "score": 0, "errors": [], "exact_correct": 0,
            "partial_correct": 0, "total_expected": len(reference_phonemes) if reference_phonemes else 0,
            "accuracy_percentage": 0,
        }
    
    if not reference_phonemes:
        reference_phonemes = []
    
    aligned_ref, aligned_stu = [], []
    i, j = 0, 0
    
    while i < len(reference_phonemes) and j < len(student_phonemes):
        ref = reference_phonemes[i]
        stu = student_phonemes[j]
        
        if ref == 'aɪ' and j + 1 < len(student_phonemes) and student_phonemes[j] == 'a' and student_phonemes[j+1] == 'ɪ':
            aligned_ref.append(ref); aligned_stu.append('aɪ'); i += 1; j += 2
        elif ref == 'eɪ' and j + 1 < len(student_phonemes) and student_phonemes[j] == 'e' and student_phonemes[j+1] == 'ɪ':
            aligned_ref.append(ref); aligned_stu.append('eɪ'); i += 1; j += 2
        else:
            aligned_ref.append(ref); aligned_stu.append(stu); i += 1; j += 1
    
    while i < len(reference_phonemes):
        aligned_ref.append(reference_phonemes[i]); aligned_stu.append(None); i += 1
    
    while j < len(student_phonemes):
        aligned_ref.append(None); aligned_stu.append(student_phonemes[j]); j += 1
    
    exact_correct = 0
    partial_correct = 0
    errors = []
    
    for idx, (ref, stu) in enumerate(zip(aligned_ref, aligned_stu)):
        if ref is None:
            errors.append({"position": idx + 1, "expected": "None", "said": stu, "type": "extra"})
            continue
        if stu is None:
            errors.append({"position": idx + 1, "expected": ref, "said": "None", "type": "missing"})
            continue
        
        match_result = is_exact_phoneme_match(ref, stu)
        if match_result == True:
            exact_correct += 1
        elif match_result is not False:
            partial_correct += match_result
        else:
            errors.append({
                "position": idx + 1, "expected": ref, "said": stu,
                "type": UK_PHONEME_DB.get(ref, {}).get("type", "unknown")
            })
    
    total_expected = len(reference_phonemes)
    if total_expected == 0:
        score = 0
    else:
        base_score = (exact_correct + partial_correct) / total_expected * 100
        missing_count = sum(1 for i in range(len(aligned_ref)) if aligned_ref[i] is not None and aligned_stu[i] is None)
        extra_count = sum(1 for i in range(len(aligned_ref)) if aligned_ref[i] is None)
        
        missing_penalty = missing_count * 5
        extra_penalty = extra_count * 3
        
        final_score = max(0, base_score - missing_penalty - extra_penalty)
        score = round(max(0, min(100, final_score)), 1)
    
    accuracy_percentage = round((exact_correct + partial_correct) / total_expected * 100, 1) if total_expected > 0 else 0
    
    return {
        "score": score, "errors": errors, "exact_correct": exact_correct,
        "partial_correct": partial_correct, "total_expected": total_expected,
        "accuracy_percentage": accuracy_percentage,
    }

# ==================================================
# 12. SCENARIO DETECTION - COMPLETE CLASS
# ==================================================
class ScenarioDetector:
    @staticmethod
    def detect_silence(student_phonemes, audio_error=None):
        if audio_error:
            if any(x in audio_error.lower() for x in ['silence', 'quiet', 'empty']):
                return {
                    'scenario': 'silence',
                    'category': 'silence',
                    'confidence': 1.0,
                    'feedback': "I couldn't hear anything. Please speak louder.",
                    'action': "increase_volume"
                }
        if not student_phonemes or len(student_phonemes) == 0:
            return {
                'scenario': 'silence',
                'category': 'silence',
                'confidence': 0.9,
                'feedback': "No speech detected.",
                'action': "check_microphone"
            }
        return None
    
    @staticmethod
    def detect_multiple_words(student_phonemes, reference_phonemes):
        if not student_phonemes:
            return None
        if len(student_phonemes) > len(reference_phonemes) * 2:
            return {
                'scenario': 'multiple_words',
                'category': 'multiple_words',
                'confidence': 0.8,
                'feedback': "I heard multiple words. Please say only one word.",
                'action': "speak_single_word"
            }
        return None

    @staticmethod
    def detect_wrong_word(student_phonemes, reference_phonemes, word):
        if student_phonemes is None or len(student_phonemes) == 0:
            return {
                'scenario': 'wrong_word',
                'category': 'wrong_word',
                'confidence': 0.9,
                'feedback': f"That doesn't sound like '{word}'. Please try again.",
                'action': "repeat_target_word"
            }
        
        if not student_phonemes or not reference_phonemes:
            return None
        min_len = min(len(student_phonemes), len(reference_phonemes))
        if min_len == 0:
            return None
        
        matches = 0
        for i in range(min_len):
            if is_exact_phoneme_match(reference_phonemes[i], student_phonemes[i]) is not False:
                matches += 1
        
        similarity = matches / len(reference_phonemes) if len(reference_phonemes) > 0 else 0
        if similarity < 0.3:
            return {
                'scenario': 'wrong_word',
                'category': 'wrong_word',
                'confidence': 0.9,
                'feedback': f"That doesn't sound like '{word}'.",
                'action': "repeat_target_word"
            }
        return None

    @staticmethod
    def detect_syllable_issues(student_phonemes, reference_phonemes, word):
        if not student_phonemes or not reference_phonemes:
            return None
        
        word_info = get_word_info(word)
        ref_syllables = word_info["syllables"]
        
        stu_vowels = sum(1 for p in student_phonemes 
                        if UK_PHONEME_DB.get(p, {}).get('type') in ['vowel', 'diphthong'])
        
        if stu_vowels == 0 and len(student_phonemes) > 0:
            return {
                'scenario': 'syllable',
                'category': 'syllable',
                'confidence': 0.9,
                'feedback': f"Missing vowel sounds. '{word}' needs vowel pronunciation.",
                'action': "add_vowel_sounds"
            }
        
        if ref_syllables >= 2 and abs(stu_vowels - ref_syllables) >= 1:
            missing_count = len(reference_phonemes) - len(student_phonemes)
            if missing_count >= 2 and stu_vowels < ref_syllables:
                return {
                    'scenario': 'syllable',
                    'category': 'syllable',
                    'confidence': 0.8,
                    'feedback': f"'{word}' has {ref_syllables} syllable(s). You're missing a syllable.",
                    'action': "add_syllables"
                }
            elif stu_vowels > ref_syllables:
                return {
                    'scenario': 'syllable',
                    'category': 'syllable',
                    'confidence': 0.7,
                    'feedback': f"'{word}' has {ref_syllables} syllable(s). You added extra sounds.",
                    'action': "reduce_syllables"
                }
        
        return None  

    @staticmethod
    def detect_ending_issues(student_phonemes, reference_phonemes):
        if not student_phonemes or not reference_phonemes:
            return None
        
        if len(student_phonemes) < len(reference_phonemes):
            missing_count = len(reference_phonemes) - len(student_phonemes)
            if missing_count == 1:
                missing_sound = reference_phonemes[-1]
                return {
                    'scenario': 'ending',
                    'category': 'ending',
                    'confidence': 0.8,
                    'feedback': f"You're missing the final sound: '{missing_sound}'.",
                    'action': "complete_ending",
                    'target_phoneme': missing_sound
                }
            elif missing_count > 1:
                missing_part = reference_phonemes[-missing_count:]
                missing_vowels = sum(1 for p in missing_part 
                                   if UK_PHONEME_DB.get(p, {}).get('type') in ['vowel', 'diphthong'])
                if missing_vowels == 0:
                    return {
                        'scenario': 'ending',
                        'category': 'ending',
                        'confidence': 0.7,
                        'feedback': f"You're missing the ending: '{''.join(missing_part)}'.",
                        'action': "complete_ending"
                    }
        
        if len(student_phonemes) >= 1 and len(reference_phonemes) >= 1:
            final_stu = student_phonemes[-1]
            final_ref = reference_phonemes[-1]
            
            if not is_exact_phoneme_match(final_ref, final_stu):
                return {
                    'scenario': 'ending',
                    'category': 'ending',
                    'confidence': 0.7,
                    'feedback': f"Final sound should be '{final_ref}' not '{final_stu}'.",
                    'action': "correct_final_sound",
                    'target_phoneme': final_ref
                }
        
        return None
    
    @staticmethod
    def detect_vowel_issues(student_phonemes, reference_phonemes):
        if not student_phonemes or not reference_phonemes:
            return None
        
        vowel_errors = []
        min_len = min(len(student_phonemes), len(reference_phonemes))
        
        for i in range(min_len):
            ref = reference_phonemes[i]
            stu = student_phonemes[i]
            
            ref_info = UK_PHONEME_DB.get(ref, {})
            if ref_info.get('type') == 'vowel':
                match_result = is_exact_phoneme_match(ref, stu)
                if match_result is False:
                    vowel_errors.append({
                        'position': i + 1,
                        'expected': ref,
                        'actual': stu,
                        'tip': f"Use {ref} sound",
                    })
        
        if vowel_errors:
            primary = vowel_errors[0]
            return {
                'scenario': 'vowel',
                'category': 'vowel',
                'confidence': 0.9,
                'feedback': f"Vowel issue: Use {primary['expected']} sound",
                'action': "adjust_vowel",
                'target_phoneme': primary['expected']
            }
        
        return None
    
    @staticmethod
    def detect_consonant_issues(student_phonemes, reference_phonemes):
        if not student_phonemes or not reference_phonemes:
            return None
        
        consonant_errors = []
        min_len = min(len(student_phonemes), len(reference_phonemes))
        
        for i in range(min_len):
            ref = reference_phonemes[i]
            stu = student_phonemes[i]
            
            ref_info = UK_PHONEME_DB.get(ref, {})
            if ref_info.get('type') == 'consonant':
                match_result = is_exact_phoneme_match(ref, stu)
                if match_result is False:
                    consonant_errors.append({
                        'position': i + 1,
                        'expected': ref,
                        'actual': stu,
                        'tip': ref_info.get('tip', f'Articulate {ref} clearly'),
                    })
        
        if consonant_errors:
            primary = consonant_errors[0]
            return {
                'scenario': 'consonant',
                'category': 'consonant',
                'confidence': 0.8,
                'feedback': f"Consonant: {primary['tip']}",
                'action': "articulate_consonant",
                'target_phoneme': primary['expected']
            }
        
        return None
    
    @staticmethod
    def detect_stress_issues(student_phonemes, reference_phonemes, word):
        if not student_phonemes or not reference_phonemes:
            return None
        
        word_info = get_word_info(word)
        if word_info["syllables"] < 2:
            return None
        
        correct_count = 0
        min_len = min(len(student_phonemes), len(reference_phonemes))
        for i in range(min_len):
            if is_exact_phoneme_match(reference_phonemes[i], student_phonemes[i]):
                correct_count += 1
        
        accuracy = correct_count / len(reference_phonemes) if len(reference_phonemes) > 0 else 0
        if accuracy >= 0.8 and word_info["syllables"] >= 2:
            stress_pattern = {
                "first": "first syllable",
                "second": "second syllable", 
                "third": "third syllable"
            }.get(word_info["stress"], "correct syllable")
            
            return {
                'scenario': 'stress',
                'category': 'stress',
                'confidence': 0.6,
                'feedback': f"For '{word}', emphasize the {stress_pattern}.",
                'action': "practice_stress"
            }
        
        return None
    
    @staticmethod
    def detect_success(analysis_result, score):
        if not analysis_result:
            return None
        
        if score >= 95:
            return {
                'scenario': 'success',
                'category': 'success',
                'confidence': 1.0,
                'feedback': "Excellent pronunciation! Perfect! 🎉",
                'action': "continue_excellent_work"
            }
        elif score >= 85:
            return {
                'scenario': 'success',
                'category': 'success',
                'confidence': 0.9,
                'feedback': "Very good pronunciation!",
                'action': "refine_pronunciation"
            }
        elif score >= 75:
            return {
                'scenario': 'success',
                'category': 'success',
                'confidence': 0.8,
                'feedback': "Good pronunciation! Keep practicing.",
                'action': "practice_more"
            }
        
        return None
    
    @classmethod
    def detect_scenarios(cls, student_phonemes, reference_phonemes, word, analysis_result, audio_error=None):
        score = analysis_result.get('score', 0) if analysis_result else 0
        
        # Check for multiple words from audio_error FIRST
        if audio_error == "multiple_words":
            return {
                'scenario': 'multiple_words',
                'category': 'multiple_words',
                'confidence': 1.0,
                'feedback': "I heard multiple words. Please say only one word.",
                'action': "speak_single_word"
            }
        
        # Check for wrong_word first (student_phonemes is None)
        if student_phonemes is None:
            return {
                'scenario': 'wrong_word',
                'category': 'wrong_word',
                'confidence': 1.0,
                'feedback': f"That doesn't sound like '{word}'. Please try again.",
                'action': "repeat_target_word"
            }
        
        # Check silence
        silence_result = cls.detect_silence(student_phonemes, audio_error)
        if silence_result:
            return silence_result
        
        # If no student phonemes, it's silence
        if not student_phonemes or len(student_phonemes) == 0:
            return {
                'scenario': 'silence',
                'category': 'silence',
                'confidence': 0.9,
                'feedback': "No speech detected.",
                'action': "check_microphone"
            }
        
        # Run all detectors
        detectors = [
            ('multiple_words', lambda: cls.detect_multiple_words(student_phonemes, reference_phonemes)),
            ('wrong_word', lambda: cls.detect_wrong_word(student_phonemes, reference_phonemes, word)),
            ('vowel', lambda: cls.detect_vowel_issues(student_phonemes, reference_phonemes)),
            ('consonant', lambda: cls.detect_consonant_issues(student_phonemes, reference_phonemes)),
            ('syllable', lambda: cls.detect_syllable_issues(student_phonemes, reference_phonemes, word)),
            ('ending', lambda: cls.detect_ending_issues(student_phonemes, reference_phonemes)),
            ('success', lambda: cls.detect_success(analysis_result, score)),
            ('stress', lambda: cls.detect_stress_issues(student_phonemes, reference_phonemes, word)),
            
        ]
        
        for _, detector_func in detectors:
            result = detector_func()
            if result:
                return result
        
        return {
            'scenario': 'needs_improvement',
            'category': 'general',
            'confidence': 0.5,
            'feedback': "Pronunciation needs improvement.",
            'action': "practice_sounds"
        }

# ==================================================
# 13. AUDIO PROCESSING WITH ENSEMBLE
# ==================================================
def process_audio_file(audio_path, word=None):
    try:
        wav_path = audio_path.replace('.webm', '.wav')
        
        subprocess.run([
            "ffmpeg", "-y", "-i", audio_path,
            "-ac", "1", "-ar", "16000",
            "-acodec", "pcm_s16le",
            wav_path
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        speech, sample_rate = sf.read(wav_path)
        
        if len(speech) == 0:
            return None, "empty_audio"
        
        rms = np.sqrt(np.mean(speech**2))
        peak = np.max(np.abs(speech))
        
        if rms < 0.001 or peak < 0.02:
            return None, f"silent_rms_{rms:.6f}_peak_{peak:.4f}"
        
        if peak < 0.5:
            boost_factor = 0.5 / peak if peak > 0 else 1.0
            speech = speech * min(boost_factor, 3.0)
        
        print("\n🔍 Running ensemble transcription...")
        model_results = ensemble_transcribe(speech, sample_rate)
        
        print("\n📊 Model Results:")
        for result in model_results:
            print(f"  {result['name']}: {result['phonemes']} (confidence: {result['confidence']:.3f})")
        
        ensemble_phonemes, confidence = ensemble_vote(model_results, word)
        
        # Check for multiple words
        if ensemble_phonemes == "MULTIPLE_WORDS":
            return None, "multiple_words"
        
        if ensemble_phonemes is None:
            return None, "wrong_word"
        
        print(f"\n✅ Ensemble result: {ensemble_phonemes}")
        return ensemble_phonemes, None
        
    except Exception as e:
        print(f"Audio processing error: {str(e)}")
        return None, f"error: {str(e)}"

# ==================================================
# 14. MAIN ENDPOINT
# ==================================================
@pronunciation_bp.route("/score", methods=["POST"])
def train_pronunciation():
    try:
        word = request.form.get('word', '').strip().lower()
        if not word:
            return jsonify({"success": False, "error": "No word provided", "scenario": "input_error"}), 400
        
        if 'audio' not in request.files:
            return jsonify({"success": False, "error": "No audio file", "scenario": "input_error"}), 400
        
        audio_file = request.files['audio']
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as tmp_file:
            audio_file.save(tmp_file.name)
            temp_path = tmp_file.name
        
        print(f"\n{'='*50}")
        print(f"Processing word: '{word}'")
        print(f"{'='*50}")
        
        try:
            student_phonemes, audio_error = process_audio_file(temp_path, word)
            reference_phonemes = get_uk_pronunciation(word)
            analysis = analyze_pronunciation_strict(student_phonemes, reference_phonemes)
            score = analysis["score"]
            
            scenario_info = ScenarioDetector.detect_scenarios(
                student_phonemes=student_phonemes,
                reference_phonemes=reference_phonemes,
                word=word,
                analysis_result=analysis,
                audio_error=audio_error
            )
            
            scenario = scenario_info['scenario']
            category = scenario_info.get('category', scenario)
            feedback = scenario_info['feedback']
            action = scenario_info.get('action', '')
            target_phoneme = scenario_info.get('target_phoneme')
            print(f"\n🎬 Generating video for: category={category}, target_phoneme={target_phoneme}")
            
            # Generate feedback video using imported function
            video_blob = build_feedback_video(
                category=category,
                feedback_message=feedback,
                target_phoneme=target_phoneme,
                score=score,
                student_phonemes=student_phonemes,
                reference_phonemes=reference_phonemes
            )
            print(f"📹 Video blob length: {len(video_blob) if video_blob else 0}")
           
            
            # Build per-phoneme details for frontend colored word display
            phoneme_details = []
            if reference_phonemes:
                for i, ref in enumerate(reference_phonemes):
                    said = student_phonemes[i] if student_phonemes and i < len(student_phonemes) else None
                    ph_info = UK_PHONEME_DB.get(ref, {})
                    if said is None:
                        correct = False
                    else:
                        match_result = is_exact_phoneme_match(ref, said)
                        correct = match_result is not False
                    phoneme_details.append({
                        "sound": ref,
                        "said": said or "",
                        "correct": correct,
                        "tip": ph_info.get("tip", "")
                    })

            response = {
                "success": True,
                "scenario": scenario,
                "score": score,
                "is_acceptable": score >= 75,
                "word": word,
                "student_phonemes": student_phonemes if student_phonemes else [],
                "reference_phonemes": reference_phonemes,
                "ipa_notation": "/" + " ".join(reference_phonemes) + "/",
                "feedback": feedback,
                "action_suggestion": action,
                "videoBlobBase64": video_blob if video_blob else "",
                "video_clips_merged": True if video_blob else False,
                "phoneme_details": phoneme_details,
                "analysis": {
                    "accuracy": f"{analysis.get('exact_correct', 0)}/{analysis.get('total_expected', 0)} exact matches",
                    "accuracy_percentage": analysis.get('accuracy_percentage', 0),
                    "partial_correct": analysis.get('partial_correct', 0),
                }
            }
            
            print(f"\nResponse: Score={score}, Scenario={scenario}")
            return jsonify(response)
            
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)
                wav_path = temp_path.replace('.webm', '.wav')
                if os.path.exists(wav_path):
                    os.remove(wav_path)
    
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({"success": False, "error": str(e), "scenario": "system_error"}), 500

# ==================================================
# Print confirmation at the end
# ==================================================
print(f"✅ pronunciation.py loaded successfully")
print(f"   Blueprint: {pronunciation_bp.name}")
print(f"   Routes: /test, /score")
