import { MCQItem, ClassLevel, SystemSettings } from '../types';
import { parseMCQText } from './mcqParser';

export interface OfficialMcqProgress {
  date: string;
  classLevel: string;
  currentIndex: number;
  answers: Record<number, { selected: number; isCorrect: boolean; timestamp: number }>;
  attemptedCount: number;
  correctCount: number;
  wrongCount: number;
  isCompleted: boolean;
}

// ─── Deterministic PRNG (Mulberry32) ──────────────────────────────────────────
export function createMulberry32(seedStr: string): () => number {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(31, h) + seedStr.charCodeAt(i) | 0;
  }
  return function () {
    h += 0x6D2B79F5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(arr: T[], rand: () => number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export const getTodayDateKey = (d = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// ─── Local Storage Progress Tracker ──────────────────────────────────────────
export const getOfficialDailyProgress = (userId: string, classLevel: string, dateKey: string): OfficialMcqProgress => {
  const key = `nst_official_mcq_${dateKey}_${classLevel}_${userId}`;
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.date === dateKey && parsed.classLevel === classLevel) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to parse official MCQ progress', e);
  }
  return {
    date: dateKey,
    classLevel,
    currentIndex: 0,
    answers: {},
    attemptedCount: 0,
    correctCount: 0,
    wrongCount: 0,
    isCompleted: false,
  };
};

export const saveOfficialDailyProgress = (userId: string, progress: OfficialMcqProgress): void => {
  const key = `nst_official_mcq_${progress.date}_${progress.classLevel}_${userId}`;
  try {
    localStorage.setItem(key, JSON.stringify(progress));
  } catch (e) {
    console.warn('Failed to save official MCQ progress', e);
  }
};

export const clearOfficialDailyProgress = (userId: string, classLevel: string, dateKey: string): void => {
  const key = `nst_official_mcq_${dateKey}_${classLevel}_${userId}`;
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn('Failed to clear official MCQ progress', e);
  }
};

// ─── Curated Base Questions Pool for Standard Classes ─────────────────────────
interface RawQ {
  q: string;
  opts: [string, string, string, string];
  ans: number; // 0, 1, 2, 3
  exp: string;
  subj: string;
  topic?: string;
}

