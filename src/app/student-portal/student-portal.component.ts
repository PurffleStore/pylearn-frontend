import { Component, OnInit, OnDestroy, HostListener, ElementRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthenticationService } from '../core/services/authentication.service';
import { BrandService } from '../shared/brand.service';
import { MatDialog } from '@angular/material/dialog';
import { PronunciationComponent } from '../pronunciation/pronunciation.component';
import { LipTrainerComponent } from '../lip-trainer/lip-trainer.component';

/**
 * Represents a lesson-update notification sent by a teacher.
 * In a production environment this would be fetched from the backend API.
 */
interface TeacherNotification {
  /** Short headline shown below the "Teacher Update" label. */
  lessonTitle: string;
  /** Human-readable description of what was updated. */
  message: string;
  /** Subject section to navigate to when the student clicks "View Lesson". */
  targetSection: string;
  /** ISO-8601 timestamp of when the lesson was uploaded/updated. */
  updatedAt: string;
}

@Component({
  selector: 'app-student-portal',
  templateUrl: './student-portal.component.html',
  styleUrls: ['./student-portal.component.css']
})
export class StudentPortalComponent implements OnInit, OnDestroy {

  // -------------------- Navigation State --------------------
  activeSection = 'dashboard';
  showChatDropdown  = false;
  showGeneralDropdown = false;
  menuOpen = false;
  mobileNavOpen = false;

  // -------------------- Auth State --------------------
  isAuthenticated = false;
  username: string | null = null;
  showAccountMenu = false;
  private authSub?: Subscription;

  // -------------------- Onboarding --------------------
  showOnboarding = false;
  onboardingStep = 1;
  selectedGrade: string | null = null;
  selectedLang: string | null = null;
  selectedAvatar: string | null = null;
  selectedSubjects: string[] = [];

  grades   = ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'];
  langs    = ['English', 'Swedish', 'Both'];
  avatars  = ['🦊', '🐧', '🦁', '🐸', '🐙', '🦋', '🐬', '🦄'];

  // -------------------- Subject Data --------------------
  subjects = [
    { id: 'english', name: 'English Learning', emoji: '📖', color: '#0EA5E9', bg: '#BAE6FD', desc: 'Reading, Grammar, Writing, Vocabulary & Pronunciation' },
    { id: 'maths',   name: 'Maths',            emoji: '🔢', color: '#10B981', bg: '#DCFCE7', desc: 'Counting, Operations, Fractions, Geometry & Quizzes' },
    { id: 'science', name: 'Science Learning', emoji: '🔬', color: '#65A30D', bg: '#ECFCCB', desc: 'Animals, Plants, Space, Human Body & Experiments' }
  ];

  aiFeatures = [
    { icon: '🤖', name: 'Tutor Assistant',    desc: 'Personal tutor for all subjects' },
    { icon: '🗣️', name: 'Voice Assistant',   desc: 'Voice & pronunciation coach' },
    { icon: '📖', name: 'Reading Assistant',  desc: 'Reading companion & fluency analysis' },
    { icon: '✏️', name: 'Homework Helper',    desc: 'Get guided help with homework' },
    { icon: '📝', name: 'Story Builder',      desc: 'AI-generated educational stories' },
    { icon: '📊', name: 'Progress Tracker',   desc: 'AI-powered learning analytics' },
    { icon: '🎙️', name: 'Speaking Buddy',     desc: 'Practice speaking with AI' },
    { icon: '🧩', name: 'STEM Helper',        desc: 'AI assistant for STEM activities' },
    { icon: '❓', name: 'Quiz Generator',      desc: 'Instant quiz on any topic' },
    { icon: '💬', name: 'Feedback Assistant', desc: 'Personalised improvement tips' }
  ];

  recentLessons = [
    { subject: 'English',  topic: 'Reading Comprehension', progress: 75, emoji: '📖', color: '#0EA5E9' },
    { subject: 'Maths',    topic: 'Addition & Subtraction', progress: 60, emoji: '🔢', color: '#10B981' },
    { subject: 'Science',  topic: 'The Water Cycle',        progress: 45, emoji: '🔬', color: '#65A30D' }
  ];

  upcomingActivities = [
    { time: 'Today',     title: 'English – Vocabulary Quiz',  emoji: '📝' },
    { time: 'Tomorrow',  title: 'Maths – Fractions Practice', emoji: '🔢' },
    { time: 'This week', title: 'Science – The Water Cycle',  emoji: '🔬' }
  ];

