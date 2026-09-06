/**
 * Voice Assistant & Speech Parser for POS Checkout
 * ═══════════════════════════════════════════════════════════════════════════
 *  OPTIMIZED FOR SOUTH ASIAN ACCENTS & SPELLING RECOGNITION
 *  – Bengali (Bangladesh / West Bengal)
 *  – Indian English (Hindi, Urdu, Tamil, Telugu, Punjabi influenced)
 *  – Pakistani English
 *
 *  Key accent patterns & features handled:
 *    • Letter-by-letter spelling recognition:
 *        "c o k e" → "coke"
 *        "spell c o k e" → "coke"
 *        "spelling p e p s i" → "pepsi"
 *        "c-o-k-e" / "c. o. k. e." → "coke"
 *        "see oh kay ee" → "coke"
 *    • SOV South Asian sentence structure (verbs at the end):
 *        "coke 2 ta dao" → Add 2 Coke
 *        "duita pepsi den" → Add 2 Pepsi
 *        "sprite add koro" → Add 1 Sprite
 *        "milk bad dao" / "milk felay dao" → Remove Milk
 *    • South Asian regional quantities (ekta, duita, tinta, charta, pachta, etc.)
 *    • v ↔ w  ("w" is often said as "v" and vice versa)
 *    • "th" → "d" or "t"    (this → dis, three → tree)
 *    • Short vowels elongated or swapped  (ship → sheep, bit → beet)
 *    • Retroflex consonants  (d̪/t̪ → d/t mismatch)
 *    • Aspirated stops       (p/b, k/g often aspirated)
 *    • "z" → "j"            (zero → jero)
 *    • "f" → "ph" or "p"   (phone → fone)
 *    • Schwa deletion       (apple → apl, bottle → botl)
 *    • South Asian product vocabulary (atta, dal, chawal, ghee, etc.)
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ─── Number Words ─────────────────────────────────────────────────────────────
const NUMBER_WORDS = {
  // English standard
  'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
  'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
  'twenty-one': 21, 'twenty-two': 22, 'twenty-five': 25, 'thirty': 30,
  'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70, 'eighty': 80,
  'ninety': 90, 'hundred': 100,
  'a': 1, 'an': 1, 'half': 0.5,

  // South Asian English variants (accent-influenced pronunciation)
  'vone': 1, 'von': 1,              // "one" with v-sound
  'too': 2, 'tu': 2, 'tow': 2,     // "two"
  'tree': 3, 'tri': 3,              // "three" → "tree"
  'fore': 4, 'foar': 4,             // "four"
  'faiv': 5, 'fife': 5,             // "five"
  'sicks': 6, 'seex': 6,            // "six"
  'seben': 7, 'seban': 7,           // "seven" (retroflex b)
  'ait': 8, 'aight': 8,             // "eight"
  'nain': 9, 'nayn': 9,             // "nine"
  'tan': 10, 'tayn': 10,            // "ten"

  // Bengali / Bangla base numbers
  'ek': 1, 'এক': 1,
  'dui': 2, 'দুই': 2, 'doh': 2, 'do': 2,
  'tin': 3, 'তিন': 3, 'teen': 3,
  'char': 4, 'চার': 4, 'chaar': 4,
  'paach': 5, 'পাঁচ': 5, 'pach': 5, 'panch': 5,
  'choy': 6, 'ছয়': 6, 'chhoy': 6,
  'shaat': 7, 'সাত': 7, 'sat': 7, 'saat': 7,
  'aat': 8, 'আট': 8, 'aath': 8,
  'noy': 9, 'নয়': 9, 'nau': 9, 'naw': 9,
  'dosh': 10, 'দশ': 10, 'das': 10,

  // Bengali numbers with classifier "ta" / "ti" (common in daily grocery shopping)
  'ekta': 1, 'ekti': 1, 'akta': 1,
  'duita': 2, 'duiti': 2, 'duta': 2, 'duto': 2,
  'tinta': 3, 'tinti': 3, 'tinto': 3,
  'charta': 4, 'charti': 4, 'chaarta': 4,
  'pachta': 5, 'pachti': 5, 'paachta': 5,
  'choyta': 6, 'choyti': 6, 'chhoyta': 6,
  'shatta': 7, 'satta': 7, 'saatta': 7, 'shatti': 7,
  'aatta': 8, 'aatti': 8,
  'noyta': 9, 'noyti': 9,
  'doshta': 10, 'doshti': 10,

  // Hindi / Urdu
  'ek': 1, 'do': 2, 'teen': 3, 'chaar': 4, 'paanch': 5,
  'chhah': 6, 'saath': 7, 'aath': 8, 'nau': 9, 'das': 10,

  // Bengali numerals
  '১': 1, '২': 2, '৩': 3, '৪': 4, '৫': 5,
  '৬': 6, '৭': 7, '৮': 8, '৯': 9, '১০': 10,
};

// ─── Spoken Letter Mapping (for spelling words letter-by-letter) ───────────────
const SPOKEN_LETTERS = {
  'ay': 'a', 'ei': 'a',
  'bee': 'b', 'bi': 'b',
  'see': 'c', 'sea': 'c', 'cee': 'c', 'si': 'c',
  'dee': 'd', 'di': 'd',
  'ee': 'e',
  'ef': 'f', 'eff': 'f',
  'jee': 'g', 'gee': 'g', 'ji': 'g',
  'aitch': 'h', 'eich': 'h', 'hech': 'h', 'heich': 'h',
  'eye': 'i', 'ai': 'i',
  'jay': 'j', 'je': 'j',
  'kay': 'k', 'ke': 'k',
  'el': 'l', 'ell': 'l',
  'em': 'm',
  'en': 'n',
  'oh': 'o', 'ow': 'o',
  'pee': 'p', 'pea': 'p', 'pi': 'p',
  'cue': 'q', 'queue': 'q', 'kyu': 'q',
  'ar': 'r', 'are': 'r',
  'es': 's', 'ess': 's',
  'tee': 't', 'tea': 't', 'ti': 't',
  'you': 'u', 'yu': 'u',
  'vee': 'v', 'bhee': 'v', 'bhi': 'v', 'vi': 'v',
  'double u': 'w', 'dablu': 'w', 'dabble you': 'w',
  'ex': 'x', 'ecks': 'x', 'eks': 'x',
  'why': 'y', 'wai': 'y',
  'zed': 'z', 'zee': 'z', 'jed': 'z', 'ji': 'z'
};

// ─── Filler Words ─────────────────────────────────────────────────────────────
const FILLER_WORDS = [
  // English
  'to the cart', 'to cart', 'in the cart', 'in cart', 'into cart', 'into the cart',
  'please', 'pls', 'cart', 'carte',
  'pieces of', 'piece of', 'bottles of', 'bottle of', 'cans of', 'can of',
  'packs of', 'pack of', 'packets of', 'packet of', 'kg of', 'box of', 'boxes of',
  'pieces', 'piece', 'pcs', 'bottles', 'bottle', 'cans', 'can', 'packs', 'pack',
  'packets', 'packet', 'items', 'item', 'units', 'unit',
  // Bangla / Bengali filler
  'ta', 'ti', 'te', 'tuk', 'koro', 'korun', 'dao', 'den', 'lagbe', 'chai',
  'jog koro', 'add koro', 'add korun', 'rakho', 'rako',
  'diye dao', 'diye den', 'nao', 'nen',
  // Hindi filler
  'dijiye', 'dena', 'chahiye', 'lena', 'rakho', 'daalo', 'dal do',
  // Urdu
  'dena', 'chahiye', 'lena',
];

// ─── South Asian Accent Phonetic Patterns ─────────────────────────────────────
const SA_PHONETIC_RULES = [
  // w ↔ v interchange (very common in Bengali/Hindi/Urdu speakers)
  [/\bwery\b/gi, 'very'],
  [/\bwideo\b/gi, 'video'],
  [/\bwanilla\b/gi, 'vanilla'],
  [/\bvater\b/gi, 'water'],
  [/\bvashing\b/gi, 'washing'],
  [/\bvegetable\b/gi, 'vegetable'],
  [/\bvinegar\b/gi, 'vinegar'],
  // "th" → "d" / "t" (dental → alveolar)
  [/\bdis\b/gi, 'this'],
  [/\bdat\b/gi, 'that'],
  [/\bdem\b/gi, 'them'],
  [/\bdere\b/gi, 'there'],
  [/\bden\b(?!\s*(noodles|noodle))/gi, 'then'],
  [/\btree\b(?!\s*(tomato|fruit))/gi, 'three'],
  [/\btrousand\b/gi, 'thousand'],
  // "z" → "j" (Bangla/Hindi has no native /z/ sound)
  [/\bjero\b/gi, 'zero'],
  [/\bjest\b/gi, 'zest'],
  // Vowel shifts: "ee" for "i", "o" for "u"
  [/\bsheep\b(?!\s*(product))/gi, 'ship'],
  [/\bfool\b/gi, 'full'],
  // Aspirated stops and retroflex
  [/\bphone\b/gi, 'phone'],
  [/\bph/gi, 'f'],
  // Double-vowel common in SA English
  [/\bchocolaat\b/gi, 'chocolate'],
  [/\bcocaa\b/gi, 'coca'],
  // Schwa deletion / insertion patterns
  [/\bbotl\b/gi, 'bottle'],
  [/\bapl\b/gi, 'apple'],
  [/\bveg\b/gi, 'vegetable'],
];

// ─── Common Misspellings / Phonetic Aliases ───────────────────────────────────
// Maps what South Asian accents / speech engines commonly produce → correct form
const PHONETIC_ALIASES = {
  // ── Beverages & 3-Letter Abbreviations ──
  'cok': 'coca cola', 'coke': 'coca cola', 'koke': 'coca cola', 'koka': 'coca cola', 'coka': 'coca cola',
  'coak': 'coca cola', 'coca-cola': 'coca cola', 'kokakola': 'coca cola', 'koka kola': 'coca cola',
  'pep': 'pepsi', 'pepsy': 'pepsi', 'pepcy': 'pepsi', 'pepce': 'pepsi', 'pepsii': 'pepsi',
  '7up': 'seven up', '7 up': 'seven up', 'sevnup': 'seven up', 'sabenup': 'seven up', 'sevenup': 'seven up',
  'minda': 'mirinda', 'mirenda': 'mirinda', 'miranda': 'mirinda',
  'fanta': 'fanta', 'fenta': 'fanta',
  'spr': 'sprite', 'sprite': 'sprite', 'spright': 'sprite', 'spirite': 'sprite', 'sprit': 'sprite', 'spryte': 'sprite',
  'coffe': 'coffee', 'cofee': 'coffee', 'kofi': 'coffee', 'kaafi': 'coffee', 'cofy': 'coffee', 'koffee': 'coffee',
  'tee': 'tea', 'chai': 'tea', 'cha': 'tea', 'chaye': 'tea',
  'lassi': 'lassi', 'lasey': 'lassi',
  'borhani': 'borhani', 'barhani': 'borhani',
  'sherbet': 'sherbet', 'sarbet': 'sherbet', 'shorbot': 'sherbet',
  'rooh afza': 'rooh afza', 'ruh afza': 'rooh afza', 'ruh': 'rooh afza',
  'watter': 'water', 'vaater': 'water', 'pani': 'water', 'paani': 'water',
  'mango juice': 'mango juice', 'mango drinkh': 'mango drink',
  'lichi juice': 'lychee juice', 'lichu': 'lychee',

  // ── Dairy / Grains ──
  'milck': 'milk', 'mylk': 'milk', 'dudh': 'milk', 'doodh': 'milk',
  'chease': 'cheese', 'cheez': 'cheese', 'chese': 'cheese', 'paner': 'paneer', 'panir': 'paneer',
  'buttar': 'butter', 'butar': 'butter', 'makhon': 'butter', 'makhan': 'butter',
  'dahi': 'yogurt', 'doi': 'yogurt', 'yoghurt': 'yogurt', 'yougurt': 'yogurt', 'yougert': 'yogurt',
  'ghee': 'ghee', 'ghi': 'ghee',
  'atta': 'flour', 'aata': 'flour', 'maida': 'flour', 'flur': 'flour', 'flowr': 'flour',
  'chawal': 'rice', 'chal': 'rice', 'bhat': 'rice', 'ryce': 'rice', 'rise': 'rice',

  // ── Eggs & Protein ──
  'eg': 'egg', 'egs': 'eggs', 'egges': 'eggs', 'deem': 'egg', 'dim': 'egg', 'deem er': 'eggs',
  'chicken': 'chicken', 'chiken': 'chicken', 'chikin': 'chicken', 'chikn': 'chicken',
  'murgi': 'chicken', 'murgh': 'chicken',
  'mach': 'fish', 'mas': 'fish', 'fish': 'fish',
  'goru': 'beef', 'gorur mangsho': 'beef', 'beef': 'beef',
  'khashi': 'mutton', 'mutton': 'mutton', 'lamb': 'lamb',

  // ── Vegetables ──
  'aloo': 'potato', 'alu': 'potato', 'potatoes': 'potato', 'potatoe': 'potato', 'potatos': 'potato',
  'oniun': 'onion', 'onyon': 'onion', 'peyaj': 'onion', 'piyaj': 'onion',
  'tomatoe': 'tomato', 'tomatos': 'tomato', 'tamato': 'tomato', 'tomaato': 'tomato',
  'begun': 'brinjal', 'bengoon': 'brinjal', 'baingan': 'brinjal', 'eggplant': 'brinjal',
  'shimla morich': 'capsicum', 'capsicam': 'capsicum', 'bell pepper': 'capsicum',
  'morich': 'chili', 'marich': 'chili', 'chilli': 'chili', 'mirchi': 'chili',
  'ada': 'ginger', 'adrak': 'ginger', 'jengar': 'ginger',
  'rosun': 'garlic', 'roshun': 'garlic', 'lahasun': 'garlic', 'lahsun': 'garlic',
  'dhonepata': 'coriander', 'dhane pata': 'coriander', 'cilantro': 'coriander',
  'palang': 'spinach', 'palong shaak': 'spinach', 'saag': 'spinach',
  'karala': 'bitter gourd', 'korola': 'bitter gourd',
  'lau': 'bottle gourd', 'lauki': 'bottle gourd',

  // ── Fruits ──
  'appel': 'apple', 'aple': 'apple',
  'aam': 'mango', 'mangu': 'mango', 'mangow': 'mango',
  'kola': 'banana', 'kela': 'banana', 'banaan': 'banana',
  'komla': 'orange', 'orenge': 'orange', 'ornage': 'orange', 'narangi': 'orange',
  'lemun': 'lemon', 'limon': 'lemon', 'lebu': 'lemon',
  'angur': 'grapes', 'grape': 'grapes',
  'tarbuj': 'watermelon', 'water melon': 'watermelon',
  'ananas': 'pineapple', 'pine apple': 'pineapple',
  'boroi': 'jujube', 'kul': 'jujube',

  // ── Cooking / Pantry ──
  'tel': 'oil', 'soyabean tel': 'soybean oil', 'musterd': 'mustard', 'sarso': 'mustard',
  'lobon': 'salt', 'noon': 'salt', 'solt': 'salt', 'sawlt': 'salt',
  'chini': 'sugar', 'sugur': 'sugar', 'shugur': 'sugar', 'shekor': 'sugar',
  'dal': 'lentils', 'daal': 'lentils', 'masoor': 'lentils', 'moshur dal': 'red lentils',
  'moong dal': 'moong lentils', 'mung': 'moong lentils',
  'chana': 'chickpeas', 'chola': 'chickpeas', 'sobuj matar': 'green peas',
  'ketchap': 'ketchup', 'catchup': 'ketchup', 'tomato sauce': 'ketchup',
  'sause': 'sauce', 'saus': 'sauce',
  'soy sauce': 'soy sauce', 'shoy sauce': 'soy sauce',
  'sarshe': 'mustard paste', 'kasundi': 'mustard paste',
  'haldi': 'turmeric', 'holud': 'turmeric', 'turmeric': 'turmeric',
  'jeera': 'cumin', 'jira': 'cumin',
  'dhaniya': 'coriander powder', 'dhone': 'coriander powder',
  'garam masala': 'garam masala', 'masala': 'spice',
  'biriyani masala': 'biryani spice', 'biryani masala': 'biryani spice',

  // ── Snacks & Biscuits ──
  'biscit': 'biscuit', 'biskit': 'biscuit', 'biskut': 'biscuit', 'biscoot': 'biscuit', 'biscut': 'biscuit',
  'chips': 'chips', 'chipes': 'chips', 'leyz': 'lays', 'laays': 'lays',
  'chanachur': 'chanachur', 'chana chur': 'chanachur',
  'muri': 'puffed rice', 'murhi': 'puffed rice',
  'chotpoti': 'chotpoti', 'fuchka': 'fuchka', 'phuchka': 'fuchka',
  'samosa': 'samosa', 'shamusa': 'samosa',
  'noodels': 'noodles', 'noodle': 'noodles', 'nudels': 'noodles', 'nooduls': 'noodles', 'maggi': 'noodles', 'megi': 'maggi',
  'bread': 'bread', 'breead': 'bread', 'bred': 'bread', 'pauruti': 'bread',
  'roti': 'roti', 'chapati': 'chapati', 'paratha': 'paratha',

  // ── Sweet / Bakery ──
  'chocalate': 'chocolate', 'chocolat': 'chocolate', 'chocklate': 'chocolate', 'choco': 'chocolate', 'chocklet': 'chocolate',
  'kitkat': 'kitkat', 'kit kat': 'kitkat', 'kit-kat': 'kitkat', 'kitcat': 'kitkat',
  'dairy milk': 'dairy milk', 'dairymilk': 'dairy milk',
  'mishti': 'sweets', 'mishtir dokan': 'sweet shop',
  'rosogolla': 'rasgulla', 'rasgulla': 'rasgulla',
  'laddu': 'laddu', 'laddoo': 'laddu',
  'halwa': 'halwa', 'halua': 'halwa',

  // ── Hygiene & Household ──
  'shoap': 'soap', 'sabon': 'soap', 'sabun': 'soap', 'shaban': 'soap',
  'shampoo': 'shampoo', 'saampu': 'shampoo',
  'toothpaste': 'toothpaste', 'tooth paste': 'toothpaste', 'paste': 'toothpaste',
  'deterjent': 'detergent', 'deturgent': 'detergent', 'washing powder': 'detergent',
  'tishu': 'tissue', 'tissue paper': 'tissue',
  'sanitizer': 'sanitizer', 'senitizer': 'sanitizer',

  // ── Tech / Electronics ──
  'iphone': 'iphone', 'ayphone': 'iphone', 'i phone': 'iphone',
  'samsung': 'samsung', 'samsang': 'samsung',
  'charjar': 'charger', 'charger': 'charger',
  'battari': 'battery', 'battery': 'battery',
};

// ─── Browser Support ──────────────────────────────────────────────────────────
export const isSpeechRecognitionSupported = () => {
  return typeof window !== 'undefined' && Boolean(
    window.SpeechRecognition ||
    window.webkitSpeechRecognition ||
    window.mozSpeechRecognition ||
    window.msSpeechRecognition
  );
};

// ─── Text Normalization ───────────────────────────────────────────────────────
export const normalizeText = (text = '') => {
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^\&\*;:{}=\-_`~()?'"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

// ─── Collapse Spelled Letters ────────────────────────────────────────────────
/**
 * Detects and collapses words spelled out letter-by-letter, e.g.:
 *   "c o k e" -> "coke"
 *   "spell c o k e" -> "coke"
 *   "spelling c o k e" -> "coke"
 *   "c-o-k-e" / "c. o. k. e." -> "coke"
 *   "see oh kay ee" -> "coke"
 *   "add 2 c o k e" -> "add 2 coke"
 *   "p e p s i" -> "pepsi"
 *   "s p r i t e" -> "sprite"
 *
 * @param {string} text
 * @returns {string} collapsed string
 */