// Generates an expansive bank of high-yield questions for any class
function generateClassCurriculumBank(classLevel: string): RawQ[] {
  const isSenior = ['11', '12'].includes(classLevel);
  const isMiddle = ['6', '7', '8'].includes(classLevel);
  const isPrimary = ['1', '2', '3', '4', '5'].includes(classLevel);
  const isComp = classLevel === 'Competition';

  // Base list of curriculum questions
  const list: RawQ[] = [
    // ── Science / Physics ──
    {
      q: `प्रकाश के परावर्तन (Reflection of Light) के कितने नियम होते हैं?`,
      opts: ['एक', 'दो', 'तीन', 'चार'],
      ans: 1,
      exp: 'प्रकाश के परावर्तन के दो मुख्य नियम हैं: आपतित किरण, परावर्तित किरण और अभिलंब तीनों एक ही तल में होते हैं, तथा आपतन कोण सदैव परावर्तन कोण के बराबर होता है (∠i = ∠r)।',
      subj: 'Physics',
      topic: 'Light'
    },
    {
      q: `उत्तल दर्पण (Convex Mirror) का मुख्य उपयोग किस रूप में किया जाता है?`,
      opts: ['वाहनों के पश्च-दृश्य (Rear View) दर्पण के रूप में', 'सोलर कुकर में', 'टॉर्च के परावर्तक में', 'दंत चिकित्सक द्वारा'],
      ans: 0,
      exp: 'उत्तल दर्पण सदैव सीधा, आभासी और छोटा प्रतिबिंब बनाता है तथा इसका दृष्टि क्षेत्र (Field of view) बहुत विस्तृत होता है, इसलिए वाहनों में साइड मिरर के रूप में प्रयोग किया जाता है।',
      subj: 'Physics',
      topic: 'Optics'
    },
    {
      q: `विद्युत धारा (Electric Current) का SI मात्रक क्या है?`,
      opts: ['वोल्ट (Volt)', 'एम्पीयर (Ampere)', 'ओम (Ohm)', 'जूल (Joule)'],
      ans: 1,
      exp: 'विद्युत धारा का SI मात्रक एम्पीयर (A) है। 1 एम्पीयर = 1 कूलॉम / 1 सेकंड (I = Q/t)।',
      subj: 'Physics',
      topic: 'Electricity'
    },
    {
      q: `ओम का नियम (Ohm\'s Law) किस सूत्र द्वारा व्यक्त किया जाता है?`,
      opts: ['V = I × R', 'V = I / R', 'R = V × I', 'I = V × R'],
      ans: 0,
      exp: 'नियत ताप पर किसी चालक के सिरों के बीच का विभवांतर उसमें प्रवाहित विद्युत धारा के समानुपाती होता है: V = IR।',
      subj: 'Physics',
      topic: 'Electricity'
    },
    {
      q: `विद्युत बल्ब का फिलामेंट (तंतु) किस धातु का बना होता है?`,
      opts: ['ताँबा (Copper)', 'लोहा (Iron)', 'टंगस्टन (Tungsten)', 'नाइक्रोम (Nichrome)'],
      ans: 2,
      exp: 'टंगस्टन का गलनांक (Melting Point) अत्यधिक उच्च (लगभग 3380°C) होता है तथा यह उच्च ताप पर भी नहीं पिघलता, इसलिए बल्ब के फिलामेंट में प्रयुक्त होता है।',
      subj: 'Physics',
      topic: 'Electricity'
    },
    {
      q: `सामान्य दृष्टि के वयस्क के लिए सुस्पष्ट दर्शन की अल्पतम दूरी (Least distance of distinct vision) कितनी होती है?`,
      opts: ['25 मीटर', '2.5 सेमी', '25 सेमी', 'अनंत'],
      ans: 2,
      exp: 'मानव नेत्र की न्यूनतम सुस्पष्ट दर्शन दूरी 25 सेंटीमीटर (25 cm) होती है।',
      subj: 'Physics',
      topic: 'Human Eye'
    },
    {
      q: `निकट दृष्टि दोष (Myopia) को दूर करने के लिए किस लेंस का उपयोग किया जाता है?`,
      opts: ['उत्तल लेंस', 'अवतल लेंस', 'द्विफोकसी लेंस', 'बेलनाकार लेंस'],
      ans: 1,
      exp: 'निकट दृष्टि दोष (Myopia) में दूर की वस्तुएं स्पष्ट नहीं दिखतीं। इसे अवतल लेंस (Concave lens) द्वारा ठीक किया जाता है।',
      subj: 'Physics',
      topic: 'Human Eye'
    },
    {
      q: `तारों का टिमटिमाना (Twinkling of Stars) प्रकाश की किस परिघटना का परिणाम है?`,
      opts: ['प्रकाश का प्रकीर्णन', 'वायुमंडलीय अपवर्तन (Atmospheric Refraction)', 'प्रकाश का परावर्तन', 'वर्ण विक्षेपण'],
      ans: 1,
      exp: 'पृथ्वी के वायुमंडल की विभिन्न परतों का घनत्व और अपवर्तनांक निरंतर बदलता रहता है, जिससे तारों का प्रकाश लगातार अपवर्तित होता है और तारे टिमटिमाते प्रतीत होते हैं।',
      subj: 'Physics',
      topic: 'Human Eye'
    },
    {
      q: `आकाश का रंग नीला दिखाई देने का मुख्य कारण क्या है?`,
      opts: ['प्रकाश का अपवर्तन', 'प्रकाश का प्रकीर्णन (Scattering of Light)', 'प्रकाश का परावर्तन', 'प्रकाश का अवशोषण'],
      ans: 1,
      exp: 'रैले के प्रकीर्णन नियमानुसार कम तरंगदैर्ध्य (नीले रंग) का प्रकीर्णन वायुमंडल के सूक्ष्म कणों द्वारा सबसे अधिक होता है, जिससे आकाश नीला दिखाई देता है।',
      subj: 'Physics',
      topic: 'Optics'
    },
    {
      q: `विद्युत हीटर की कुंडली (Coil) किस तार की बनी होती है?`,
      opts: ['नाइक्रोम (Nichrome)', 'ताँबा', 'जस्ता', 'टंगस्टन'],
      ans: 0,
      exp: 'नाइक्रोम (निकेल + क्रोमियम) की प्रतिरोधकता उच्च होती है और यह उच्च ताप पर आसानी से ऑक्सीकृत नहीं होता।',
      subj: 'Physics',
      topic: 'Electricity'
    },

    // ── Chemistry ──
    {
      q: `मैग्नीशियम रिबन को वायु में जलाने पर बनने वाला श्वेत भस्म क्या है?`,
      opts: ['मैग्नीशियम हाइड्रोक्साइड', 'मैग्नीशियम ऑक्साइड (MgO)', 'मैग्नीशियम कार्बोनेट', 'मैग्नीशियम क्लोराइड'],
      ans: 1,
      exp: '2Mg + O₂ → 2MgO (मैग्नीशियम ऑक्साइड)। यह एक संयोजन (Combination) एवं रासायनिक परिवर्तन है।',
      subj: 'Chemistry',
      topic: 'Reactions'
    },
    {
      q: `लोहे पर जंग लगना (Rusting of Iron) किस प्रकार की अभिक्रिया है?`,
      opts: ['रेडॉक्स एवं संक्षारण (Corrosion)', 'अपघटन अभिक्रिया', 'विस्थापन अभिक्रिया', 'उभय अपघटन'],
      ans: 0,
      exp: 'नमी और ऑक्सीजन की उपस्थिति में लोहे का मंद दहन/ऑक्सीकरण होकर जलयोजित फेरिक ऑक्साइड (Fe₂O₃.xH₂O) बनता है, जो एक रेडॉक्स संक्षारण प्रक्रिया है।',
      subj: 'Chemistry',
      topic: 'Corrosion'
    },
    {
      q: `लिटमस विलयन जो बैंगनी रंग का रंजक होता है, किससे निष्कर्षित किया जाता है?`,
      opts: ['लाइकेन (Lichen)', 'लाल पत्तागोभी', 'हल्दी', 'पेटुनिया फूल'],
      ans: 0,
      exp: 'प्राकृतिक सूचक लिटमस थैलोफाइटा समूह के लाइकेन (Lichen) पौधे से निकाला जाता है।',
      subj: 'Chemistry',
      topic: 'Acids and Bases'
    },
    {
      q: `अम्लीय विलयन का pH मान कितना होता है?`,
      opts: ['7 से अधिक', '7 के बराबर', '7 से कम', '14'],
      ans: 2,
      exp: 'उदासीन विलयन का pH 7 होता है, अम्लीय विलयन का pH < 7 होता है, और क्षारीय विलयन का pH > 7 होता है।',
      subj: 'Chemistry',
      topic: 'pH Scale'
    },
    {
      q: `शुद्ध जल (Pure Water) का pH मान कितना होता है?`,
      opts: ['0', '7', '14', '1'],
      ans: 1,
      exp: 'शुद्ध जल उदासीन होता है, अतः 25°C पर इसका pH मान 7 होता है।',
      subj: 'Chemistry',
      topic: 'Acids and Bases'
    },
    {
      q: `बेकिंग सोडा (खाने का सोडा) का रासायनिक सूत्र क्या है?`,
      opts: ['Na₂CO₃.10H₂O', 'NaHCO₃ (सोडियम हाइड्रोजन कार्बोनेट)', 'Ca(OH)₂', 'CaOCl₂'],
      ans: 1,
      exp: 'खाने वाले सोडे का रासायनिक नाम सोडियम बाइकार्बोनेट (NaHCO₃) है।',
      subj: 'Chemistry',
      topic: 'Salts'
    },
    {
      q: `विरंजक चूर्ण (Bleaching Powder) का रासायनिक सूत्र क्या है?`,
      opts: ['CaOCl₂', 'CaCl₂', 'CaCO₃', 'CaSO₄'],
      ans: 0,
      exp: 'शुष्क बुझे हुए चूने पर क्लोरीन गैस प्रवाहित करने से ब्लीचिंग पाउडर (CaOCl₂) बनता है।',
      subj: 'Chemistry',
      topic: 'Compounds'
    },
    {
      q: `कमरे के ताप पर द्रव अवस्था में पाई जाने वाली एकमात्र धातु कौन-सी है?`,
      opts: ['पारा (Mercury / Hg)', 'ब्रोमीन (Bromine)', 'सोडियम (Sodium)', 'गैलियम (Gallium)'],
      ans: 0,
      exp: 'पारा (Hg) एकमात्र ऐसी धातु है जो कमरे के सामान्य ताप पर द्रव (Liquid) रूप में रहती है। (ब्रोमीन द्रव अधातु है)।',
      subj: 'Chemistry',
      topic: 'Metals'
    },
    {
      q: `सीसा और टिन की मिश्रधातु को क्या कहते हैं?`,
      opts: ['सोल्डर (Solder)', 'पीतल (Brass)', 'कांसा (Bronze)', 'स्टील (Steel)'],
      ans: 0,
      exp: 'सोल्डर (Solder) सीसा (Pb) और टिन (Sn) की मिश्रधातु है, जिसका गलनांक बहुत कम होता है और यह तारों को जोड़ने के काम आती है।',
      subj: 'Chemistry',
      topic: 'Alloys'
    },
    {
      q: `प्राकृतिक रबर किसका बहुलक (Polymer) है?`,
      opts: ['आइसोप्रीन (Isoprene)', 'ब्युटाडाईन', 'एथिलीन', 'वाइनिल क्लोराइड'],
      ans: 0,
      exp: 'प्राकृतिक रबर सिस-1,4-पॉलीआइसोप्रीन (Isoprene) का बहुलक होता है।',
      subj: 'Chemistry',
      topic: 'Polymers'
    },

    // ── Biology ──
    {
      q: `पौधों में जाइलम (Xylem) ऊतक का मुख्य कार्य क्या है?`,
      opts: ['जल और खनिजों का संवहन', 'भोजन का संवहन', 'अमीनो अम्ल का वहन', 'ऑक्सीजन का वहन'],
      ans: 0,
      exp: 'जाइलम (Xylem) जड़ों द्वारा अवशोषित जल और खनिज लवणों को पत्तियों तक पहुँचाता है, जबकि फ्लोएम (Phloem) भोजन का संवहन करता है।',
      subj: 'Biology',
      topic: 'Transportation'
    },
    {
      q: `मानव हृदय में कितने कोष्ठ (Chambers) होते हैं?`,
      opts: ['दो', 'तीन', 'चार', 'पाँच'],
      ans: 2,
      exp: 'मानव हृदय में 4 कोष्ठ होते हैं: दो अलिंद (Atria) और दो निलय (Ventricles)।',
      subj: 'Biology',
      topic: 'Circulation'
    },
    {
      q: `प्रकाश संश्लेषण (Photosynthesis) के दौरान कौन-सी गैस उत्सर्जित होती है?`,
      opts: ['कार्बन डाइऑक्साइड (CO₂)', 'ऑक्सीजन (O₂)', 'नाइट्रोजन (N₂)', 'हाइड्रोजन (H₂)'],
      ans: 1,
      exp: 'प्रकाश संश्लेषण में जल के प्रकाशीय अपघटन (Photolysis) से ऑक्सीजन गैस (O₂) मुक्त होती है।',
      subj: 'Biology',
      topic: 'Photosynthesis'
    },
    {
      q: `मानव शरीर की सबसे बड़ी ग्रंथि (Largest Gland) कौन-सी है?`,
      opts: ['यकृत (Liver)', 'अग्न्याशय (Pancreas)', 'थायरॉयड (Thyroid)', 'पीयूष ग्रंथि (Pituitary)'],
      ans: 0,
      exp: 'मानव शरीर की सबसे बड़ी ग्रंथि यकृत (Liver) है, जिसका वजन लगभग 1.5 किग्रा होता है और यह पित्त रस स्रावित करती है।',
      subj: 'Biology',
      topic: 'Digestion'
    },
    {
      q: `कोशिका का 'ऊर्जा गृह' (Powerhouse of the Cell) किसे कहा जाता है?`,
      opts: ['माइटोकॉन्ड्रिया (Mitochondria)', 'राइबोसोम', 'लाइसोसोम', 'गॉल्जीकाय'],
      ans: 0,
      exp: 'माइटोकॉन्ड्रिया में कोशिकीय श्वसन द्वारा ATP (Adenosine Triphosphate) के रूप में ऊर्जा बनती है।',
      subj: 'Biology',
      topic: 'Cell Biology'
    },
    {
      q: `वृक्क (Kidney) की संरचनात्मक एवं क्रियात्मक इकाई क्या कहलाती है?`,
      opts: ['नेफ्रॉन (Nephron)', 'न्यूरॉन (Neuron)', 'ग्लोमेरुलस', 'मूत्रवाहिनी'],
      ans: 0,
      exp: 'वृक्क की सूक्ष्म कार्यात्मक इकाई को नेफ्रॉन (वृक्काणु) कहा जाता है। न्यूरॉन तंत्रिका तंत्र की इकाई है।',
      subj: 'Biology',
      topic: 'Excretion'
    },
    {
      q: `इंसुलिन (Insulin) हार्मोन की कमी से कौन-सा रोग होता है?`,
      opts: ['मधुमेह (Diabetes)', 'घेंघा (Goitre)', 'एनीमिया', 'स्कर्वी'],
      ans: 0,
      exp: 'अग्न्याशय की लैंगरहेंस की द्वीपिकाओं की बीटा कोशिकाओं से इंसुलिन स्रावित होता है। इसकी कमी से रक्त में शर्करा बढ़ जाती है और मधुमेह रोग होता है।',
      subj: 'Biology',
      topic: 'Endocrine System'
    },
    {
      q: `रक्त का थक्का (Blood Clotting) बनने में कौन-सा विटामिन सहायक होता है?`,
      opts: ['विटामिन A', 'विटामिन C', 'विटामिन D', 'विटामिन K'],
      ans: 3,
      exp: 'विटामिन K यकृत में प्रोथ्रोम्बिन के निर्माण के लिए आवश्यक है, जो रक्त का थक्का जमाने में मुख्य भूमिका निभाता है।',
      subj: 'Biology',
      topic: 'Vitamins'
    },
    {
      q: `मानव शरीर में गुणसूत्रों (Chromosomes) की कुल संख्या कितनी होती है?`,
      opts: ['44 (22 जोड़े)', '46 (23 जोड़े)', '48 (24 जोड़े)', '23'],
      ans: 1,
      exp: 'मानव शरीर की प्रत्येक कायिक कोशिका में 46 गुणसूत्र (23 जोड़े) पाए जाते हैं, जिनमें 22 जोड़े ऑटोसोम और 1 जोड़ा लिंग गुणसूत्र होते हैं।',
      subj: 'Biology',
      topic: 'Genetics'
    },
    {
      q: `अनुवांशिकी का जनक (Father of Genetics) किसे कहा जाता है?`,
      opts: ['ग्रेगर जॉन मेंडल (Gregor Mendel)', 'चार्ल्स डार्विन', 'लुई पाश्चर', 'हरगोविंद खुराना'],
      ans: 0,
      exp: 'ग्रेगर जॉन मेंडल ने मटर के पौधे (Pisum sativum) पर संकरण प्रयोग करके अनुवांशिकता के मूल नियमों की खोज की।',
      subj: 'Biology',
      topic: 'Genetics'
    },

    // ── Mathematics ──
    {
      q: `यदि किसी वृत्त की त्रिज्या $r$ है, तो उसका क्षेत्रफल (Area) क्या होगा?`,
      opts: ['$\\pi r^2$', '$2\\pi r$', '$\\frac{4}{3}\\pi r^3$', '$4\\pi r^2$'],
      ans: 0,
      exp: 'वृत्त का क्षेत्रफल $A = \\pi r^2$ होता है, तथा वृत्त की परिधि $2\\pi r$ होती है।',
      subj: 'Mathematics',
      topic: 'Circles'
    },
    {
      q: `द्विघात समीकरण $ax^2 + bx + c = 0$ के मूल वास्तविक और समान होंगे यदि विविक्तकर (Discriminant $D$):`,
      opts: ['$D = 0$', '$D > 0$', '$D < 0$', '$D \\le 0$'],
      ans: 0,
      exp: 'जब विविक्तकर $D = b^2 - 4ac = 0$ होता है, तो द्विघात समीकरण के दोनों मूल वास्तविक और आपस में समान होते हैं ($x = -b / 2a$)।',
      subj: 'Mathematics',
      topic: 'Quadratic Equations'
    },
    {
      q: `त्रिकोणमिति में $\\sin^2\\theta + \\cos^2\\theta$ का मान सदैव क्या होता है?`,
      opts: ['0', '1', '-1', '2'],
      ans: 1,
      exp: 'मूलभूत त्रिकोणमितीय सर्वसमिका के अनुसार किसी भी कोण $\\theta$ के लिए $\\sin^2\\theta + \\cos^2\\theta = 1$ होता है।',
      subj: 'Mathematics',
      topic: 'Trigonometry'
    },
    {
      q: `समांतर श्रेढ़ी (A.P.) का $n$ वाँ पद ज्ञात करने का सूत्र क्या है?`,
      opts: ['$a_n = a + (n - 1)d$', '$a_n = a + nd$', '$a_n = a - (n - 1)d$', '$a_n = \\frac{n}{2}(2a + d)$'],
      ans: 0,
      exp: 'प्रथम पद $a$ और सार्वअंतर $d$ वाली AP का $n$ वाँ पद $a_n = a + (n - 1)d$ होता है।',
      subj: 'Mathematics',
      topic: 'Arithmetic Progression'
    },
    {
      q: `किसी निश्चित घटना की प्रायिकता (Probability of a Certain Event) कितनी होती है?`,
      opts: ['0', '0.5', '1', 'अपरिभाषित'],
      ans: 2,
      exp: 'निश्चित (Sure) घटना की प्रायिकता सदैव 1 होती है तथा असंभव घटना की प्रायिकता 0 होती है। किसी भी घटना की प्रायिकता $0 \\le P(E) \\le 1$ होती है।',
      subj: 'Mathematics',
      topic: 'Probability'
    },
    {
      q: `मूल बिंदु (Origin) के निर्देशांक क्या होते हैं?`,
      opts: ['(0, 0)', '(1, 1)', '(0, 1)', '(1, 0)'],
      ans: 0,
      exp: 'X-अक्ष और Y-अक्ष जहाँ परस्पर प्रतिच्छेद करते हैं, उसे मूल बिंदु कहा जाता है और इसके निर्देशांक (0, 0) होते हैं।',
      subj: 'Mathematics',
      topic: 'Coordinate Geometry'
    },
    {
      q: `पाइथागोरस प्रमेय (Pythagoras Theorem) किस त्रिभुज पर लागू होता है?`,
      opts: ['समकोण त्रिभुज (Right-angled triangle)', 'समबाहु त्रिभुज', 'विषमबाहु त्रिभुज', 'अधिक कोण त्रिभुज'],
      ans: 0,
      exp: 'समकोण त्रिभुज में कर्ण का वर्ग अन्य दो भुजाओं के वर्गों के योग के बराबर होता है: $H^2 = P^2 + B^2$।',
      subj: 'Mathematics',
      topic: 'Geometry'
    },
    {
      q: `सबसे छोटी अभाज्य संख्या (Smallest Prime Number) कौन-सी है?`,
      opts: ['0', '1', '2', '3'],
      ans: 2,
      exp: '2 सबसे छोटी और एकमात्र सम (Even) अभाज्य संख्या है। 1 न तो अभाज्य है और न ही भाज्य।',
      subj: 'Mathematics',
      topic: 'Number System'
    },
    {
      q: `यदि $\\tan\\theta = 1$ हो, तो न्यूनकोण $\\theta$ का मान क्या होगा?`,
      opts: ['30°', '45°', '60°', '90°'],
      ans: 1,
      exp: '$\\tan 45^\\circ = 1$ होता है। अतः $\\theta = 45^\\circ$।',
      subj: 'Mathematics',
      topic: 'Trigonometry'
    },
    {
      q: `एक पासे (Die) को एक बार फेंकने पर अभाज्य संख्या आने की प्रायिकता क्या है?`,
      opts: ['$\\frac{1}{2}$', '$\\frac{1}{3}$', '$\\frac{1}{6}$', '$\\frac{2}{3}$'],
      ans: 0,
      exp: 'कुल संभव परिणाम = {1, 2, 3, 4, 5, 6} (6)। अभाज्य संख्याएँ = {2, 3, 5} (3)। प्रायिकता = 3/6 = 1/2।',
      subj: 'Mathematics',
      topic: 'Probability'
    },

    // ── Social Science / History / Polity / Geography ──
    {
      q: `भारत का संविधान किस तिथि को पूर्ण रूप से लागू हुआ था?`,
      opts: ['26 नवंबर 1949', '26 जनवरी 1950', '15 अगस्त 1947', '30 जनवरी 1948'],
      ans: 1,
      exp: 'भारत का संविधान 26 जनवरी 1950 को प्रभावी रूप से लागू हुआ, इसी उपलक्ष्य में प्रतिवर्ष गणतंत्र दिवस मनाया जाता है। (अंगीकृत 26 नवंबर 1949 को किया गया था)।',
      subj: 'Civics',
      topic: 'Constitution'
    },
    {
      q: `भारतीय संविधान का जनक (Father of Indian Constitution) किसे माना जाता है?`,
      opts: ['महात्मा गांधी', 'डॉ. भीमराव अंबेडकर', 'डॉ. राजेंद्र प्रसाद', 'पंडित जवाहरलाल नेहरू'],
      ans: 1,
      exp: 'डॉ. बी. आर. अंबेडकर संविधान सभा की प्रारूप समिति (Drafting Committee) के अध्यक्ष थे।',
      subj: 'Civics',
      topic: 'Constitution'
    },
    {
      q: `भारत के प्रथम राष्ट्रपति कौन थे?`,
      opts: ['डॉ. एस. राधाकृष्णन', 'डॉ. राजेंद्र प्रसाद', 'सरदार वल्लभभाई पटेल', 'ज़ाकिर हुसैन'],
      ans: 1,
      exp: 'डॉ. राजेंद्र प्रसाद 26 जनवरी 1950 से 1962 तक भारत के प्रथम राष्ट्रपति रहे।',
      subj: 'Civics',
      topic: 'Governance'
    },
    {
      q: `चंपारण सत्याग्रह (Champaran Satyagraha) गांधीजी ने किस वर्ष शुरू किया था?`,
      opts: ['1915', '1917', '1919', '1920'],
      ans: 1,
      exp: '1917 में बिहार के चंपारण में तिनकठिया प्रथा (नील की जबरन खेती) के विरोध में गांधीजी ने भारत में अपना पहला सत्याग्रह किया।',
      subj: 'History',
      topic: 'Freedom Movement'
    },
    {
      q: `जलियांवाला बाग हत्याकांड कब घटित हुआ था?`,
      opts: ['13 अप्रैल 1919', '10 मार्च 1919', '15 अगस्त 1919', '26 जनवरी 1920'],
      ans: 0,
      exp: '13 अप्रैल 1919 (बैसाखी के दिन) अमृतसर के जलियांवाला बाग में रॉलेट एक्ट के विरोध में एकत्र निहत्थी भीड़ पर जनरल डायर ने गोलियां चलवाई थीं।',
      subj: 'History',
      topic: 'Modern History'
    },
    {
      q: `विश्व का सबसे बड़ा लोकतांत्रिक देश कौन-सा है?`,
      opts: ['संयुक्त राज्य अमेरिका', 'रूस', 'भारत', 'चीन'],
      ans: 2,
      exp: 'भारत जनसंख्या और मतदाता संख्या के आधार पर विश्व का सबसे बड़ा लोकतंत्र है।',
      subj: 'Civics',
      topic: 'Democracy'
    },
    {
      q: `भारत की सबसे लंबी नदी कौन-सी है?`,
      opts: ['ब्रह्मपुत्र', 'गंगा (Ganga)', 'गोदावरी', 'यमुना'],
      ans: 1,
      exp: 'गंगा नदी भारत की सबसे लंबी नदी है, जिसकी कुल लंबाई लगभग 2525 किमी है।',
      subj: 'Geography',
      topic: 'Rivers'
    },
    {
      q: `कर्क रेखा (Tropic of Cancer) भारत के कितने राज्यों से होकर गुजरती है?`,
      opts: ['6', '7', '8', '9'],
      ans: 2,
      exp: 'कर्क रेखा (23.5° N) भारत के 8 राज्यों से गुजरती है: गुजरात, राजस्थान, मध्य प्रदेश, छत्तीसगढ़, झारखंड, पश्चिम बंगाल, त्रिपुरा और मिजोरम।',
      subj: 'Geography',
      topic: 'Indian Geography'
    },
    {
      q: `काली मिट्टी (Black Soil) किस फसल की खेती के लिए सर्वाधिक उपयुक्त मानी जाती है?`,
      opts: ['कपास (Cotton)', 'गेहूं', 'चावल', 'चाय'],
      ans: 0,
      exp: 'काली मिट्टी को रेगुर मिट्टी भी कहते हैं। इसमें नमी धारण करने की उच्च क्षमता होती है, जो कपास की खेती के लिए सर्वोत्तम है।',
      subj: 'Geography',
      topic: 'Soils'
    },
    {
      q: `भारत में 'हरित क्रांति' (Green Revolution) का जनक किसे कहा जाता है?`,
      opts: ['डॉ. एम. एस. स्वामीनाथन', 'डॉ. वर्गीज कुरियन', 'सैम पित्रोदा', 'होमी जहांगीर भाभा'],
      ans: 0,
      exp: 'भारत में उच्च उपज वाले बीजों (HYV) के उपयोग से कृषि उत्पादन बढ़ाने के लिए डॉ. एम. एस. स्वामीनाथन को हरित क्रांति का जनक कहा जाता है। (विश्व में नॉर्मन बोरलॉग)।',
      subj: 'Economics',
      topic: 'Agriculture'
    },
  ];

  return list;
}

