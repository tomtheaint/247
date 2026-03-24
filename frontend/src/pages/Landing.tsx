import { Link } from "react-router-dom";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-brand-900 text-white">
      <nav className="flex items-center justify-between p-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center font-bold text-sm">24</div>
          <span className="font-bold text-lg">24/7</span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/login" className="text-sm text-gray-300 hover:text-white transition-colors">Sign in</Link>
          <Link to="/register" className="px-4 py-2 bg-brand-600 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors">Get started</Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 pt-20 pb-32 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-600/20 border border-brand-500/30 rounded-full text-brand-300 text-sm mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
          Calendar meets goal tracking
        </div>

        <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
          Achieve your goals,<br />
          <span className="text-brand-400">24/7</span>
        </h1>

        <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
          Plan your days, track your progress, and adopt proven paths from a community of achievers.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/register" className="px-8 py-4 bg-brand-600 rounded-xl font-semibold hover:bg-brand-700 transition-colors">
            Start for free
          </Link>
          <Link to="/login" className="px-8 py-4 bg-white/10 rounded-xl font-semibold hover:bg-white/20 transition-colors border border-white/20">
            Sign in
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24">
          {[
            { title: "Smart Calendar", desc: "Drag-and-drop scheduling with goal-linked events and time blocking." },
            { title: "Goal Tracking", desc: "Visual progress tracking across fitness, learning, career, and more." },
            { title: "Community Tracks", desc: "Adopt step-by-step paths from others who've achieved your goal." },
          ].map(({ title, desc }) => (
            <div key={title} className="bg-white/5 border border-white/10 rounded-2xl p-6 text-left">
              <h3 className="font-semibold text-lg mb-2">{title}</h3>
              <p className="text-gray-400 text-sm">{desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
