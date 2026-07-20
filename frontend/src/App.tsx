import { useState } from 'react'
import { ChatView } from './components/ChatView'
import { LandingPage } from './components/LandingPage'

type View = 'home' | 'chat'

function App() {
  const [view, setView] = useState<View>('home')

  if (view === 'chat') {
    return <ChatView onBack={() => setView('home')} />
  }

  return <LandingPage onOpenChat={() => setView('chat')} />
}

export default App
