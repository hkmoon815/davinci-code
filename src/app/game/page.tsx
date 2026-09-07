'use client'

import { supabase } from '@/lib/supabase'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type GameStatus = 'waiting' | 'playing' | 'finished'
type GuessMode = 'color' | 'full'
type RevealLevel = 'hidden' | 'color' | 'number' | 'full'
type CardColor = 'BLACK' | 'WHITE'
type ItemRevealType = 'color' | 'number'

type Player = {
  id: string
  game_id: string
  nickname: string
  player_order: number
}

type Tile = {
  id: string
  game_id: string
  owner_id: string | null
  color: CardColor
  number: number
  position: number | null
  is_revealed: boolean
  reveal_level: RevealLevel
  is_in_deck: boolean
  drawn_turn: number | null
  drawn_by: string | null
  is_draw_card: boolean
}

type GameData = {
  id: string
  current_turn: number
  status: GameStatus | null
  winner_id: string | null
  rematch_player_1: boolean
  rematch_player_2: boolean
  player_1_item_used: boolean
  player_2_item_used: boolean
}

type GuessResult = {
  result:
    | 'color_correct'
    | 'color_wrong'
    | 'full_correct'
    | 'full_wrong'
    | 'won'
  correct: boolean
  guess_mode: GuessMode
  drew_card: boolean
  current_turn: number
}

type ItemResult = {
  success: boolean
  reveal_type: ItemRevealType
  reveal_level: RevealLevel
  current_turn: number
  turn_changed: boolean
}

type TimeoutResult = {
  success: boolean
  ignored: boolean
  drew_card?: boolean
  revealed_color?: boolean
  current_turn?: number
  reason?: string
}

const primaryButton =
  'rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-950/40 transition duration-200 hover:-translate-y-0.5 hover:from-emerald-400 hover:to-teal-400 hover:shadow-emerald-500/30 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/70'

const purpleButton =
  'rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-violet-950/40 transition duration-200 hover:-translate-y-0.5 hover:from-violet-500 hover:to-fuchsia-500 hover:shadow-violet-500/30 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-300/70'

const secondaryButton =
  'rounded-xl border border-slate-600 bg-slate-800/80 px-4 py-3 text-sm font-bold text-slate-100 transition duration-200 hover:-translate-y-0.5 hover:border-slate-400 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-400/70'

