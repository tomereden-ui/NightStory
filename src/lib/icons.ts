// Central icon registry — edit ONLY this file to swap any icon in the app.
// Every component uses <Icon name="..." /> and never imports lucide directly.
import {
  BookOpen, Wand2, Mic, Moon,
  ArrowLeft, ArrowRight, ChevronDown, ChevronUp, ChevronRight,
  X, RotateCcw, Trash2, Pencil, Search, Save, FolderOpen,
  Play, Pause, Square, SkipBack,
  Send, Volume2, Music, Bell, Sparkles, Activity,
  Smartphone, Tablet, Monitor, AudioWaveform,
  AlertTriangle, CheckCircle, XCircle,
  CornerDownLeft,
} from "lucide-react";

export const ICONS = {
  // Bottom nav
  navStories:  BookOpen,
  navCreate:   Wand2,
  navVoices:   Mic,
  navMySpace:  Moon,

  // Navigation / controls
  back:        ArrowLeft,
  forward:     ArrowRight,
  close:       X,
  expand:      ChevronDown,
  collapse:    ChevronUp,
  chevronRight: ChevronRight,

  // Actions
  restore:     RotateCcw,
  delete:      Trash2,
  edit:        Pencil,
  search:      Search,
  save:        Save,
  folder:      FolderOpen,
  submit:      CornerDownLeft,

  // Playback
  play:        Play,
  pause:       Pause,
  stop:        Square,
  rewind:      SkipBack,

  // Media / audio
  mic:         Mic,
  send:        Send,
  volume:      Volume2,
  music:       Music,

  // Profile settings
  bell:        Bell,
  moon:        Moon,
  sparkles:    Sparkles,
  waveform:    AudioWaveform,
  activityLine: Activity,

  // Devices
  mobile:      Smartphone,
  tablet:      Tablet,
  desktop:     Monitor,
  auto:        Monitor,

  // Status
  warning:     AlertTriangle,
  success:     CheckCircle,
  error:       XCircle,
} as const;

export type IconName = keyof typeof ICONS;