export function collapseSpelledLetters(text = '') {
  if (!text || typeof text !== 'string') return '';

  let cleaned = text.trim();

  // 1. Strip "spell", "spelling", "spelled", "banan koro", "banan" prefixes
  cleaned = cleaned.replace(/\b(?:spell|spelling|spelled|banan\s*koro|banan)\s+/gi, '');

  // 2. Normalize hyphens and periods between single letters: "c-o-k-e" or "c.o.k.e"
  cleaned = cleaned.replace(/(?<=[a-zA-Z0-9])[.\-_]+(?=[a-zA-Z0-9])/g, ' ');

  // 3. Remove trailing periods on single letters e.g. "c. o. k. e."
  cleaned = cleaned.replace(/\b([a-zA-Z0-9])\./g, '$1 ');

  // 4. Tokenize
  const rawTokens = cleaned.split(/\s+/).filter(Boolean);
  if (rawTokens.length === 0) return '';

  const getCharForToken = (token) => {
    const low = token.toLowerCase();
    if (low.length === 1 && /[a-z0-9]/i.test(low)) {
      return low;
    }
    if (SPOKEN_LETTERS[low] !== undefined) {
      return SPOKEN_LETTERS[low];
    }
    return null;
  };

  const outputTokens = [];
  let letterBuffer = [];

  const flushBuffer = () => {
    if (letterBuffer.length === 0) return;
    if (letterBuffer.length === 1) {
      outputTokens.push(letterBuffer[0].original);
    } else {
      const word = letterBuffer.map(item => item.char).join('');
      outputTokens.push(word);
    }
    letterBuffer = [];
  };

  for (let i = 0; i < rawTokens.length; i++) {
    const token = rawTokens[i];
    const low = token.toLowerCase();
    const char = getCharForToken(low);

    // Common words that are also letter homophones
    const isAmbiguousWord = ['see', 'sea', 'are', 'you', 'tea', 'be'].includes(low);

    if (char && !isAmbiguousWord) {
      letterBuffer.push({ char, original: token });
    } else if (char && isAmbiguousWord) {
      const prevIsLetter = letterBuffer.length > 0;
      const nextIsLetter = i + 1 < rawTokens.length && getCharForToken(rawTokens[i + 1].toLowerCase()) !== null;

      if (prevIsLetter || nextIsLetter) {
        letterBuffer.push({ char, original: token });
      } else {
        flushBuffer();
        outputTokens.push(token);
      }
    } else {
      flushBuffer();
      outputTokens.push(token);
    }
  }

  flushBuffer();

  return outputTokens.join(' ');
}

