'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const rules = [
  {
    number: '01',
    title: 'Sort Your Cards',
    description:
      'Each player receives black and white number cards. You can see your own numbers, but your opponent’s cards remain hidden.',
    icon: '🃏',
  },
  {
    number: '02',
    title: 'Deduce Your Opponent’s Cards',
    description:
      'Choose one of your opponent’s cards and guess its color, or guess both its color and number. More precise guesses reveal more information.',
    icon: '🔍',
  },
  {
    number: '03',
    title: 'Wrong Guesses Reveal Clues',
    description:
      'A wrong guess may force you to draw a new card or reveal information about one of your cards. Use every revealed clue to plan your next move.',
    icon: '⚠️',
  },
  {
    number: '04',
    title: 'Reveal Every Card to Win',
    description:
      'You win by fully revealing all of your opponent’s cards. Use your one-time Reveal Item strategically to uncover a color or number.',
    icon: '🏆',
  },
]

export default function HomePage() {
  const router = useRouter()
  const [roomCode, setRoomCode] = useState('')
  const [error, setError] = useState('')

  function enterRoom() {
    const trimmedRoomCode = roomCode.trim().toUpperCase()

    if (!trimmedRoomCode) {
      setError('Please enter a room code.')
      return
    }

    setError('')
    router.push(`/game?room=${encodeURIComponent(trimmedRoomCode)}`)
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white">
      <section
        id="top"
        className="relative isolate overflow-hidden px-5 pb-16 pt-6 sm:px-8 sm:pb-24 lg:px-12"
      >
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-[8%] top-[-180px] h-96 w-96 rounded-full bg-indigo-600/25 blur-3xl" />
          <div className="absolute right-[-100px] top-32 h-80 w-80 rounded-full bg-fuchsia-600/20 blur-3xl" />
          <div className="absolute bottom-[-180px] left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
        </div>

        <header className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-indigo-300/30 bg-indigo-500/15 text-2xl shadow-lg shadow-indigo-950/40">
              🎴
            </span>

            <div>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-indigo-300">
                Davinci Code
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Online deduction game
              </p>
            </div>
          </div>

          <a
            href="#how-to-play"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200 transition hover:border-indigo-300/40 hover:bg-indigo-500/10"
          >
            How to Play
          </a>
        </header>

        <div className="mx-auto grid max-w-6xl gap-12 pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:pt-24">
          <div>
            <p className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
              2 Player Deduction Battle
            </p>

            <h1 className="mt-6 text-5xl font-black leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              Reveal your opponent’s
              <span className="block bg-gradient-to-r from-cyan-300 via-indigo-300 to-fuchsia-300 bg-clip-text text-transparent">
                secret cards first.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
              In Davinci Code, your opponent’s cards are hidden. Use card
              order, revealed colors, numbers, and careful deduction to uncover
              every secret before they uncover yours.
            </p>

            <div className="mt-8 flex flex-wrap gap-3 text-sm font-bold text-slate-300">
              <span className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                🧠 Logical deduction
              </span>
              <span className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                ⚡ 20-second turns
              </span>
              <span className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                🎁 Reveal Item
              </span>
            </div>
          </div>

          <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6 shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-indigo-300">
              Join a Room
            </p>

            <h2 className="mt-2 text-3xl font-black">
              Enter a game room
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-400">
              Enter the room code shared by your friend. You need a valid room
              code before you can join a match.
            </p>

            <label
              htmlFor="roomCode"
              className="mt-7 block text-xs font-black uppercase tracking-wider text-slate-400"
            >
              Room Code
            </label>

            <input
              id="roomCode"
              type="text"
              value={roomCode}
              onChange={(event) => {
                setRoomCode(event.target.value)
                setError('')
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') enterRoom()
              }}
              placeholder="Example: ABC123"
              autoComplete="off"
              spellCheck={false}
              maxLength={24}
              className="mt-3 w-full rounded-xl border border-slate-600 bg-slate-950 px-4 py-4 font-mono text-lg font-black uppercase tracking-[0.16em] text-white outline-none transition placeholder:font-sans placeholder:font-medium placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-600 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/20"
            />

            {error && (
              <p className="mt-3 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={enterRoom}
              className="mt-4 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-4 text-base font-black text-white shadow-lg shadow-emerald-950/40 transition hover:-translate-y-0.5 hover:from-emerald-400 hover:to-teal-400 hover:shadow-emerald-500/20 active:translate-y-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/70"
            >
              Join Room →
            </button>

            <p className="mt-5 text-center text-xs leading-5 text-slate-500">
              You will choose a nickname after entering the room.
            </p>
          </section>
        </div>
      </section>

      <section
        id="how-to-play"
        className="border-y border-white/5 bg-slate-950/55 px-5 py-16 sm:px-8 sm:py-24 lg:px-12"
      >
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-300">
              How to Play
            </p>

            <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
              Learn the rules in one minute
            </h2>

            <p className="mt-5 text-base leading-7 text-slate-400">
              Your opponent’s cards are hidden, but each revealed detail narrows
              down the possibilities. Think ahead and turn clues into certainty.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {rules.map((rule) => (
              <article
                key={rule.number}
                className="group rounded-3xl border border-white/10 bg-slate-900/70 p-6 transition duration-200 hover:-translate-y-1 hover:border-indigo-400/35 hover:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-5">
                  <span className="flex h-13 w-13 min-h-13 min-w-13 items-center justify-center rounded-2xl bg-indigo-500/15 text-2xl">
                    {rule.icon}
                  </span>

                  <span className="font-mono text-sm font-black tracking-widest text-indigo-300">
                    {rule.number}
                  </span>
                </div>

                <h3 className="mt-6 text-xl font-black">{rule.title}</h3>

                <p className="mt-3 text-sm leading-6 text-slate-400">
                  {rule.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-6xl rounded-3xl border border-violet-400/20 bg-gradient-to-r from-violet-950/70 via-slate-900 to-indigo-950/70 p-7 shadow-xl shadow-violet-950/20 sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-300">
                Strategy Tip
              </p>

              <h2 className="mt-3 text-3xl font-black">
                Start with color-only guesses when you are unsure.
              </h2>

              <p className="mt-4 max-w-3xl leading-7 text-slate-300">
                Guessing a card’s color and number can reveal it immediately,
                but a wrong full guess can give away more information. When the
                number is uncertain, guess only the color to collect clues with
                less risk.
              </p>
            </div>

            <a
              href="#top"
              className="inline-flex items-center justify-center rounded-xl border border-violet-300/30 bg-violet-500/15 px-5 py-3 text-sm font-black text-violet-100 transition hover:bg-violet-500/25"
            >
              Enter a Room ↑
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 px-5 py-8 text-center text-xs text-slate-600">
        Davinci Code · Deduce carefully. Every card reveals a clue.
      </footer>
    </main>
  )
}
