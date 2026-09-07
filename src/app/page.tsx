'use client'

import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'

export default function Home() {
  const [status, setStatus] = useState('connected')
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [joinCode, setJoinCode] = useState('')

  async function createRoom() {
    try {
      const code = Math.random().toString(36).slice(2, 8).toUpperCase()

      const { data, error } = await supabase
        .from('games')
        .insert({ room_code: code, status: 'waiting', current_turn: 0 })
        .select('id, room_code')
        .single()

      if (error) {
        setStatus('Error: ' + error.message)
      } else {
        setRoomCode(data.room_code)
        setStatus('Room created! Share this code.')
        // 자동으로 게임 페이지로 이동
        window.location.href = `/game?room=${data.room_code}`
      }
    } catch (e: any) {
      setStatus('Error: ' + (e?.message || String(e)))
    }
  }

  async function joinRoom() {
    try {
      const code = joinCode.trim().toUpperCase()

      const { data, error } = await supabase
        .from('games')
        .select('id, room_code')
        .eq('room_code', code)
        .single()

      if (error) {
        setStatus('Error: Room not found. ' + error.message)
      } else {
        setRoomCode(data.room_code)
        setStatus('Joined room: ' + data.room_code)
        // 자동으로 게임 페이지로 이동
        window.location.href = `/game?room=${data.room_code}`
      }
    } catch (e: any) {
      setStatus('Error: ' + (e?.message || String(e)))
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-bold">Da Vinci Code Web</h1>

      <div className="mt-6 text-center">
        <p className="text-gray-600">Status: {status}</p>

        {!roomCode ? (
          <div className="mt-4 space-y-4">
            <button
              onClick={createRoom}
              className="rounded bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
            >
              Create Room
            </button>

            <div className="pt-4">
              <p className="text-sm text-gray-500">Or join an existing room</p>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Enter room code"
                className="mt-2 w-48 rounded border px-3 py-2 text-center"
              />
              <button
                onClick={joinRoom}
                className="ml-2 rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
              >
                Join
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-lg font-semibold">Your room code:</p>
            <p className="mt-2 text-3xl font-bold text-blue-600">{roomCode}</p>
            <p className="mt-2 text-sm text-gray-500">
              Waiting for your girlfriend to join...
            </p>
          </div>
        )}
      </div>
    </main>
  )
}