import { Component, ElementRef, ViewChild } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

interface PracticeItem {
  letter: string;
  word: string;
  phonetics: string;
  imgSrc: string;
  audioSrc: string;
}

@Component({
  selector: 'app-lip-trainer',
  templateUrl: './lip-trainer.component.html',
  styleUrls: ['./lip-trainer.component.css']
})
export class LipTrainerComponent {
  @ViewChild('videoEl') videoElRef?: ElementRef<HTMLVideoElement>;

  // Data items - same as pronunciation component
  items: PracticeItem[] = [
    { letter: 'A', word: 'Apple', phonetics: '/ˈæpəl/', imgSrc: 'assets/pronunciation/animvideo/apple.mp4', audioSrc: 'assets/pronunciation/audio/apple.mp3' },
    { letter: 'B', word: 'Ball', phonetics: '/bɔːl/', imgSrc: 'assets/pronunciation/animvideo/ball.mp4', audioSrc: 'assets/pronunciation/audio/ball.mp3' },
    { letter: 'C', word: 'Cat', phonetics: '/kæt/', imgSrc: 'assets/pronunciation/animvideo/cat.mp4', audioSrc: 'assets/pronunciation/audio/cat.mp3' },
    { letter: 'D', word: 'Dog', phonetics: '/dɒɡ/', imgSrc: 'assets/pronunciation/animvideo/dog.mp4', audioSrc: 'assets/pronunciation/audio/dog.mp3' },
    { letter: 'E', word: 'Egg', phonetics: '/eɡ/', imgSrc: 'assets/pronunciation/animvideo/egg.mp4', audioSrc: 'assets/pronunciation/audio/egg.mp3' },
    { letter: 'F', word: 'Fish', phonetics: '/fɪʃ/', imgSrc: 'assets/pronunciation/animvideo/fish.mp4', audioSrc: 'assets/pronunciation/audio/fish.mp3' },
    { letter: 'G', word: 'Grapes', phonetics: '/ɡreɪps/', imgSrc: 'assets/pronunciation/animvideo/grapes.mp4', audioSrc: 'assets/pronunciation/audio/grapes.mp3' },
    { letter: 'H', word: 'Hat', phonetics: '/hæt/', imgSrc: 'assets/pronunciation/animvideo/hat.mp4', audioSrc: 'assets/pronunciation/audio/hat.mp3' },
    { letter: 'I', word: 'Ice cream', phonetics: '/ˈaɪs ˌkriːm/', imgSrc: 'assets/pronunciation/animvideo/icecream.mp4', audioSrc: 'assets/pronunciation/audio/icecream.mp3' },
    { letter: 'J', word: 'Jar', phonetics: '/dʒɑːr/', imgSrc: 'assets/pronunciation/animvideo/jar.mp4', audioSrc: 'assets/pronunciation/audio/jar.mp3' },
    { letter: 'K', word: 'Kite', phonetics: '/kaɪt/', imgSrc: 'assets/pronunciation/animvideo/kite.mp4', audioSrc: 'assets/pronunciation/audio/kite.mp3' },
    { letter: 'L', word: 'Lion', phonetics: '/ˈlaɪən/', imgSrc: 'assets/pronunciation/animvideo/lion.mp4', audioSrc: 'assets/pronunciation/audio/lion.mp3' },
    { letter: 'M', word: 'Moon', phonetics: '/muːn/', imgSrc: 'assets/pronunciation/animvideo/moon.mp4', audioSrc: 'assets/pronunciation/audio/moon.mp3' },
    { letter: 'N', word: 'Nest', phonetics: '/nest/', imgSrc: 'assets/pronunciation/animvideo/nest.mp4', audioSrc: 'assets/pronunciation/audio/nest.mp3' },
    { letter: 'O', word: 'Orange', phonetics: '/ˈɒrɪndʒ/', imgSrc: 'assets/pronunciation/animvideo/orange.mp4', audioSrc: 'assets/pronunciation/audio/orange.mp3' },
    { letter: 'P', word: 'Pig', phonetics: '/pɪɡ/', imgSrc: 'assets/pronunciation/animvideo/pig.mp4', audioSrc: 'assets/pronunciation/audio/pig.mp3' },
    { letter: 'Q', word: 'Queen', phonetics: '/kwiːn/', imgSrc: 'assets/pronunciation/animvideo/queen.mp4', audioSrc: 'assets/pronunciation/audio/queen.mp3' },
    { letter: 'R', word: 'Rabbit', phonetics: '/ˈræbɪt/', imgSrc: 'assets/pronunciation/animvideo/rabbit.mp4', audioSrc: 'assets/pronunciation/audio/rabbit.mp3' },
    { letter: 'S', word: 'Sun', phonetics: '/sʌn/', imgSrc: 'assets/pronunciation/animvideo/sun.mp4', audioSrc: 'assets/pronunciation/audio/sun.mp3' },
    { letter: 'T', word: 'Tree', phonetics: '/triː/', imgSrc: 'assets/pronunciation/animvideo/tree.mp4', audioSrc: 'assets/pronunciation/audio/tree.mp3' },
    { letter: 'U', word: 'Umbrella', phonetics: '/ʌmˈbrelə/', imgSrc: 'assets/pronunciation/animvideo/umbrella.mp4', audioSrc: 'assets/pronunciation/audio/umbrella.mp3' },
    { letter: 'V', word: 'Van', phonetics: '/væn/', imgSrc: 'assets/pronunciation/animvideo/van.mp4', audioSrc: 'assets/pronunciation/audio/van.mp3' },
    { letter: 'W', word: 'Watch', phonetics: '/wɒtʃ/', imgSrc: 'assets/pronunciation/animvideo/watch.mp4', audioSrc: 'assets/pronunciation/audio/watch.mp3' },
    { letter: 'X', word: 'Xylophone', phonetics: '/ˈzaɪləfəʊn/', imgSrc: 'assets/pronunciation/animvideo/xylophone.mp4', audioSrc: 'assets/pronunciation/audio/xylophone.mp3' },
    { letter: 'Y', word: 'Yarn', phonetics: '/jɑːn/', imgSrc: 'assets/pronunciation/animvideo/yarn.mp4', audioSrc: 'assets/pronunciation/audio/yarn.mp3' },
    { letter: 'Z', word: 'Zebra', phonetics: '/ˈzebrə/', imgSrc: 'assets/pronunciation/animvideo/zebra.mp4', audioSrc: 'assets/pronunciation/audio/zebra.mp3' }
  ];