  // English section items
  englishItems = [
    { icon: '🤖', title: 'English Chat Tutor',     desc: 'Chat with AI English tutor',        active: true,  action: () => this.goToChat('subject') },
    { icon: '🗣️', title: 'Pronunciation',          desc: 'AI pronunciation coach',             active: true,  action: () => this.openPronunciation() },
    { icon: '👄', title: 'Lip Trainer',            desc: 'Lip movement analysis',              active: true,  action: () => this.openLipTrainer()    },
    { icon: '🇸🇪', title: 'Swedish Chat Tutor',   desc: 'AI Swedish conversation tutor',      active: false },
    { icon: '📝', title: 'Grammar',                desc: 'Grammar rules & exercises',          active: false },
    { icon: '📖', title: 'Reading',                desc: 'Comprehension & fluency',            active: false },
    { icon: '✏️', title: 'Writing',                desc: 'Creative & structured writing',      active: false },
    { icon: '🎧', title: 'Listening',              desc: 'Listening exercises & audio',        active: false },
    { icon: '📚', title: 'Vocabulary Builder',     desc: 'Learn new words daily',              active: false },
    { icon: '📖', title: 'Storytelling',           desc: 'AI story builder',                   active: false },
    { icon: '💬', title: 'Communication Practice', desc: 'Speaking & communication',           active: false }
  ];

  swedishItems = [
    { icon: '🤖', title: 'Swedish Chat Tutor',    desc: 'AI Swedish conversation tutor', active: true, action: () => this.goToChat('swedish') },
    { icon: '📝', title: 'Swedish Words',          desc: 'Vocabulary & word games',       active: false },
    { icon: '📖', title: 'Swedish Reading',        desc: 'Reading practice',              active: false },
    { icon: '🗣️', title: 'Swedish Pronunciation', desc: 'AI pronunciation training',     active: false },
    { icon: '📚', title: 'Swedish Vocabulary',     desc: 'Build Swedish vocabulary',      active: false },
    { icon: '📝', title: 'Swedish Grammar',        desc: 'Grammar rules & exercises',     active: false },
    { icon: '🎤', title: 'Speaking Practice',      desc: 'Speak & practice Swedish',      active: false }
  ];

  mathsItems = [
    { icon: '🤖', title: 'Maths Tutor',        desc: 'AI maths tutor & helper'       },
    { icon: '🔢', title: 'Counting & Numbers', desc: 'Number games & counting'        },
    { icon: '➕', title: 'Addition',           desc: 'Addition exercises & games'     },
    { icon: '➖', title: 'Subtraction',        desc: 'Subtraction practice'           },
    { icon: '✖️', title: 'Multiplication',    desc: 'Multiplication tables & games'  },
    { icon: '➗', title: 'Division',           desc: 'Division concepts & practice'   },
    { icon: '½',  title: 'Fractions',          desc: 'Fraction visuals & exercises'   },
    { icon: '📐', title: 'Geometry & Shapes', desc: 'Shapes, angles & geometry'      },
    { icon: '⏰', title: 'Time & Money',       desc: 'Time reading & money maths'     },
    { icon: '📏', title: 'Measurements',       desc: 'Length, weight & capacity'      },
    { icon: '💡', title: 'Word Problems',      desc: 'Solve real-world problems'      },
    { icon: '🧠', title: 'Mental Maths',       desc: 'Quick mental maths drills'      },
    { icon: '📊', title: 'Practice Quiz',      desc: 'Interactive maths quiz'         }
  ];

  scienceItems = [
    { icon: '🤖', title: 'Science Tutor',          desc: 'AI science guide'                  },
    { icon: '🐾', title: 'Animals',                 desc: 'Animal world explorer'              },
    { icon: '🌿', title: 'Plants',                  desc: 'Plant growth & nature'              },
    { icon: '⛅', title: 'Weather',                 desc: 'Weather patterns & climate'         },
    { icon: '🫀', title: 'Human Body',              desc: 'Body parts & systems'               },
    { icon: '💧', title: 'Water Cycle',             desc: 'Rain, evaporation & water'          },
    { icon: '🚀', title: 'Space',                   desc: 'Planets, stars & solar system'      },
    { icon: '🌱', title: 'Environment',             desc: 'Sustainability & nature'            },
    { icon: '⚡', title: 'Energy',                  desc: 'Energy sources & types'             },
    { icon: '🍂', title: 'Seasons',                 desc: 'Seasons & weather changes'          },
    { icon: '🦁', title: 'Food Chain',              desc: 'Predators, prey & ecosystems'       },
    { icon: '🔍', title: 'Living & Non-living',     desc: 'Classify living things'             }
  ];

  physicsItems = [
    'Physics Tutor','Light','Sound','Force','Motion','Gravity',
    'Heat','Magnets','Push & Pull','Floating & Sinking','Electricity Basics'
  ];

  chemistryItems = [
    'Chemistry Tutor','Solids & Liquids','Mixing Materials','States of Matter',
    'Water & Ice','Simple Reactions','Colours & Materials','Safe Experiments','Colour Mixing'
  ];