// ─── Procedural Question Generator to ensure 100 questions ───────────────────
// Generates diverse, syllabus-aligned questions using math/science/logic formulas
export function generateProceduralQuestions(classLevel: string, startIdx: number, needed: number, rand: () => number): RawQ[] {
  const result: RawQ[] = [];
  const subjects = ['Physics', 'Chemistry', 'Biology', 'Mathematics', 'History', 'Geography', 'Civics', 'Hindi', 'English', 'General Knowledge'];

  const templates = [
    // Mathematics
    () => {
      const a = Math.floor(rand() * 15) + 2;
      const b = Math.floor(rand() * 10) + 1;
      const sum = a + b;
      const diff = a - b;
      return {
        q: `यदि दो संख्याओं का योग ${sum} और अंतर ${diff} है, तो बड़ी संख्या क्या होगी?`,
        opts: [`${a}`, `${b}`, `${sum}`, `${a + 2}`] as [string, string, string, string],
        ans: 0,
        exp: `माना संख्याएँ x और y हैं। x + y = ${sum}, x - y = ${diff}। दोनों को जोड़ने पर 2x = ${sum + diff} ⇒ x = ${a}।`,
        subj: 'Mathematics',
        topic: 'Linear Equations'
      };
    },
    () => {
      const side = Math.floor(rand() * 10) + 3;
      const area = side * side;
      const peri = 4 * side;
      return {
        q: `एक वर्गाकार पार्क की भुजा ${side} मीटर है। उसका परिमाप (Perimeter) क्या होगा?`,
        opts: [`${peri} मीटर`, `${area} मीटर²`, `${peri + 4} मीटर`, `${peri - 2} मीटर`] as [string, string, string, string],
        ans: 0,
        exp: `वर्ग का परिमाप = 4 × भुजा = 4 × ${side} = ${peri} मीटर।`,
        subj: 'Mathematics',
        topic: 'Mensuration'
      };
    },
    () => {
      const r = Math.floor(rand() * 5) * 7 + 7; // multiple of 7
      const peri = (2 * 22 * r) / 7;
      return {
        q: `एक वृत्त की त्रिज्या ${r} सेमी है। उसकी परिधि (Circumference) ज्ञात कीजिए (π = 22/7 लें):`,
        opts: [`${peri} सेमी`, `${peri + 10} सेमी`, `${peri - 4} सेमी`, `${(peri / 2)} सेमी`] as [string, string, string, string],
        ans: 0,
        exp: `वृत्त की परिधि = 2πr = 2 × (22/7) × ${r} = ${peri} सेमी।`,
        subj: 'Mathematics',
        topic: 'Circles'
      };
    },
    () => {
      const num = Math.floor(rand() * 20) + 10;
      const sq = num * num;
      return {
        q: `संख्या ${num} का वर्ग (Square) क्या होगा?`,
        opts: [`${sq}`, `${sq + 10}`, `${sq - 10}`, `${sq + 20}`] as [string, string, string, string],
        ans: 0,
        exp: `${num} × ${num} = ${sq}।`,
        subj: 'Mathematics',
        topic: 'Arithmetic'
      };
    },
    // Science - Physics
    () => {
      const masses = [2, 5, 10, 15, 20];
      const accs = [2, 3, 4, 5];
      const m = masses[Math.floor(rand() * masses.length)];
      const a = accs[Math.floor(rand() * accs.length)];
      const f = m * a;
      return {
        q: `न्यूटन के द्वितीय गति नियमानुसार, यदि किसी ${m} kg द्रव्यमान की वस्तु पर बल लगाने से उसमें ${a} m/s² का त्वरण उत्पन्न होता है, तो आरोपित बल (Force) का मान क्या होगा?`,
        opts: [`${f} न्यूटन (N)`, `${f + 5} N`, `${f * 2} N`, `${Math.max(1, f - 4)} N`] as [string, string, string, string],
        ans: 0,
        exp: `न्यूटन का दूसरा नियम: F = m × a = ${m} kg × ${a} m/s² = ${f} N।`,
        subj: 'Physics',
        topic: 'Laws of Motion'
      };
    },
    () => {
      const vVals = [10, 12, 20, 24];
      const rVals = [2, 4, 5, 6];
      const v = vVals[Math.floor(rand() * vVals.length)];
      const r = rVals[Math.floor(rand() * rVals.length)];
      const i = (v / r).toFixed(1);
      return {
        q: `यदि किसी चालक के सिरों पर विभवांतर ${v} V है और उसका प्रतिरोध ${r} Ω है, तो प्रवाहित धारा का मान क्या होगा?`,
        opts: [`${i} एम्पीयर`, `${Number(i) + 1} A`, `${(Number(i) * 2).toFixed(1)} A`, `${(Number(i) / 2).toFixed(1)} A`] as [string, string, string, string],
        ans: 0,
        exp: `ओम के नियम से: I = V / R = ${v} / ${r} = ${i} A।`,
        subj: 'Physics',
        topic: 'Electricity'
      };
    },
    // Science - Chemistry
    () => {
      const elements = [
        { name: 'ऑक्सीजन (Oxygen)', sym: 'O', atNo: 8, mass: 16 },
        { name: 'सोडियम (Sodium)', sym: 'Na', atNo: 11, mass: 23 },
        { name: 'कार्बन (Carbon)', sym: 'C', atNo: 6, mass: 12 },
        { name: 'कैल्शियम (Calcium)', sym: 'Ca', atNo: 20, mass: 40 },
        { name: 'लोहा (Iron)', sym: 'Fe', atNo: 26, mass: 56 },
        { name: 'हीलियम (Helium)', sym: 'He', atNo: 2, mass: 4 },
        { name: 'क्लोरीन (Chlorine)', sym: 'Cl', atNo: 17, mass: 35.5 }
      ];
      const el = elements[Math.floor(rand() * elements.length)];
      return {
        q: `तत्व '${el.name}' की परमाणु संख्या (Atomic Number) कितनी है?`,
        opts: [`${el.atNo}`, `${el.atNo + 2}`, `${Math.max(1, el.atNo - 2)}`, `${el.atNo + 4}`] as [string, string, string, string],
        ans: 0,
        exp: `${el.name} (प्रतीक: ${el.sym}) की परमाणु संख्या ${el.atNo} है।`,
        subj: 'Chemistry',
        topic: 'Periodic Table'
      };
    },
    () => {
      const acids = [
        { source: 'सिरका (Vinegar)', acid: 'एसिटिक अम्ल (Acetic Acid)' },
        { source: 'टमाटर (Tomato)', acid: 'ऑक्सैलिक अम्ल (Oxalic Acid)' },
        { source: 'संतरा एवं नींबू (Citrus)', acid: 'साइट्रिक अम्ल (Citric Acid)' },
        { source: 'दही (Curd)', acid: 'लैक्टिक अम्ल (Lactic Acid)' },
        { source: 'चींटी का डंक (Ant sting)', acid: 'मेथेनॉइक अम्ल / फॉर्मिक अम्ल' },
        { source: 'इमली (Tamarind)', acid: 'टार्टरिक अम्ल (Tartaric Acid)' }
      ];
      const item = acids[Math.floor(rand() * acids.length)];
      const wrongs = acids.filter(a => a.source !== item.source).map(a => a.acid);
      return {
        q: `'${item.source}' में मुख्य रूप से कौन-सा प्राकृतिक अम्ल पाया जाता है?`,
        opts: [item.acid, wrongs[0], wrongs[1], wrongs[2]] as [string, string, string, string],
        ans: 0,
        exp: `${item.source} में प्राकृतिक रूप से ${item.acid} पाया जाता है।`,
        subj: 'Chemistry',
        topic: 'Natural Acids'
      };
    },
    // General Knowledge & History
    () => {
      const capitals = [
        { state: 'बिहार', cap: 'पटना' },
        { state: 'उत्तर प्रदेश', cap: 'लखनऊ' },
        { state: 'महाराष्ट्र', cap: 'मुंबई' },
        { state: 'राजस्थान', cap: 'जयपुर' },
        { state: 'मध्य प्रदेश', cap: 'भोपाल' },
        { state: 'पश्चिम बंगाल', cap: 'कोलकाता' },
        { state: 'तमिलनाडु', cap: 'चेन्नई' },
        { state: 'पंजाब', cap: 'चंडीगढ़' }
      ];
      const item = capitals[Math.floor(rand() * capitals.length)];
      const wrongs = capitals.filter(c => c.state !== item.state).map(c => c.cap);
      return {
        q: `भारत के '${item.state}' राज्य की राजधानी कौन-सी है?`,
        opts: [item.cap, wrongs[0], wrongs[1], wrongs[2]] as [string, string, string, string],
        ans: 0,
        exp: `${item.state} की राजधानी ${item.cap} है।`,
        subj: 'Geography',
        topic: 'States & Capitals'
      };
    },
    // Hindi Grammar / Language
    () => {
      const muhavare = [
        { m: 'अंगूठा दिखाना', mean: 'साफ मना कर देना / इनकार करना' },
        { m: 'ईद का चाँद होना', mean: 'बहुत दिनों बाद दिखाई देना' },
        { m: 'आँखों का तारा होना', mean: 'अत्यधिक प्रिय होना' },
        { m: 'गागर में सागर भरना', mean: 'थोड़े शब्दों में बहुत अधिक कहना' },
        { m: 'दांत खट्टे करना', mean: 'पराजित या हतोत्साहित करना' },
        { m: 'नाक कटना', mean: 'प्रतिष्ठा नष्ट होना' }
      ];
      const item = muhavare[Math.floor(rand() * muhavare.length)];
      const wrongs = muhavare.filter(x => x.m !== item.m).map(x => x.mean);
      return {
        q: `मुहावरे '${item.m}' का सही अर्थ क्या है?`,
        opts: [item.mean, wrongs[0], wrongs[1], wrongs[2]] as [string, string, string, string],
        ans: 0,
        exp: `'${item.m}' का अर्थ '${item.mean}' होता है।`,
        subj: 'Hindi',
        topic: 'Grammar'
      };
    },
    // English Grammar
    () => {
      const opps = [
        { w: 'Ancient', o: 'Modern' },
        { w: 'Abundant', o: 'Scarce' },
        { w: 'Optimistic', o: 'Pessimistic' },
        { w: 'Permanent', o: 'Temporary' },
        { w: 'Expand', o: 'Contract' },
        { w: 'Victory', o: 'Defeat' }
      ];
      const item = opps[Math.floor(rand() * opps.length)];
      const wrongs = opps.filter(x => x.w !== item.w).map(x => x.o);
      return {
        q: `What is the correct Antonym (विपरीतार्थक शब्द) of '${item.w}'?`,
        opts: [item.o, wrongs[0], wrongs[1], wrongs[2]] as [string, string, string, string],
        ans: 0,
        exp: `The antonym of '${item.w}' is '${item.o}'.`,
        subj: 'English',
        topic: 'Vocabulary'
      };
    },
  ];

  for (let i = 0; i < needed; i++) {
    const tmpl = templates[i % templates.length];
    result.push(tmpl());
  }

  return result;
}