  index = 0;
  lipPosition: 'straight' | 'left' | 'right' = 'straight';
  isVideoPlaying = false;
  currentVideoSrc = '';
  isVideoPaused = false;
  playIconUrl = 'assets/pronunciation/play.png';
  pauseIconUrl = 'assets/pronunciation/pause.png';
  muteIconUrl = 'assets/lip-trainer/newmute.png';
  currentPlayType: 'normal' | 'muted' = 'normal';

  constructor(
    public dialogRef: MatDialogRef<LipTrainerComponent>,
  ) { }

  get current(): PracticeItem {
    return this.items[this.index];
  }

  // Get the current display image based on lip position
  get currentDisplayImage(): string {
    switch (this.lipPosition) {
      case 'left':
        return 'assets/lip-trainer/default-image/default_left.png';
      case 'right':
        return 'assets/lip-trainer/default-image/default_right.png';
      default:
        return 'assets/lip-trainer/default-image/default_straight.png';
    }
  }

  // Get icon for normal video button based on state
  get normalVideoIcon(): string {
    if (this.isVideoPlaying && this.currentPlayType === 'normal') {
      // If normal video is playing/paused, toggle between play/pause
      return this.isVideoPaused ? this.playIconUrl : this.pauseIconUrl;
    }
    // Default state - show play icon
    return this.playIconUrl;
  }

  // Get icon for muted video button based on state
get mutedVideoIcon(): string {
  if (this.isVideoPlaying && this.currentPlayType === 'muted') {   
    return this.isVideoPaused ? this.muteIconUrl : this.pauseIconUrl;
  }
  // Default state - show mute icon (newmute.png)
  return this.muteIconUrl;
}

  // Set lip position
  setLipPosition(position: 'straight' | 'left' | 'right'): void {
    this.lipPosition = position;
    this.stopVideoAndReset();
  }

