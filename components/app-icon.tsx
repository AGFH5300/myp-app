import type { LucideProps } from 'lucide-react'
import {
  ArrowRight,
  Atom,
  BadgeCheck,
  BarChart3,
  Beaker,
  BookOpen,
  BookOpenCheck,
  Bookmark,
  Calculator,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Globe2,
  GraduationCap,
  Home,
  Languages,
  Library,
  LogOut,
  MailCheck,
  Menu,
  Settings,
  Sparkles,
} from 'lucide-react'

const iconMap = {
  menu: Menu,
  menu_book: BookOpen,
  local_library: Library,
  history_edu: FileText,
  insights: BarChart3,
  settings: Settings,
  logout: LogOut,
  science: Beaker,
  functions: Calculator,
  calculate: Calculator,
  public: Globe2,
  translate: Languages,
  bookmark: Bookmark,
  history: Clock3,
  auto_stories: BookOpenCheck,
  arrow_right_alt: ArrowRight,
  arrow_forward: ArrowRight,
  play_circle: Sparkles,
  filter_list: Settings,
  check_circle: CheckCircle2,
  mark_email_read: MailCheck,
  workspace: Home,
  atlas: GraduationCap,
  chemistry: Atom,
  complete: BadgeCheck,
  chevron_right: ChevronRight,
} as const

type IconName = keyof typeof iconMap

export function AppIcon({ name, className, ...props }: { name: string } & LucideProps) {
  const Icon = iconMap[name as IconName] ?? BookOpen
  return <Icon aria-hidden="true" className={className} {...props} />
}