  biologyItems = [
    'Biology Tutor','Human Body','Plants','Animals','Body Parts',
    'Healthy Food','Growth of Plants','Habitats','Nature Learning'
  ];

  stemItems = [
    'Problem Solving','Logic Games','Puzzle Challenges','Coding Basics',
    'AI Thinking','Simulations','Build a Robot','Coding Puzzle',
    'Smart Machine Game','AI Explorer','Creativity Challenges'
  ];

  physicsEmojis = ['🤖','💡','🔊','💪','🏃','🌍','🔥','🧲','🤝','⛵','⚡'];
  chemEmojis    = ['🤖','🧪','🌊','💧','🧊','⚗️','🎨','🔬','🌈'];
  bioEmojis     = ['🤖','🫀','🌿','🐾','🦴','🥦','🌱','🏡','🌲'];
  stemEmojis    = ['🔧','🧠','🎮','🧩','💻','🤖','🔬','🤖','🎯','🚀','🎨'];

  // -------------------- Available Lessons Carousel --------------------
  /**
   * List of lessons currently available to the student.
   * In production these are fetched from the backend; the card cycles
   * through them one by one so the student can see every available lesson.
   */
  availableLessons: TeacherNotification[] = [
    {
      lessonTitle: 'New Lesson Available',
      message: 'Your teacher has added a new English reading lesson. Tap to open it.',
      targetSection: 'english',
      updatedAt: new Date().toISOString()
    },
    {
      lessonTitle: 'Maths Lesson Updated',
      message: 'Your teacher has updated the Fractions Practice lesson with new exercises.',
      targetSection: 'maths',
      updatedAt: new Date(Date.now() - 3600000).toISOString()
    },
    {
      lessonTitle: 'Science Lesson Ready',
      message: 'A new Science lesson on The Water Cycle has been uploaded for you.',
      targetSection: 'science',
      updatedAt: new Date(Date.now() - 7200000).toISOString()
    }
  ];

  /** Index of the lesson currently shown in the notification card. */
  activeNotificationIndex = 0;

  /** Interval handle for the auto-advance timer. */
  private notificationTimer?: ReturnType<typeof setInterval>;

  /** Returns the lesson currently displayed in the notification card. */
  get currentLesson(): TeacherNotification {
    return this.availableLessons[this.activeNotificationIndex];
  }