  // Reset to straight position (default)
  resetToStraight(): void {
    this.lipPosition = 'straight';
    this.stopVideoAndReset();
  }

  // Get display text for current lip position
  getLipPositionText(): string {
    switch (this.lipPosition) {
      case 'left': return 'Left';
      case 'right': return 'Right';
      default: return 'Straight';
    }
  }

  // Handle normal video button click
  onNormalVideoClick(): void {
    const video = this.videoElRef?.nativeElement;
    
    // If no video playing OR different type is playing
    if (!this.isVideoPlaying || this.currentPlayType !== 'normal') {
      this.playVideo();
      return;
    }
    
    // Video exists and is of correct type, toggle play/pause
    if (video) {
      if (video.paused) {
        video.play().catch(error => {
          console.error('Error resuming video:', error);
        });
        this.isVideoPaused = false;
      } else {
        video.pause();
        this.isVideoPaused = true;
      }
    }
  }

  // Handle muted video button click
  onMutedVideoClick(): void {
    const video = this.videoElRef?.nativeElement;
    
    // If no video playing OR different type is playing
    if (!this.isVideoPlaying || this.currentPlayType !== 'muted') {
      this.playMutedVideo();
      return;
    }
    
    // Video exists and is of correct type, toggle play/pause
    if (video) {
      if (video.paused) {
        video.play().catch(error => {
          console.error('Error resuming video:', error);
        });
        this.isVideoPaused = false;
      } else {
        video.pause();
        this.isVideoPaused = true;
      }
    }
  }

  // Get video filename based on lip position and mute status
  private getVideoNameForCurrentPosition(isMuted: boolean): string {
    const word = this.current.word.toLowerCase().replace(/\s+/g, '-');
    
    if (isMuted) {
      switch (this.lipPosition) {
        case 'left':
          return `${word}_mute_left.mp4`;
        case 'right':
          return `${word}_mute_right.mp4`;
        default:
          return `${word}_mute_straight.mp4`;
      }
    } else {
      switch (this.lipPosition) {
        case 'left':
          return `${word}_left.mp4`;
        case 'right':
          return `${word}_right.mp4`;
        default:
          return `${word}_straight.mp4`;
      }
    }
  }

  // Play video file
  private playVideoFile(videoName: string, playType: 'normal' | 'muted'): void {
    // Stop any currently playing video
    this.stopVideoAndReset();
    
    // Set video source and play
    this.currentVideoSrc = `assets/lip-trainer/${videoName}`;
    this.isVideoPlaying = true;
    this.currentPlayType = playType;
    this.isVideoPaused = false;
    
    setTimeout(() => {
      const video = this.videoElRef?.nativeElement;
      if (video) {
        video.load();
        video.play().catch(error => {
          console.error('Error playing video:', error);
          this.onVideoEnded();
        });
      }
    }, 0);
  }
  
  // Play normal video
  playVideo(): void {
    const videoName = this.getVideoNameForCurrentPosition(false);
    this.playVideoFile(videoName, 'normal');
  }
  
  // Play muted video
  playMutedVideo(): void {
    const videoName = this.getVideoNameForCurrentPosition(true);
    this.playVideoFile(videoName, 'muted');
  }
  
  // Stop video and reset
  private stopVideoAndReset(): void {
    const video = this.videoElRef?.nativeElement;
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
    this.isVideoPlaying = false;
    this.isVideoPaused = false;
    this.currentVideoSrc = '';
  }
  
  // Handle video ended event
  onVideoEnded(): void {
    this.stopVideoAndReset();
  }

  // Play sample audio for current word
  playWordAudio(): void {
    const src = this.current?.audioSrc;
    if (!src) return;
    try {
      const audio = new Audio(src);
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch {}
  }

  // Navigate to previous item
  prev(): void {
    if (this.index <= 0) return;
    this.index--;
    this.resetToStraight();
  }

  // Navigate to next item
  next(): void {
    if (this.index >= this.items.length - 1) return;
    this.index++;
    this.resetToStraight();
  }

  // Close popup
  closePopup(): void {
    this.stopVideoAndReset();
    this.dialogRef.close();
  }
}