// ─── Main Generator: Returns exactly 100 deterministic MCQs for Class + Date ──
// ─── Real App MCQs Loader for Official Mode ──────────────────────────────────
export function getOfficial100Mcqs(
  classLevel: string,
  dateStr = getTodayDateKey(),
  settings?: SystemSettings | null,
  firebaseLessons?: any[]
): MCQItem[] {
  const normTarget = String(classLevel || '').trim().toLowerCase();
  const isCompetition = normTarget === 'competition' || normTarget === 'comp';
  const existingPool: MCQItem[] = [];
  const seenQuestions = new Set<string>();

  // Ensure active settings (fallback to local cached nst_system_settings if props not yet loaded)
  let activeSettings: any = settings;
  if (!activeSettings) {
    try {
      const raw = localStorage.getItem('nst_system_settings');
      if (raw) activeSettings = JSON.parse(raw);
    } catch {}
  }

  const addUnique = (item: any) => {
    if (!item || !item.question) return;
    const qText = String(item.question).trim();
    if (!qText || qText.length < 3) return;
    const optsRaw = Array.isArray(item.options) ? item.options : [];
    if (optsRaw.length < 2) return;
    let opts = optsRaw.map((o: any) => String(o || '').trim()).filter(Boolean);
    if (opts.length < 2) return;
    while (opts.length < 4) {
      opts.push(`Option ${String.fromCharCode(65 + opts.length)}`);
    }
    opts = opts.slice(0, 4);

    const cleanQ = qText.toLowerCase().replace(/\s+/g, ' ');
    if (seenQuestions.has(cleanQ)) return;
    seenQuestions.add(cleanQ);

    let correctAns = 0;
    if (typeof item.correctAnswer === 'number' && item.correctAnswer >= 0 && item.correctAnswer < opts.length) {
      correctAns = item.correctAnswer;
    } else if (Array.isArray(item.correctAnswers) && item.correctAnswers.length > 0) {
      const first = Number(item.correctAnswers[0]);
      if (!isNaN(first) && first >= 0 && first < opts.length) correctAns = first;
    } else if (typeof item.answer === 'number' && item.answer >= 0 && item.answer < opts.length) {
      correctAns = item.answer;
    } else if (typeof item.correctAnswer === 'string') {
      const idx = ['a', 'b', 'c', 'd'].indexOf(item.correctAnswer.trim().toLowerCase());
      if (idx >= 0) correctAns = idx;
    }

    existingPool.push({
      question: qText,
      options: opts,
      correctAnswer: correctAns,
      explanation: item.explanation || item.concept || '',
      topic: item.topic || item.subject || '',
      difficultyLevel: item.difficulty || item.difficultyLevel || 'Medium',
      questionNumber: item.questionNumber,
    });
  };

  // 1. Admin Competition MCQs (saved by Admin in Comp MCQ tab)
  if (isCompetition) {
    if (Array.isArray(activeSettings?.competitionMcqs)) {
      activeSettings.competitionMcqs.forEach(addUnique);
    }
    if (Array.isArray(activeSettings?.competitionPracticeMcqs)) {
      activeSettings.competitionPracticeMcqs.forEach(addUnique);
    }
  } else if (Array.isArray(activeSettings?.competitionMcqs)) {
    // If admin tagged any questions with specific class
    activeSettings.competitionMcqs.forEach((q: any) => {
      const qCls = String(q.classLevel || q.targetClass || '').trim().toLowerCase();
      if (qCls === normTarget) addUnique(q);
    });
  }

  // 2. Admin Homework & Page-Wise Book MCQs (Sar Sangrah, Speedy Science, Speedy Social, Lucent, MCQ Practice, etc.)
  if (Array.isArray(activeSettings?.homework)) {
    for (const hw of activeSettings.homework) {
      if (!hw) continue;
      const targetSub = String(hw.targetSubject || '').trim().toLowerCase();
      const classTarget = String(hw.classTarget || hw.classLevel || '').trim().toLowerCase();

      // Competition subjects include Sar Sangrah, Speedy Science, Speedy Social Science, Lucent, MCQ Practice, custom books, etc.
      const isCompetitionSubject =
        targetSub.includes('sangrah') ||
        targetSub.includes('speedy') ||
        targetSub.includes('lucent') ||
        targetSub === 'mcq' ||
        targetSub === 'current_affairs' ||
        targetSub === 'competition' ||
        targetSub === 'none' ||
        (Array.isArray(activeSettings?.customBooks) &&
          activeSettings.customBooks.some((b: any) => String(b.id).toLowerCase() === targetSub));

      const isMatch = isCompetition
        ? classTarget === 'competition' || classTarget === 'comp' || classTarget === 'all' || !classTarget || isCompetitionSubject
        : classTarget === normTarget || classTarget === 'all';

      if (isMatch) {
        let foundAny = false;
        if (Array.isArray(hw.parsedMcqs) && hw.parsedMcqs.length > 0) {
          hw.parsedMcqs.forEach(addUnique);
          foundAny = true;
        }
        if (Array.isArray(hw.mcqs) && hw.mcqs.length > 0) {
          hw.mcqs.forEach(addUnique);
          foundAny = true;
        }
        if (Array.isArray(hw.mcqList) && hw.mcqList.length > 0) {
          hw.mcqList.forEach(addUnique);
          foundAny = true;
        }
        // If parsed array not present, attempt to parse raw mcqText
        if (!foundAny && typeof hw.mcqText === 'string' && hw.mcqText.trim()) {
          try {
            const parsed = parseMCQText(hw.mcqText.trim());
            if (parsed && Array.isArray(parsed.questions)) {
              parsed.questions.forEach(addUnique);
            }
          } catch (e) {
            console.warn('Error parsing hw mcqText', e);
          }
        }
      }
    }
  }

  // 3. Admin Lucent & Multi-Page Book Notes (Pages contain curated MCQs)
  if (Array.isArray(activeSettings?.lucentNotes)) {
    for (const entry of activeSettings.lucentNotes) {
      if (!entry) continue;
      const entryCls = String(entry.classLevel || 'COMPETITION').trim().toLowerCase();
      const isMatch = isCompetition
        ? entryCls === 'competition' || entryCls === 'comp' || !entry.classLevel
        : entryCls === normTarget;

      if (isMatch && Array.isArray(entry.pages)) {
        for (const page of entry.pages) {
          if (!page) continue;
          let foundPageMcq = false;
          if (Array.isArray(page.mcqs) && page.mcqs.length > 0) {
            page.mcqs.forEach(addUnique);
            foundPageMcq = true;
          }
          if (Array.isArray(page.parsedMcqs) && page.parsedMcqs.length > 0) {
            page.parsedMcqs.forEach(addUnique);
            foundPageMcq = true;
          }
          if (Array.isArray(page.mcqList) && page.mcqList.length > 0) {
            page.mcqList.forEach(addUnique);
            foundPageMcq = true;
          }
          if (!foundPageMcq && typeof page.mcqText === 'string' && page.mcqText.trim()) {
            try {
              const parsed = parseMCQText(page.mcqText.trim());
              if (parsed && Array.isArray(parsed.questions)) {
                parsed.questions.forEach(addUnique);
              }
            } catch {}
          }
        }
      }
    }
  }

  // 4. From Firebase mcq_lessons (Admin Class MCQs & Competition MCQs)
  if (Array.isArray(firebaseLessons)) {
    for (const l of firebaseLessons) {
      if (!l) continue;
      const lCls = String(l.classLevel || '').trim().toLowerCase();
      const isMatch = isCompetition
        ? lCls === 'competition' || lCls === 'comp' || !lCls
        : lCls === normTarget;
      if (isMatch) {
        const qs = Array.isArray(l.mcqs)
          ? l.mcqs
          : Array.isArray(l.mcqList)
          ? l.mcqList
          : Array.isArray(l.parsedMcqs)
          ? l.parsedMcqs
          : [];
        qs.forEach(addUnique);
      }
    }
  }

  // 5. Admin Daily Challenge in settings matching this class
  if (activeSettings?.dailyChallenges && Array.isArray(activeSettings.dailyChallenges)) {
    for (const c of activeSettings.dailyChallenges) {
      const cCls = String(c.classLevel || '').trim().toLowerCase();
      const isMatch = isCompetition
        ? cCls === 'competition' || cCls === 'comp'
        : cCls === normTarget;
      if (c.isActive && isMatch && Array.isArray(c.questions)) {
        c.questions.forEach(addUnique);
      }
    }
  }

  // 6. Global Challenge MCQs
  if (Array.isArray(activeSettings?.globalChallengeMcq)) {
    activeSettings.globalChallengeMcq.forEach((q: any) => {
      const qCls = String(q.classLevel || '').trim().toLowerCase();
      if (!qCls || (isCompetition ? qCls === 'competition' || qCls === 'comp' : qCls === normTarget)) {
        addUnique(q);
      }
    });
  }

  // 7. Scan localStorage for existing content matching this class
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const kLower = k.toLowerCase();
      if (kLower.startsWith('nst_content_')) {
        const isMatch = isCompetition
          ? kLower.includes('competition') || kLower.includes('lucent') || kLower.includes('sangrah') || kLower.includes('speedy')
          : kLower.includes(`_${normTarget}_`) || kLower.includes(`_${normTarget}-`) || kLower.endsWith(`_${normTarget}`);
        if (isMatch) {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            const qs = [
              ...(parsed.manualMcqData || []),
              ...(parsed.mcqList || []),
              ...(parsed.weeklyTestMcqData || []),
              ...(parsed.mcqData || []),
              ...(parsed.parsedMcqs || []),
              ...(parsed.mcqs || []),
            ];
            qs.forEach(addUnique);
          }
        }
      }
    }
  } catch (e) {
    console.warn('Error reading local content for official MCQs', e);
  }

  // 8. Question bank from localStorage
  try {
    const qbRaw = localStorage.getItem('nst_question_bank');
    if (qbRaw) {
      const qb = JSON.parse(qbRaw);
      if (Array.isArray(qb)) {
        qb.filter((item) => {
          const itemCls = String(item.classLevel || '').trim().toLowerCase();
          return isCompetition
            ? itemCls === 'competition' || itemCls === 'comp'
            : itemCls === normTarget;
        }).forEach((item) => addUnique(item.question || item));
      }
    }
  } catch (e) {}

  // CRITICAL RULE: If NO real MCQs exist in the app for this class, return EMPTY array!
  // Do NOT synthesize fake questions or procedural questions!
  if (existingPool.length === 0) {
    return [];
  }

  // If real MCQs exist, deterministically shuffle for today's date and cap at 100
  const seedKey = `${dateStr}_class_${classLevel}_official_v2`;
  const rand = createMulberry32(seedKey);
  const targetCount = Math.min(existingPool.length, 100);
  const shuffledQuestions = seededShuffle(existingPool, rand).slice(0, targetCount);

  return shuffledQuestions;
}
