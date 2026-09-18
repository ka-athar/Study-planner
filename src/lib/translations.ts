export type AppLanguage = 'en' | 'ur';

export interface Translations {
  // Navigation
  dashboard: string;
  syllabus: string;
  planner: string;
  timer: string;
  calendar: string;
  progress: string;
  revision: string;
  tests: string;
  flashcards: string;
  blurt_recall: string;
  knowledge_refurbish: string;
  marks_recovery: string;
  paper_auto_forcing: string;
  mistake_vault: string;
  examiner_red_pen: string;
  knowledge_graph: string;
  boss_battle: string;
  gemini_notebook: string;
  gamification: string;
  virtual_room: string;
  missed_work: string;
  assignments: string;
  classroom: string;
  groups: string;
  vaults: string;
  tutor: string;
  activity: string;
  data_backup: string;
  settings: string;

  // Actions
  start: string;
  cancel: string;
  save: string;
  submit: string;
  close: string;
  back: string;
  export: string;
  restore: string;
  recover: string;
  audit: string;
  search: string;
  completed: string;
  in_progress: string;
  needs_revision: string;
  all_subjects: string;
  
  // Refurbishment & Recovery
  refurbish_title: string;
  refurbish_subtitle: string;
  recovery_title: string;
  recovery_subtitle: string;
  auto_forcing_title: string;
  auto_forcing_subtitle: string;
  language_toggle: string;
}

export const translations: Record<AppLanguage, Translations> = {
  en: {
    dashboard: 'Dashboard',
    syllabus: 'Syllabus',
    planner: 'AI Planner',
    timer: 'Focus Timer',
    calendar: 'Calendar',
    progress: 'Progress',
    revision: 'Revision',
    tests: 'Mock Tests',
    flashcards: 'Flashcards',
    blurt_recall: 'Blurt Recall',
    knowledge_refurbish: 'Refurbish Mode',
    marks_recovery: 'Marks Recovery',
    paper_auto_forcing: 'Exam Auto-Forcing',
    mistake_vault: 'Mistake Vault',
    examiner_red_pen: "Examiner's Pen",
    knowledge_graph: 'Knowledge Graph',
    boss_battle: 'Boss Battle',
    gemini_notebook: 'Study Notebook',
    gamification: 'Quests & XP',
    virtual_room: 'Study Room',
    missed_work: 'Missed Work',
    assignments: 'Assignments',
    classroom: 'Classroom',
    groups: 'Study Groups',
    vaults: 'Storage Vaults',
    tutor: 'AI Tutor',
    activity: 'Activity Log',
    data_backup: 'Data & Backup',
    settings: 'Settings',

    start: 'Start',
    cancel: 'Cancel',
    save: 'Save',
    submit: 'Submit',
    close: 'Close',
    back: 'Back',
    export: 'Export',
    restore: 'Restore',
    recover: 'Recover Marks',
    audit: 'Run Knowledge Audit',
    search: 'Search...',
    completed: 'Mastered',
    in_progress: 'In Progress',
    needs_revision: 'Needs Revision',
    all_subjects: 'All Subjects',

    refurbish_title: 'Knowledge Refurbishment Mode',
    refurbish_subtitle: 'Closed-book recall audit comparing memory against syllabus. Generates compressed correction sheets and master sheets.',
    recovery_title: 'Marks Recovery Engine',
    recovery_subtitle: 'Pinpoints high-yield weak topics and calculates exactly where you can recover lost exam marks.',
    auto_forcing_title: 'Post-Exam Auto-Forcing Diagnostic',
    auto_forcing_subtitle: 'Forces root-cause error classification and confidence calibration instead of passive grade reading.',
    language_toggle: 'Language / زبان'
  },
  ur: {
    dashboard: 'ڈیش بورڈ',
    syllabus: 'نصاب (Syllabus)',
    planner: 'اے آئی منصوبہ ساز',
    timer: 'فوکس ٹائمر',
    calendar: 'کیلنڈر',
    progress: 'کارکردگی',
    revision: 'دہرائی (Revision)',
    tests: 'امتحانی ٹیسٹ',
    flashcards: 'فلیش کارڈز',
    blurt_recall: 'ذہنی دہرائی (Blurt)',
    knowledge_refurbish: 'تجدیدِ علم (Refurbish)',
    marks_recovery: 'نمبر ریکوری انجن',
    paper_auto_forcing: 'امتحانی غلطی تجزیہ',
    mistake_vault: 'غلطیوں کا ریکارڈ',
    examiner_red_pen: 'ممتحن کا قلم (Red Pen)',
    knowledge_graph: 'علمی گراف (Graph)',
    boss_battle: 'امتحانی مقابلہ (Boss)',
    gemini_notebook: 'مطالعہ نوٹ بک',
    gamification: 'انعامات و XP',
    virtual_room: 'مطالعہ کا کمرہ',
    missed_work: 'رہ جانے والا کام',
    assignments: 'اسائنمنٹس',
    classroom: 'کلاس روم',
    groups: 'مطالعہ گروپ',
    vaults: 'اسٹوریج والٹ',
    tutor: 'اے آئی استاد (Tutor)',
    activity: 'سرگرمی لاگ',
    data_backup: 'ڈیٹا و بیک اپ',
    settings: 'ترتیبات (Settings)',

    start: 'شروع کریں',
    cancel: 'منسوخ کریں',
    save: 'محفوظ کریں',
    submit: 'جمع کروائیں',
    close: 'بند کریں',
    back: 'پیچھے جائیں',
    export: 'برآمد کریں (Export)',
    restore: 'بحال کریں (Restore)',
    recover: 'نمبر حاصل کریں',
    audit: 'علمی جانچ کریں',
    search: 'تلاش کریں...',
    completed: 'مکمل عبور',
    in_progress: 'جاری ہے',
    needs_revision: 'دہرائی درکار ہے',
    all_subjects: 'تمام مضامین',

    refurbish_title: 'تجدیدِ علم موڈ (Knowledge Refurbishment)',
    refurbish_subtitle: 'کتاب بند کر کے 3-4 اہم نکات یاد کریں۔ اے آئی نصاب سے تقابل کر کے فوری اصلاحی شیٹ تیار کرے گی۔',
    recovery_title: 'نمبر ریکوری انجن (Marks Recovery)',
    recovery_subtitle: 'کمزور ترین عنوانات کی نشاندہی اور ضائع شدہ نمبر واپس حاصل کرنے کا خودکار نظام۔',
    auto_forcing_title: 'امتحان کے بعد جبری غلطی تجزیہ (Auto-Forcing)',
    auto_forcing_subtitle: 'صرف نمبر دیکھنے کے بجائے غلطی کی اصل وجہ اور اعتماد کی پیمائش کا لازمی عمل۔',
    language_toggle: 'زبان / Language'
  }
};

const LANGUAGE_KEY = 'studyflow_user_lang_v1';

export function getSavedLanguage(): AppLanguage {
  if (typeof window === 'undefined') return 'en';
  try {
    const val = localStorage.getItem(LANGUAGE_KEY);
    if (val === 'ur' || val === 'en') return val;
  } catch (e) {
    console.error('Failed to read language preference:', e);
  }
  return 'en';
}

export function saveLanguagePreference(lang: AppLanguage): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LANGUAGE_KEY, lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ur' ? 'rtl' : 'ltr';
  } catch (e) {
    console.error('Failed to save language preference:', e);
  }
}
