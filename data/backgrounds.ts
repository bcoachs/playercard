export type PlayercardBackground = {
  id: string
  name: string
  description: string
  /** Tailwind utility classes that render the main gradient */
  gradientClass: string
  /** Optional utility classes that add a subtle texture overlay */
  overlayClass?: string
}

export const PLAYER_CARD_BACKGROUNDS: PlayercardBackground[] = [
  {
    id: 'aurora',
    name: 'Aurora Pulse',
    description: 'Lebendige Magenta- und Blautöne für einen dynamischen Premium-Look.',
    gradientClass:
      'bg-[radial-gradient(circle_at_top,_rgba(244,63,94,0.85),transparent_60%)] bg-slate-900 before:bg-[radial-gradient(circle_at_bottom,_rgba(56,189,248,0.8),rgba(15,23,42,0.6)_70%)] before:opacity-80',
    overlayClass: "before:absolute before:inset-0 before:content-[''] before:mix-blend-screen",
  },
  {
    id: 'voltage',
    name: 'Electric Voltage',
    description: 'Strahlendes Gelb trifft dunklen Hintergrund – ideal für Stürmer.',
    gradientClass:
      'bg-gradient-to-br from-yellow-400 via-amber-500/70 to-slate-900',
  },
  {
    id: 'nebula',
    name: 'Nebula Night',
    description: 'Kosmischer Verlauf mit Neon-Farben, der Technik betont.',
    gradientClass:
      'bg-[radial-gradient(circle_at_20%_20%,_rgba(59,130,246,0.85),transparent_55%)] bg-[radial-gradient(circle_at_80%_80%,_rgba(244,114,182,0.85),transparent_50%)] bg-slate-950',
  },
  {
    id: 'mint',
    name: 'Mint Focus',
    description: 'Frisches Türkis mit dezentem Helligkeitsverlauf.',
    gradientClass:
      'bg-gradient-to-br from-emerald-400 via-emerald-500/90 to-slate-900',
  },
  {
    id: 'classic',
    name: 'Classic Gold',
    description: 'Goldene Highlights mit dunklem Blauton – angelehnt an FUT-Karten.',
    gradientClass:
      'bg-gradient-to-br from-[#f7d794] via-[#c79e57]/90 to-[#1e293b] text-slate-900',
  },
]