  /**
   * Returns a human-friendly "time ago" label for the active lesson's timestamp.
   * e.g. "Just now", "2 minutes ago", "1 hour ago", "Yesterday"
   */
  get notificationTimeLabel(): string {
    const now     = new Date();
    const updated = new Date(this.currentLesson.updatedAt);
    const diffMs  = now.getTime() - updated.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1)  return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return 'Yesterday';
  }

  /** Advances to the next available lesson in the carousel. */
  nextNotification(): void {
    this.activeNotificationIndex =
      (this.activeNotificationIndex + 1) % this.availableLessons.length;
    this.resetNotificationTimer();
  }

  /** Goes back to the previous available lesson in the carousel. */
  previousNotification(): void {
    this.activeNotificationIndex =
      (this.activeNotificationIndex - 1 + this.availableLessons.length) % this.availableLessons.length;
    this.resetNotificationTimer();
  }

  /** Jumps directly to a specific lesson by dot index. */
  goToNotification(index: number): void {
    this.activeNotificationIndex = index;
    this.resetNotificationTimer();
  }

  /** Starts the auto-advance timer — switches slide every 4 seconds. */
  private startNotificationTimer(): void {
    this.notificationTimer = setInterval(() => {
      this.activeNotificationIndex =
        (this.activeNotificationIndex + 1) % this.availableLessons.length;
    }, 4000);
  }

  /** Clears and restarts the timer so manual navigation resets the countdown. */
  private resetNotificationTimer(): void {
    if (this.notificationTimer) { clearInterval(this.notificationTimer); }
    this.startNotificationTimer();
  }

  badges = [
    { icon: '📖', name: 'Reader',    desc: 'Completed 5 readings',     earned: true  },
    { icon: '🔢', name: 'Math Star', desc: 'Solved 10 maths problems',  earned: true  },
    { icon: '🗣️', name: 'Speaker',   desc: 'Used Pronunciation Trainer',earned: true  },
    { icon: '🔬', name: 'Scientist', desc: 'Complete 5 science lessons', earned: false },
    { icon: '🤖', name: 'STEM Hero', desc: 'Finish STEM lab activities', earned: false },
    { icon: '🏆', name: 'Champion',  desc: 'Complete all subjects',     earned: false }
  ];

  // -------------------- Constructor --------------------
  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthenticationService,
    public brand: BrandService,
    private host: ElementRef,
    private dialog: MatDialog
  ) {}

  // -------------------- Lifecycle --------------------
  ngOnInit(): void {
    this.isAuthenticated = this.authService.isLoggedIn();
    this.username = localStorage.getItem('username');
    this.authSub = this.authService.isLoggedIn$.subscribe((v) => {
      this.isAuthenticated = v;
      this.username = v ? localStorage.getItem('username') : null;
      if (!v) this.showAccountMenu = false;
    });
    // Show onboarding if first visit
    const visited = localStorage.getItem('py-onboarding-done');
    if (!visited) { this.showOnboarding = true; }

    // Navigate to the section specified via the 'section' query parameter (e.g. from Subject Tutor back button)
    const section = this.route.snapshot.queryParamMap.get('section');
    if (section) {
      this.activeSection = section;
    }

    // Begin auto-advancing the available lessons carousel
    this.startNotificationTimer();
  }

  ngOnDestroy(): void {
    this.authSub?.unsubscribe();
    if (this.notificationTimer) { clearInterval(this.notificationTimer); }
  }

  // -------------------- Avatar Helpers --------------------
  get usernameInitial(): string {
    const u = this.username || '';
    return u.trim().charAt(0).toUpperCase() || 'S';
  }
  get displayName(): string {
    const u = this.username || '';
    if (!u) return 'Student';
    const name = u.includes('@') ? u.split('@')[0] : u;
    return name.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  get displayEmail(): string { return this.username || ''; }

  // -------------------- Navigation --------------------
  setSection(section: string): void {
    this.activeSection = section;
    this.showChatDropdown    = false;
    this.showGeneralDropdown = false;
    this.mobileNavOpen       = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  toggleChatDropdown(evt: Event): void {
    evt.stopPropagation();
    this.showChatDropdown    = !this.showChatDropdown;
    this.showGeneralDropdown = false;
  }
  toggleGeneralDropdown(evt: Event): void {
    evt.stopPropagation();
    this.showGeneralDropdown = !this.showGeneralDropdown;
    this.showChatDropdown    = false;
  }
  closeDropdowns(): void {
    this.showChatDropdown    = false;
    this.showGeneralDropdown = false;
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent) {
    if (!this.host.nativeElement.contains(ev.target)) {
      this.showAccountMenu     = false;
      this.showChatDropdown    = false;
      this.showGeneralDropdown = false;
    }
  }

  toggleMenu():      void { this.menuOpen      = !this.menuOpen; }
  toggleMobileNav(): void { this.mobileNavOpen = !this.mobileNavOpen; }
  toggleAccountMenu():void{ this.showAccountMenu = !this.showAccountMenu; }
  closeAccountMenu(): void{ this.showAccountMenu = false; }

  goHome(): void { this.router.navigate(['/']); }

  goToChat(type: string): void {
    if (type === 'swedish') {
      this.router.navigate(['/swedishchat']);
    } else {
      this.router.navigate(['/chatllm']);
    }
    this.showChatDropdown = false;
  }

  openPronunciation(): void {
    this.dialog.open(PronunciationComponent, {
      width: '90vw', maxWidth: '95vw', height: '85vh', disableClose: true
    });
    this.showGeneralDropdown = false;
  }
  openLipTrainer(): void {
    this.dialog.open(LipTrainerComponent, {
      width: '90vw', maxWidth: '95vw', height: '85vh', disableClose: true
    });
    this.showGeneralDropdown = false;
  }

  logout(): void {
    this.authService.logout().subscribe({
      next:  () => { localStorage.removeItem('username'); this.router.navigate(['/login']); },
      error: () => { localStorage.removeItem('username'); this.router.navigate(['/login']); }
    });
  }

  // -------------------- Onboarding --------------------
  nextOnboardingStep(): void {
    if (this.onboardingStep < 5) this.onboardingStep++;
    else this.finishOnboarding();
  }
  prevOnboardingStep(): void { if (this.onboardingStep > 1) this.onboardingStep--; }
  finishOnboarding(): void {
    localStorage.setItem('py-onboarding-done', '1');
    this.showOnboarding = false;
  }
  toggleSubject(id: string): void {
    const i = this.selectedSubjects.indexOf(id);
    if (i >= 0) this.selectedSubjects.splice(i, 1);
    else this.selectedSubjects.push(id);
  }
  isSubjectSelected(id: string): boolean { return this.selectedSubjects.includes(id); }

  // -------------------- Content Card Action --------------------
  handleContentAction(item: any): void {
    if (item.active && item.action) { item.action(); }
  }

  getPhysicsEmoji(i: number): string { return this.physicsEmojis[i] || '⚗️'; }
  getChemEmoji(i: number):    string { return this.chemEmojis[i]    || '⚗️'; }
  getBioEmoji(i: number):     string { return this.bioEmojis[i]     || '🌿'; }
  getStemEmoji(i: number):    string { return this.stemEmojis[i]    || '🤖'; }
}