export default function GamePage() {
  const searchParams = useSearchParams()
  const roomCode = searchParams.get('room')

  const [gameId, setGameId] = useState<string | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [tiles, setTiles] = useState<Tile[]>([])
  const [currentTurn, setCurrentTurn] = useState(0)

  const [gameStatus, setGameStatus] = useState<GameStatus>('waiting')
  const [winnerId, setWinnerId] = useState<string | null>(null)

  const [rematchPlayer1, setRematchPlayer1] = useState(false)
  const [rematchPlayer2, setRematchPlayer2] = useState(false)

  const [player1ItemUsed, setPlayer1ItemUsed] = useState(false)
  const [player2ItemUsed, setPlayer2ItemUsed] = useState(false)

  const [nickname, setNickname] = useState('')
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null)

  const [selectedTile, setSelectedTile] = useState<string | null>(null)
  const [guessMode, setGuessMode] = useState<GuessMode>('full')
  const [guessedColor, setGuessedColor] = useState<CardColor>('BLACK')
  const [guessedNumber, setGuessedNumber] = useState<number | null>(null)
  const [itemMode, setItemMode] = useState<ItemRevealType | null>(null)

  const [message, setMessage] = useState('')

  const [isJoining, setIsJoining] = useState(false)
  const [isGuessing, setIsGuessing] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [isUsingItem, setIsUsingItem] = useState(false)
  const [isRequestingRematch, setIsRequestingRematch] = useState(false)

  const [secondsLeft, setSecondsLeft] = useState(20)
  const [isTimingOut, setIsTimingOut] = useState(false)

  const lastDrawKeyRef = useRef<string | null>(null)
  const lastTimeoutKeyRef = useRef<string | null>(null)

  const playerStorageKey = roomCode ? `playerId_${roomCode}` : null

  const myPlayer = useMemo(
    () => players.find((player) => player.id === myPlayerId),
    [players, myPlayerId],
  )

  const isMyTurn =
    gameStatus === 'playing' &&
    myPlayer !== undefined &&
    currentTurn % 2 === myPlayer.player_order

  const gameStarted = players.length === 2

  const didIRequestRematch =
    myPlayer?.player_order === 0 ? rematchPlayer1 : rematchPlayer2

  const didOpponentRequestRematch =
    myPlayer?.player_order === 0 ? rematchPlayer2 : rematchPlayer1

  const hasUsedItem =
    myPlayer?.player_order === 0 ? player1ItemUsed : player2ItemUsed

  const canUseItem =
    gameStatus === 'playing' &&
    isMyTurn &&
    !hasUsedItem &&
    !isDrawing &&
    !isGuessing &&
    !isUsingItem &&
    !isTimingOut

  const sortByPosition = (a: Tile, b: Tile) => {
    const positionA = a.position ?? 999
    const positionB = b.position ?? 999

    if (positionA !== positionB) return positionA - positionB
    if (a.number !== b.number) return a.number - b.number

    return a.color === 'BLACK' ? -1 : 1
  }

  const myTiles = useMemo(
    () =>
      tiles
        .filter(
          (tile) =>
            tile.owner_id === myPlayerId &&
            tile.is_in_deck === false,
        )
        .sort(sortByPosition),
    [tiles, myPlayerId],
  )

  const opponent = useMemo(
    () => players.find((player) => player.id !== myPlayerId),
    [players, myPlayerId],
  )

  const opponentTiles = useMemo(() => {
    if (!opponent) return []

    return tiles
      .filter(
        (tile) =>
          tile.owner_id === opponent.id &&
          tile.is_in_deck === false,
      )
      .sort(sortByPosition)
  }, [tiles, opponent])

  const deckCount = useMemo(
    () => tiles.filter((tile) => tile.is_in_deck).length,
    [tiles],
  )

  const winner = useMemo(
    () => players.find((player) => player.id === winnerId),
    [players, winnerId],
  )

  const isWinner = winnerId !== null && winnerId === myPlayerId
  const isLoser = winnerId !== null && winnerId !== myPlayerId

  useEffect(() => {
    if (!playerStorageKey) return

    const savedPlayerId = localStorage.getItem(playerStorageKey)

    if (savedPlayerId) setMyPlayerId(savedPlayerId)
  }, [playerStorageKey])

  useEffect(() => {
    if (!roomCode) return

    async function loadGameInfo() {
      const { data, error } = await supabase
        .from('games')
        .select(
          `
            id,
            current_turn,
            status,
            winner_id,
            rematch_player_1,
            rematch_player_2,
            player_1_item_used,
            player_2_item_used
          `,
        )
        .eq('room_code', roomCode)
        .single()

      if (error) {
        console.error('Game load error:', error)
        setMessage(`Could not load room: ${error.message}`)
        return
      }

      if (!data) {
        setMessage('This room does not exist.')
        return
      }

      const game = data as GameData

      setGameId(game.id)
      setCurrentTurn(Number(game.current_turn))
      setGameStatus(game.status ?? 'waiting')
      setWinnerId(game.winner_id ?? null)
      setRematchPlayer1(game.rematch_player_1 ?? false)
      setRematchPlayer2(game.rematch_player_2 ?? false)
      setPlayer1ItemUsed(game.player_1_item_used ?? false)
      setPlayer2ItemUsed(game.player_2_item_used ?? false)
    }

    loadGameInfo()
  }, [roomCode])

  async function loadPlayersForGame(id: string) {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('game_id', id)
      .order('player_order', { ascending: true })

    if (error) {
      console.error('Players load error:', error)
      return []
    }

    const loadedPlayers = (data ?? []) as Player[]
    setPlayers(loadedPlayers)
    return loadedPlayers
  }

  async function loadTilesForGame(id: string) {
    const { data, error } = await supabase
      .from('tiles')
      .select('*')
      .eq('game_id', id)
      .order('is_in_deck', { ascending: true })
      .order('owner_id', { ascending: true })
      .order('position', { ascending: true })

    if (error) {
      console.error('Tiles load error:', error)
      return []
    }

    const loadedTiles = (data ?? []) as Tile[]
    setTiles(loadedTiles)
    return loadedTiles
  }

  async function loadGameState(id: string) {
    const { data, error } = await supabase
      .from('games')
      .select(
        `
          current_turn,
          status,
          winner_id,
          rematch_player_1,
          rematch_player_2,
          player_1_item_used,
          player_2_item_used
        `,
      )
      .eq('id', id)
      .single()

    if (error || !data) {
      console.error('Game state load error:', error)
      return null
    }

    setCurrentTurn(Number(data.current_turn))
    setGameStatus((data.status ?? 'waiting') as GameStatus)
    setWinnerId(data.winner_id ?? null)
    setRematchPlayer1(data.rematch_player_1 ?? false)
    setRematchPlayer2(data.rematch_player_2 ?? false)
    setPlayer1ItemUsed(data.player_1_item_used ?? false)
    setPlayer2ItemUsed(data.player_2_item_used ?? false)

    return data
  }

  useEffect(() => {
    if (!gameId) return

    async function loadInitialGameData() {
      await loadGameState(gameId!)
      await loadPlayersForGame(gameId!)
      await loadTilesForGame(gameId!)
    }

    loadInitialGameData()
  }, [gameId])

    useEffect(() => {
    if (!gameId || !myPlayerId || !playerStorageKey) return

    async function validateSavedPlayer() {
      const { data, error } = await supabase
        .from('players')
        .select('id, nickname')
        .eq('id', myPlayerId)
        .eq('game_id', gameId)
        .maybeSingle()

      if (error || !data) {
        localStorage.removeItem(playerStorageKey)
        setMyPlayerId(null)
        return
      }

      setNickname(data.nickname)
    }

    validateSavedPlayer()
  }, [gameId, myPlayerId, playerStorageKey])