// ─── Apply South Asian Phonetic Rules ─────────────────────────────────────────
function applySAPhoneticRules(text) {
  let result = text;
  SA_PHONETIC_RULES.forEach(([pattern, replacement]) => {
    result = result.replace(pattern, replacement);
  });
  return result.replace(/\s+/g, ' ').trim();
}

// ─── Apply Phonetic Aliases ───────────────────────────────────────────────────
function applyAliases(text) {
  let result = text;
  // Longest-match-first: sort by key length descending to avoid partial replacements
  const sorted = Object.entries(PHONETIC_ALIASES).sort((a, b) => b[0].length - a[0].length);
  sorted.forEach(([bad, good]) => {
    try {
      result = result.replace(new RegExp(`\\b${bad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), good);
    } catch (e) {}
  });
  return result.replace(/\s+/g, ' ').trim();
}

// ─── Full Normalization Pipeline ──────────────────────────────────────────────
export function fullNormalize(text) {
  let t = normalizeText(text);
  t = collapseSpelledLetters(t);
  t = applySAPhoneticRules(t);
  t = applyAliases(t);
  return t.replace(/\s+/g, ' ').trim();
}

// ─── Levenshtein Distance ─────────────────────────────────────────────────────
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let j = 1; j <= b.length; j++) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const temp = dp[i];
      dp[i] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[i - 1], dp[i]);
      prev = temp;
    }
  }
  return dp[a.length];
}

function levenshteinSimilarity(a, b) {
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

// ─── Consonant Skeleton (vowel-stripped) ─────────────────────────────────────
function consonantSkeleton(str) {
  return str
    .replace(/[aeiou]/g, '')   // strip vowels
    .replace(/(.)\1+/g, '$1'); // collapse consecutive duplicates
}

// ─── Bigram Dice Coefficient ──────────────────────────────────────────────────
function bigramSimilarity(s1, s2) {
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;
  if (s1.length < 2 || s2.length < 2) return s1[0] === s2[0] ? 0.5 : 0.0;
  const getBigrams = (str) => {
    const set = new Set();
    for (let i = 0; i < str.length - 1; i++) set.add(str.slice(i, i + 2));
    return set;
  };
  const b1 = getBigrams(s1);
  const b2 = getBigrams(s2);
  let inter = 0;
  b1.forEach(bg => { if (b2.has(bg)) inter++; });
  return (2.0 * inter) / (b1.size + b2.size || 1);
}

// ─── Composite Token Similarity ───────────────────────────────────────────────
function tokenSimilarity(query, target) {
  if (!query || !target) return 0;
  if (query === target) return 1;

  const lev    = levenshteinSimilarity(query, target);
  const bigram = bigramSimilarity(query, target);
  const skel   = levenshteinSimilarity(consonantSkeleton(query), consonantSkeleton(target));
  const inclusion = (target.includes(query) || query.includes(target))
    ? Math.min(query.length, target.length) / Math.max(query.length, target.length)
    : 0;

  return Math.max(
    lev * 0.50 + bigram * 0.30 + skel * 0.20,
    inclusion
  );
}

// ─── Adaptive Threshold ───────────────────────────────────────────────────────
function adaptiveThreshold(wordLength) {
  if (wordLength <= 3) return 0.48; // Highly tolerant for 3-letter words and spelling
  if (wordLength <= 5) return 0.65;
  if (wordLength <= 8) return 0.60;
  return 0.55;
}

// ─── Parse Voice Command ───────────────────────────────────────────────────────
/**
 * Parse spoken transcript into structured POS action intent.
 * Handles:
 *  - Letter-by-letter spelling ("c o k e" -> "coke")
 *  - Explicit spell queries ("spell c o k e" -> "coke")
 *  - South Asian SOV verb suffixes ("coke 2 ta dao", "duita coke den", "sprite add koro")
 *  - English verb prefixes ("add 2 coke", "search milk", "remove chips")
 *  - Numeric classifiers ("2ta", "duita", "ekta")
 *
 * @param {string} rawTranscript  - Raw spoken text from SpeechRecognition
 * @returns {object} { action, quantity, query, raw }
 */
export const parseVoiceCommand = (rawTranscript = '') => {
  if (!rawTranscript || typeof rawTranscript !== 'string') {
    return { action: 'UNKNOWN', query: '', quantity: 1, raw: '' };
  }

  // Pre-collapse spelled letters so command regexes see unified words
  const preCollapsed = collapseSpelledLetters(rawTranscript);
  let text = fullNormalize(preCollapsed);

  // Normalize numbers with 'ta' / 'ti' suffixes: e.g. "2ta" -> "2"
  text = text.replace(/(\d+)\s*(?:ta|ti|to)\b/gi, '$1');

  // ── 1. Clear Cart ─────────────────────────────────────────────────────────
  if (
    /^(clear|empty|reset|delete)\s*cart$/.test(text) ||
    /^(cart\s*(clear|empty|reset))$/.test(text) ||
    text === 'clear all' ||
    /^(cart\s*(khali|saaf)\s*(koro|korun|dao|den)?)$/.test(text) ||
    text === 'sob mecho' || text === 'sob delete koro'
  ) {
    return { action: 'CLEAR_CART', raw: rawTranscript };
  }

  // ── 2. Checkout / Pay ─────────────────────────────────────────────────────
  if (
    /^(checkout|check out|pay|pay now|complete sale|finish sale|print receipt|done|finish|bill koro|payment koro|pay korte chai)$/.test(text)
  ) {
    return { action: 'CHECKOUT', raw: rawTranscript };
  }

  // ── 3. Hold Bill ──────────────────────────────────────────────────────────
  if (
    /^(hold\s*(this|current)?\s*bill|save\s*bill|bill\s*hold|hold|bill rakho|bill save koro|hold korte chai)$/.test(text)
  ) {
    return { action: 'HOLD_BILL', raw: rawTranscript };
  }

  // ── 4. Explicit Spell Command ─────────────────────────────────────────────
  // e.g. "spell coke", "spelling milk", "spell c o k e"
  const spellMatch = rawTranscript.match(/^(?:spell|spelling|spelled|banan\s*koro|banan)\s+(.+)$/i);
  if (spellMatch) {
    const rawTarget = spellMatch[1].trim();
    const collapsed = collapseSpelledLetters(rawTarget);
    const query = fullNormalize(collapsed);
    return { action: 'SEARCH', query: query || rawTarget, quantity: 1, raw: rawTranscript };
  }

  // ── 5. Remove from Cart (Prefix & Suffix) ───────────────────────────────────
  // Prefix: "remove coke", "delete milk", "bad dao coke"
  const removePrefixMatch = text.match(
    /^(?:remove|delete|discard|cancel|drop|bad\s*dao|bao|felay\s*dao|mecho)\s+(?:from\s*cart\s+)?(.+)$/i
  );
  if (removePrefixMatch) {
    let query = removePrefixMatch[1].trim();
    FILLER_WORDS.forEach(fw => {
      try { query = query.replace(new RegExp(`\\b${fw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), ''); } catch (e) {}
    });
    query = fullNormalize(query);
    return { action: 'REMOVE', query, raw: rawTranscript };
  }

  // Suffix (South Asian SOV): "coke bad dao", "milk felay dao", "pepsi remove koro"
  const removeSuffixMatch = text.match(
    /^(.+?)\s+(?:bad\s*dao|felay\s*dao|remove\s*koro|delete\s*koro|bao|mecho)$/i
  );
  if (removeSuffixMatch) {
    let query = removeSuffixMatch[1].trim();
    FILLER_WORDS.forEach(fw => {
      try { query = query.replace(new RegExp(`\\b${fw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), ''); } catch (e) {}
    });
    query = fullNormalize(query);
    return { action: 'REMOVE', query, raw: rawTranscript };
  }

  // ── 6. Add to Cart (Prefix & Suffix) ───────────────────────────────────────
  // Prefix: "add 2 coke", "put 5 apples in cart", "jog koro 3 milk"
  const addPrefixMatch = text.match(
    /^(?:add|put|buy|cart|take|get|plus|nao|nen|dao|den|lagao|rakho|jog\s*koro|add\s*koro|cart\-e\s*dao)\s+(.+)$/i
  );
  if (addPrefixMatch) {
    let remainder = addPrefixMatch[1].trim();
    FILLER_WORDS.forEach(fw => {
      try { remainder = remainder.replace(new RegExp(`\\b${fw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), ' '); } catch (e) {}
    });
    remainder = remainder.replace(/\s+/g, ' ').trim();

    const tokens = remainder.split(' ');
    let quantity = 1;
    let queryTokens = [...tokens];

    const firstToken = tokens[0];
    if (!isNaN(parseFloat(firstToken)) && isFinite(firstToken)) {
      quantity = parseFloat(firstToken);
      queryTokens = tokens.slice(1);
    } else if (NUMBER_WORDS[firstToken] !== undefined) {
      quantity = NUMBER_WORDS[firstToken];
      queryTokens = tokens.slice(1);
    }

    let query = queryTokens.join(' ').trim();
    if (!query && remainder) query = remainder;
    query = fullNormalize(query);

    return { action: 'ADD', quantity: Math.max(1, quantity), query, raw: rawTranscript };
  }

  // Suffix (South Asian SOV): "coke 2 ta dao", "duita coke den", "sprite add koro", "coke cart-e dao"
  const addSuffixMatch = text.match(
    /^(.+?)\s+(?:add\s*koro|add\s*korun|jog\s*koro|dao|den|rakho|rako|nen|nao|lagao|cart\-e\s*dao|in\s*cart|to\s*cart)$/i
  );
  if (addSuffixMatch) {
    let remainder = addSuffixMatch[1].trim();
    FILLER_WORDS.forEach(fw => {
      try { remainder = remainder.replace(new RegExp(`\\b${fw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), ' '); } catch (e) {}
    });
    remainder = remainder.replace(/\s+/g, ' ').trim();

    const tokens = remainder.split(' ');
    let quantity = 1;
    let queryTokens = [];

    // Check if a quantity word is present anywhere in tokens (e.g. "coke 2", "duita coke", "coke duita")
    for (const token of tokens) {
      if (!isNaN(parseFloat(token)) && isFinite(token)) {
        quantity = parseFloat(token);
      } else if (NUMBER_WORDS[token] !== undefined) {
        quantity = NUMBER_WORDS[token];
      } else {
        queryTokens.push(token);
      }
    }

    let query = queryTokens.join(' ').trim();
    if (!query && remainder) query = remainder;
    query = fullNormalize(query);

    return { action: 'ADD', quantity: Math.max(1, quantity), query, raw: rawTranscript };
  }

  // ── 7. Explicit Search (Prefix & Suffix) ───────────────────────────────────
  // Prefix: "search iphone", "find coffee", "khojo rice"
  const searchPrefixMatch = text.match(
    /^(?:search|find|look\s*for|show|filter|check|khojo|khujte\s*chai|ber\s*koro|dekhao|dekhai)\s+(.+)$/i
  );
  if (searchPrefixMatch) {
    let query = searchPrefixMatch[1].trim();
    FILLER_WORDS.forEach(fw => {
      try { query = query.replace(new RegExp(`\\b${fw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), ' '); } catch (e) {}
    });
    query = fullNormalize(query);
    return { action: 'SEARCH', query, raw: rawTranscript };
  }

  // Suffix: "iphone dekhao", "coffee khojo", "rice ber koro"
  const searchSuffixMatch = text.match(
    /^(.+?)\s+(?:khojo|khujte\s*chai|ber\s*koro|dekhao|dekhai|search\s*koro)$/i
  );
  if (searchSuffixMatch) {
    let query = searchSuffixMatch[1].trim();
    FILLER_WORDS.forEach(fw => {
      try { query = query.replace(new RegExp(`\\b${fw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), ' '); } catch (e) {}
    });
    query = fullNormalize(query);
    return { action: 'SEARCH', query, raw: rawTranscript };
  }

  // ── 8. Fallback: starts with a number ─────────────────────────────────────
  // e.g. "2 coca cola", "duita coke", "5 chips"
  const tokens = text.split(' ');
  if (tokens.length > 1) {
    const first = tokens[0];
    if (!isNaN(parseFloat(first)) && isFinite(first)) {
      return {
        action: 'ADD',
        quantity: Math.max(1, parseFloat(first)),
        query: fullNormalize(tokens.slice(1).join(' ')),
        raw: rawTranscript
      };
    }
    if (NUMBER_WORDS[first] !== undefined) {
      return {
        action: 'ADD',
        quantity: Math.max(1, NUMBER_WORDS[first]),
        query: fullNormalize(tokens.slice(1).join(' ')),
        raw: rawTranscript
      };
    }
  }

  // ── 9. Default: Generic Search ────────────────────────────────────────────
  let cleaned = text;
  FILLER_WORDS.forEach(fw => {
    try { cleaned = cleaned.replace(new RegExp(`\\b${fw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), ' '); } catch (e) {}
  });
  cleaned = fullNormalize(cleaned);

  return { action: 'SEARCH', query: cleaned || text, quantity: 1, raw: rawTranscript };
};

// ─── 3-Letter Trigram Helper ──────────────────────────────────────────────────
/**
 * Check if at least 3 consecutive letters match between two strings,
 * or if query has length >= 3 and is contained in target.
 * "If three letters match, all will show"
 */
export function hasThreeLetterMatch(query = '', target = '') {
  if (!query || !target) return false;
  const q = normalizeText(query).replace(/\s+/g, '');
  const t = normalizeText(target).replace(/\s+/g, '');

  if (q.length < 3 || t.length < 3) return false;

  // Direct containment
  if (t.includes(q) || q.includes(t)) return true;

  // Check every 3-letter sliding trigram
  for (let i = 0; i <= q.length - 3; i++) {
    const trigram = q.slice(i, i + 3);
    if (t.includes(trigram)) {
      return true;
    }
  }

  return false;
}

// ─── Product Fuzzy Matcher (Single Best & All Matches) ─────────────────────────
/**
 * Match a spoken/typed query against a list of products with South Asian accent tolerance.
 * "if three letters match, all will show"
 *
 * Scoring tiers:
 *   100 — Exact barcode / SKU
 *   98  — Exact name (after normalization)
 *   96  — Stripped-spaces exact name match (e.g. "Kit Kat" vs "kitkat", "Coca Cola" vs "cocacola")
 *   90  — Product name starts with query
 *   88  — Query starts with product name
 *   80+ — Product name contains query (substring)
 *   72-88 — 3-Letter match (trigram / 3 consecutive letters anywhere in name/barcode/sku)
 *   55+ — Per-token fuzzy match (Levenshtein + bigram + skeleton)
 *   35+ — Whole-phrase similarity fallback
 *
 * @param {string} query    What the user said / typed
 * @param {Array}  products Product list
 * @param {number} minScore Minimum score threshold
 * @returns {Array} All matching products sorted by score descending
 */
export const findAllMatchingProducts = (query = '', products = [], minScore = 38) => {
  if (!query || !products || products.length === 0) return [];

  const normQuery     = normalizeText(query);
  const corrQuery     = fullNormalize(query);
  const queryTokens   = corrQuery.split(' ').filter(t => t.length > 0);
  const qNoSpace      = corrQuery.replace(/\s+/g, '');
  const qRawNoSpace   = normQuery.replace(/\s+/g, '');

  // Extract all 3-letter trigrams from the query
  const queryTrigrams = [];
  const qClean = qNoSpace.length >= 3 ? qNoSpace : qRawNoSpace;
  for (let i = 0; i <= qClean.length - 3; i++) {
    queryTrigrams.push(qClean.slice(i, i + 3));
  }

  const results = [];

  for (const product of products) {
    const pRaw          = normalizeText(product.name || '');
    const pNorm         = fullNormalize(product.name || '');
    const pBarcode      = normalizeText(product.barcode || product.sku || '');
    const pSku          = normalizeText(product.sku || product.barcode || '');
    const pCategory     = fullNormalize(product.category_name || product.category || '');
    const pTokens       = pNorm.split(' ').filter(t => t.length > 0);
    const pNoSpace      = pNorm.replace(/\s+/g, '');
    const pRawNoSpace   = pRaw.replace(/\s+/g, '');

    let score = 0;

    // ── Tier 1: Exact barcode / SKU ──────────────────────────────────────
    if ([normQuery, corrQuery, qNoSpace].some(q => q && (q === pBarcode || q === pSku))) {
      score = 100;
    }
    // ── Tier 2: Exact name ───────────────────────────────────────────────
    else if (corrQuery === pNorm || normQuery === pRaw) {
      score = 98;
    }
    // ── Tier 2.5: Stripped-spaces match (e.g. "kitkat" ↔ "kit kat") ────
    else if (qNoSpace && pNoSpace && qNoSpace === pNoSpace) {
      score = 96;
    }
    // ── Tier 3: Name starts with query ───────────────────────────────────
    else if (pNorm.startsWith(corrQuery) || pRaw.startsWith(normQuery) || (qNoSpace && pNoSpace.startsWith(qNoSpace))) {
      score = 90;
    }
    // ── Tier 4: Query starts with name ───────────────────────────────────
    else if (corrQuery.startsWith(pNorm) || normQuery.startsWith(pRaw)) {
      score = 88;
    }
    // ── Tier 5: Substring containment (including 3-letter queries like "cok", "pep", "app", "mil")
    else if (
      pNorm.includes(corrQuery) ||
      pRaw.includes(normQuery) ||
      (qNoSpace && qNoSpace.length >= 2 && pNoSpace.includes(qNoSpace)) ||
      (pBarcode && normQuery && pBarcode.includes(normQuery)) ||
      (pSku && normQuery && pSku.includes(normQuery))
    ) {
      score = 80 + (corrQuery.length / (pNorm.length || 1)) * 10;
    }
    // ── Tier 5.5: "If three letters match, all will show" (Trigram / 3-character overlap)
    else if (queryTrigrams.length > 0 && queryTrigrams.some(tri => pNoSpace.includes(tri) || pRawNoSpace.includes(tri) || pBarcode.includes(tri) || pSku.includes(tri))) {
      const matched = queryTrigrams.filter(tri => pNoSpace.includes(tri) || pRawNoSpace.includes(tri) || pBarcode.includes(tri) || pSku.includes(tri));
      const trigramRatio = matched.length / queryTrigrams.length;
      score = 72 + trigramRatio * 16; // 72 to 88 score: guaranteed match!
    }
    else {
      // ── Tier 6: Per-token fuzzy match ─────────────────────────────────
      let totalTokenScore = 0;
      let matchedTokens   = 0;

      for (const qToken of queryTokens) {
        let bestTokenScore = 0;
        for (const pToken of pTokens) {
          const sim = tokenSimilarity(qToken, pToken);
          const threshold = qToken.length <= 3 ? 0.48 : adaptiveThreshold(Math.max(qToken.length, pToken.length));
          if (sim >= threshold) {
            bestTokenScore = Math.max(bestTokenScore, sim);
          } else if (sim > 0.40) {
            bestTokenScore = Math.max(bestTokenScore, sim * 0.5);
          }
        }
        if (bestTokenScore > 0) {
          totalTokenScore += bestTokenScore;
          matchedTokens++;
        }
      }

      if (matchedTokens > 0) {
        const coverage = matchedTokens / queryTokens.length;
        score = 52 + (totalTokenScore / queryTokens.length) * 32 + coverage * 12;
      } else {
        // ── Tier 7: Whole-phrase fallback ────────────────────────────────
        const levSim    = levenshteinSimilarity(corrQuery, pNorm);
        const biSim     = bigramSimilarity(corrQuery, pNorm);
        const skelSim   = levenshteinSimilarity(consonantSkeleton(corrQuery), consonantSkeleton(pNorm));
        const combined  = levSim * 0.50 + biSim * 0.35 + skelSim * 0.15;
        if (combined >= 0.40) {
          score = combined * 60;
        }
      }

      // Category boost
      if (score > 0 && pCategory && (corrQuery.includes(pCategory) || pCategory.includes(corrQuery))) {
        score += 5;
      }
    }

    // In-stock boost
    if (score > 0 && parseFloat(product.stock_quantity || 0) > 0) score += 2;

    if (score >= minScore) {
      results.push({ product, score });
    }
  }

  // Sort highest score first
  return results.sort((a, b) => b.score - a.score);
};

/**
 * Return the single best matching product, or null if none match.
 */
export const findBestMatchingProduct = (query = '', products = []) => {
  const matches = findAllMatchingProducts(query, products, 38);
  return matches.length > 0 ? matches[0] : null;
};

// ─── Text-to-Speech ───────────────────────────────────────────────────────────
/**
 * Speak a message using Web SpeechSynthesis.
 * Picks a natural English voice; falls back gracefully.
 */
export const speakVoice = (message = '', enabled = true) => {
  if (!enabled || !message || typeof window === 'undefined') return;
  if (!('speechSynthesis' in window)) return;

  try {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate   = 1.0;
    utterance.pitch  = 1.0;
    utterance.volume = 0.90;

    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      const preferred = voices.find(v =>
        (v.name.includes('Google') || v.name.includes('Natural') ||
          v.name.includes('Samantha') || v.name.includes('David')) &&
        v.lang.startsWith('en')
      );
      if (preferred) utterance.voice = preferred;
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('Speech synthesis error:', err);
  }
};
