import { OpenMultimodalHero } from './OpenMultimodalHero'
import { LandingSections, SiteFooter } from './LandingSections'

interface LandingPageProps {
  onOpenChat?: () => void
}

export function LandingPage({ onOpenChat }: LandingPageProps) {
  return (
    <div className="min-h-dvh bg-[#050608] text-white">
      <OpenMultimodalHero onOpenChat={onOpenChat} />
      <LandingSections onOpenChat={onOpenChat} />
      <SiteFooter />
    </div>
  )
}
