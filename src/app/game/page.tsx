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

    const currentGameId = gameId
    const currentPlayerId = myPlayerId
    const currentStorageKey = playerStorageKey

    async function validateSavedPlayer() {
      const { data, error } = await supabase
        .from('players')
        .select('id, nickname')
        .eq('id', currentPlayerId)
        .eq('game_id', currentGameId)
        .maybeSingle()

      if (error || !data) {
        localStorage.removeItem(currentStorageKey)
        setMyPlayerId(null)
        return
      }

      setNickname(data.nickname)
    }

    validateSavedPlayer()
  }, [gameId, myPlayerId, playerStorageKey])

  useEffect(() => {
    if (!gameId) return

    const channel = supabase
      .channel(`game-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'players',
          filter: `game_id=eq.${gameId}`,
        },
        async () => {
          await loadPlayersForGame(gameId!)
          await loadTilesForGame(gameId!)
          await loadGameState(gameId!)
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tiles',
          filter: `game_id=eq.${gameId}`,
        },
        async () => {
          await loadTilesForGame(gameId!)
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tiles',
          filter: `game_id=eq.${gameId}`,
        },
        async () => {
          await loadTilesForGame(gameId!)
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'tiles',
          filter: `game_id=eq.${gameId}`,
        },
        async () => {
          await loadTilesForGame(gameId!)
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        async (payload) => {
          setCurrentTurn(Number(payload.new.current_turn))
          setGameStatus(
            (payload.new.status ?? 'waiting') as GameStatus,
          )
          setWinnerId(payload.new.winner_id ?? null)
          setRematchPlayer1(payload.new.rematch_player_1 ?? false)
          setRematchPlayer2(payload.new.rematch_player_2 ?? false)
          setPlayer1ItemUsed(payload.new.player_1_item_used ?? false)
          setPlayer2ItemUsed(payload.new.player_2_item_used ?? false)

          setSelectedTile(null)
          setGuessedNumber(null)
          setItemMode(null)
          setSecondsLeft(20)
          setIsTimingOut(false)

          await loadTilesForGame(gameId!)
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          setMessage('Realtime connection error. Refresh the page.')
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameId])

  useEffect(() => {
    if (!gameId || !myPlayerId || !myPlayer) return
    if (gameStatus !== 'playing' || !isMyTurn) return

    const drawKey = `${gameId}:${currentTurn}:${myPlayerId}`

    if (lastDrawKeyRef.current === drawKey) return

    lastDrawKeyRef.current = drawKey

    let cancelled = false

    async function drawCardAutomatically() {
      setIsDrawing(true)

      try {
        const { data: drawnTileId, error } = await supabase.rpc(
          'draw_card_for_turn',
          {
            p_game_id: gameId!,
            p_player_id: myPlayerId,
          },
        )

        if (error) throw new Error(error.message)
        if (cancelled) return

        await loadTilesForGame(gameId!)
        if (cancelled) return

        setMessage(
          drawnTileId
            ? 'New card drawn. Your move.'
            : 'The deck is empty. Your move.',
        )
      } catch (error) {
        if (!cancelled) {
          lastDrawKeyRef.current = null
          setMessage(
            error instanceof Error
              ? error.message
              : 'Could not draw a card.',
          )
        }
      } finally {
        if (!cancelled) setIsDrawing(false)
      }
    }

    drawCardAutomatically()

    return () => {
      cancelled = true
    }
  }, [
    gameId,
    myPlayerId,
    currentTurn,
    gameStatus,
    isMyTurn,
    myPlayer?.player_order,
  ])

  useEffect(() => {
    if (
      !gameId ||
      !myPlayerId ||
      gameStatus !== 'playing' ||
      !isMyTurn ||
      isDrawing ||
      isGuessing ||
      isUsingItem ||
      isTimingOut
    ) {
      return
    }

    setSecondsLeft(20)

    const timerId = window.setInterval(() => {
      setSecondsLeft((previousSeconds) => {
        if (previousSeconds <= 1) {
          window.clearInterval(timerId)
          return 0
        }

        return previousSeconds - 1
      })
    }, 1000)

    return () => {
      window.clearInterval(timerId)
    }
  }, [
    gameId,
    myPlayerId,
    currentTurn,
    isMyTurn,
    gameStatus,
    isDrawing,
    isGuessing,
    isUsingItem,
    isTimingOut,
  ])

  useEffect(() => {
    if (
      !gameId ||
      !myPlayerId ||
      gameStatus !== 'playing' ||
      !isMyTurn ||
      secondsLeft !== 0 ||
      isTimingOut
    ) {
      return
    }

    const timeoutKey = `${gameId}:${currentTurn}:${myPlayerId}`

    if (lastTimeoutKeyRef.current === timeoutKey) return

    lastTimeoutKeyRef.current = timeoutKey

    let cancelled = false

    async function timeoutTurn() {
      setIsTimingOut(true)

      try {
        const { data, error } = await supabase.rpc('timeout_turn', {
          p_game_id: gameId!,
          p_player_id: myPlayerId,
          p_turn_number: currentTurn,
        })

        if (error) throw new Error(error.message)
        if (cancelled) return

        const result = data as TimeoutResult

        if (result.ignored) return

        setMessage(
          result.drew_card
            ? 'Time is up. Your new card color was revealed.'
            : 'Time is up. No deck card was available, so the turn passed.',
        )

        setSelectedTile(null)
        setGuessedNumber(null)
        setItemMode(null)
        lastDrawKeyRef.current = null

        await loadGameState(gameId!)
        await loadTilesForGame(gameId!)
      } catch (error) {
        if (!cancelled) {
          setMessage(
            error instanceof Error
              ? error.message
              : 'Could not process timeout.',
          )
        }
      } finally {
        if (!cancelled) setIsTimingOut(false)
      }
    }

    timeoutTurn()

    return () => {
      cancelled = true
    }
  }, [
    gameId,
    myPlayerId,
    currentTurn,
    isMyTurn,
    gameStatus,
    secondsLeft,
    isTimingOut,
  ])

  async function joinGame() {
    if (!gameId || !roomCode || !playerStorageKey || isJoining) return

    if (!nickname.trim()) {
      setMessage('Please enter a nickname.')
      return
    }

    setIsJoining(true)
    setMessage('')

    try {
      const savedPlayerId = localStorage.getItem(playerStorageKey)

      if (savedPlayerId) {
        const { data: savedPlayer } = await supabase
          .from('players')
          .select('*')
          .eq('id', savedPlayerId)
          .eq('game_id', gameId)
          .maybeSingle()

        if (savedPlayer) {
          setMyPlayerId(savedPlayer.id)
          setNickname(savedPlayer.nickname)

          await loadGameState(gameId!)
          await loadPlayersForGame(gameId!)
          await loadTilesForGame(gameId!)
          return
        }

        localStorage.removeItem(playerStorageKey)
      }

      const latestPlayers = await loadPlayersForGame(gameId!)

      if (latestPlayers.length >= 2) {
        setMessage('This room already has two players.')
        return
      }

      const playerOrder = latestPlayers.length

      const { data: player, error: playerError } = await supabase
        .from('players')
        .insert({
          game_id: gameId!,
          nickname: nickname.trim(),
          player_order: playerOrder,
        })
        .select('*')
        .single()

      if (playerError || !player) {
        throw new Error(playerError?.message ?? 'Could not join game.')
      }

      localStorage.setItem(playerStorageKey, player.id)
      setMyPlayerId(player.id)

      if (playerOrder === 0) {
        setMessage('Waiting for your opponent...')
      } else {
        setMessage('Shuffling cards and preparing the board...')

        const { error: startGameError } = await supabase.rpc(
          'start_rematch',
          { p_game_id: gameId! },
        )

        if (startGameError) {
          throw new Error(
            `Could not start game: ${startGameError.message}`,
          )
        }

        lastDrawKeyRef.current = null
        lastTimeoutKeyRef.current = null

        setMessage('Game started. The first player was selected randomly.')
      }

      await loadGameState(gameId!)
      await loadPlayersForGame(gameId!)
      await loadTilesForGame(gameId!)
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Could not join game.',
      )
    } finally {
      setIsJoining(false)
    }
  }

  function clearSelection() {
    setSelectedTile(null)
    setGuessedNumber(null)
  }

  function handleTileClick(tile: Tile) {
    if (
      !isMyTurn ||
      isGuessing ||
      isDrawing ||
      isUsingItem ||
      isTimingOut ||
      tile.reveal_level === 'full'
    ) {
      return
    }

    setSelectedTile(tile.id)

    if (itemMode) {
      setMessage(
        `Item target selected. Reveal this card's ${itemMode}?`,
      )
      return
    }

    setMessage(
      guessMode === 'color'
        ? 'Card selected. Choose a color and submit your guess.'
        : 'Card selected. Choose a color, number, and submit your guess.',
    )
  }

  function changeGuessMode(mode: GuessMode) {
    if (isTimingOut) return

    setGuessMode(mode)
    setItemMode(null)
    clearSelection()

    setMessage(
      mode === 'color'
        ? 'Color-only guess mode selected.'
        : 'Color + number guess mode selected.',
    )
  }

  function selectItemMode(mode: ItemRevealType) {
    if (!canUseItem) return

    setItemMode(mode)
    clearSelection()

    setMessage(
      mode === 'color'
        ? 'Reveal Item active: choose an opponent card to reveal its color.'
        : 'Reveal Item active: choose an opponent card to reveal its number.',
    )
  }

  function cancelItemMode() {
    setItemMode(null)
    clearSelection()
    setMessage('Reveal Item cancelled.')
  }

  async function useRevealItem() {
    if (
      !gameId ||
      !myPlayerId ||
      !selectedTile ||
      !itemMode ||
      !canUseItem
    ) {
      return
    }

    setIsUsingItem(true)

    try {
      const { data, error } = await supabase.rpc('use_reveal_item', {
        p_game_id: gameId!,
        p_player_id: myPlayerId,
        p_target_tile_id: selectedTile,
        p_reveal_type: itemMode,
      })

      if (error) throw new Error(error.message)

      const result = data as ItemResult

      if (result.reveal_level === 'full') {
        setMessage('Reveal Item used: the entire card is now revealed.')
      } else {
        setMessage(
          `Reveal Item used: opponent card ${result.reveal_type} revealed.`,
        )
      }

      if (myPlayer?.player_order === 0) {
        setPlayer1ItemUsed(true)
      } else {
        setPlayer2ItemUsed(true)
      }

      setItemMode(null)
      clearSelection()

      await loadGameState(gameId!)
      await loadTilesForGame(gameId!)
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Could not use item.',
      )
    } finally {
      setIsUsingItem(false)
    }
  }

  async function makeGuess() {
    if (
      !gameId ||
      !myPlayerId ||
      !selectedTile ||
      isGuessing ||
      isDrawing ||
      isUsingItem ||
      isTimingOut ||
      itemMode
    ) {
      return
    }

    if (guessMode === 'full' && guessedNumber === null) {
      setMessage('Enter a number from 0 to 11.')
      return
    }

    setIsGuessing(true)

    try {
      const { data, error } = await supabase.rpc('make_guess', {
        p_game_id: gameId!,
        p_player_id: myPlayerId,
        p_target_tile_id: selectedTile,
        p_guess_mode: guessMode,
        p_guessed_color: guessedColor,
        p_guessed_number:
          guessMode === 'full' ? guessedNumber : null,
      })

      if (error) throw new Error(error.message)

      const result = data as GuessResult

      if (result.result === 'won') {
        setMessage('Perfect deduction. You revealed every opponent card! 🎉')
      } else if (result.result === 'color_correct') {
        setMessage('Correct color. The card color is now revealed.')
      } else if (result.result === 'full_correct') {
        setMessage('Correct! The full opponent card is revealed.')
      } else if (result.result === 'color_wrong') {
        setMessage(
          result.drew_card
            ? 'Wrong color. Your new card color was revealed.'
            : 'Wrong color. The deck is empty, so no card was revealed.',
        )
      } else {
        setMessage(
          result.drew_card
            ? 'Wrong guess. Your new card was fully revealed.'
            : 'Wrong guess. The deck is empty, so no card was revealed.',
        )
      }

      clearSelection()
      lastDrawKeyRef.current = null

      await loadGameState(gameId!)
      await loadTilesForGame(gameId!)
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Could not submit guess.',
      )
    } finally {
      setIsGuessing(false)
    }
  }

  async function requestRematch() {
    if (
      !gameId ||
      !myPlayer ||
      gameStatus !== 'finished' ||
      isRequestingRematch
    ) {
      return
    }

    setIsRequestingRematch(true)
    setMessage('')

    try {
      const myFlagColumn =
        myPlayer.player_order === 0
          ? 'rematch_player_1'
          : 'rematch_player_2'

      const { data: requestedGame, error: requestError } = await supabase
        .from('games')
        .update({
          [myFlagColumn]: true,
        })
        .eq('id', gameId)
        .eq('status', 'finished')
        .select(
          'id, rematch_player_1, rematch_player_2, status',
        )
        .single()

      if (requestError || !requestedGame) {
        throw new Error(
          requestError?.message ?? 'Could not request rematch.',
        )
      }

      const player1Accepted = requestedGame.rematch_player_1
      const player2Accepted = requestedGame.rematch_player_2

      setRematchPlayer1(player1Accepted)
      setRematchPlayer2(player2Accepted)

      if (!player1Accepted || !player2Accepted) {
        setMessage('Rematch requested. Waiting for your opponent...')
        return
      }

      setMessage('Both players accepted. Shuffling a new deck...')

      const { error: rematchError } = await supabase.rpc('start_rematch', {
        p_game_id: gameId!,
      })

      if (rematchError) throw new Error(rematchError.message)

      lastDrawKeyRef.current = null
      lastTimeoutKeyRef.current = null

      setItemMode(null)
      clearSelection()
      setSecondsLeft(20)

      await loadGameState(gameId!)
      await loadTilesForGame(gameId!)

      setMessage('Rematch started. Both Reveal Items are restored.')
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Could not start rematch.',
      )
    } finally {
      setIsRequestingRematch(false)
    }
  }

  function renderOpponentCard(tile: Tile) {
    if (tile.reveal_level === 'full') {
      return (
        <>
          <span className="text-[10px] font-black tracking-[0.12em] opacity-75">
            {tile.color}
          </span>
          <span className="mt-1 text-3xl font-black tabular-nums">
            {tile.number}
          </span>
          <span className="mt-1 text-[9px] font-bold text-red-400">
            FULLY REVEALED
          </span>
        </>
      )
    }

    if (tile.reveal_level === 'color') {
      return (
        <>
          <span
            className={`rounded-lg px-2 py-1 text-[10px] font-black tracking-wider ${tile.color === 'BLACK'
              ? 'bg-slate-950 text-white'
              : 'bg-white text-slate-950'
              }`}
          >
            {tile.color}
          </span>
          <span className="mt-2 text-3xl font-black">?</span>
          <span className="mt-1 text-[9px] font-bold text-yellow-600">
            COLOR KNOWN
          </span>
        </>
      )
    }

    if (tile.reveal_level === 'number') {
      return (
        <>
          <span className="rounded-lg bg-violet-500 px-2 py-1 text-[10px] font-black text-white">
            COLOR ?
          </span>
          <span className="mt-2 text-3xl font-black tabular-nums">
            {tile.number}
          </span>
          <span className="mt-1 text-[9px] font-bold text-violet-600">
            NUMBER KNOWN
          </span>
        </>
      )
    }

    return (
      <>
        <span className="text-[10px] font-black tracking-[0.2em] text-slate-500">
          HIDDEN
        </span>
        <span className="mt-2 text-3xl font-black tracking-wider">???</span>
        <span className="mt-2 text-[9px] font-bold text-slate-500">
          UNKNOWN CARD
        </span>
      </>
    )
  }

  if (!roomCode) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
        <div className="rounded-3xl border border-red-400/20 bg-red-500/10 p-8 text-center text-red-200">
          No room code.
        </div>
      </main>
    )
  }

  if (!myPlayerId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-5 text-white">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/80 p-7 shadow-2xl shadow-black/40 backdrop-blur">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-indigo-300">
            Davinci Code
          </p>

          <h1 className="mt-2 text-3xl font-black tracking-tight">
            Join Room{' '}
            <span className="text-indigo-300">{roomCode}</span>
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-400">
            Enter your name to join this deduction match.
          </p>

          <input
            type="text"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') joinGame()
            }}
            placeholder="Your nickname"
            disabled={isJoining}
            className="mt-6 w-full rounded-xl border border-slate-600 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-400/20 disabled:opacity-50"
          />

          <button
            type="button"
            onClick={joinGame}
            disabled={isJoining}
            className={`${primaryButton} mt-4 w-full`}
          >
            {isJoining ? 'Joining room...' : 'Join game'}
          </button>

          {message && (
            <p className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-center text-sm text-red-200">
              {message}
            </p>
          )}
        </div>
      </main>
    )
  }

  if (!gameStarted || gameStatus === 'waiting') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-5 text-white">
        <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900/80 p-8 text-center shadow-2xl shadow-black/40 backdrop-blur">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-indigo-400/30 bg-indigo-500/15 text-3xl">
            🎴
          </div>

          <p className="mt-6 text-xs font-black uppercase tracking-[0.3em] text-indigo-300">
            Room ready
          </p>

          <h1 className="mt-2 text-3xl font-black">Waiting for opponent</h1>

          <p className="mt-4 text-slate-400">
            Share this room code:
          </p>

          <div className="mx-auto mt-3 inline-flex rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-5 py-3 font-mono text-2xl font-black tracking-[0.2em] text-indigo-200">
            {roomCode}
          </div>

          {message && (
            <p className="mt-6 rounded-xl border border-sky-400/20 bg-sky-400/10 p-3 text-sm text-sky-100">
              {message}
            </p>
          )}
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-4 py-6 text-white sm:px-6 lg:px-10">
      <header className="mx-auto max-w-7xl rounded-3xl border border-white/10 bg-slate-900/75 p-5 shadow-2xl shadow-black/30 backdrop-blur md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-indigo-300">
              Davinci Code
            </p>

            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
              Room <span className="text-indigo-300">{roomCode}</span>
            </h1>

            <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wider">
              <span className="rounded-lg border border-slate-600 bg-slate-950/60 px-3 py-2 text-slate-300">
                Players <b className="ml-1 text-white">{players.length}/2</b>
              </span>
              <span className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-cyan-200">
                Deck <b className="ml-1 text-white">{deckCount}</b>
              </span>

              <span className="rounded-lg border border-indigo-400/20 bg-indigo-400/10 px-3 py-2 text-indigo-200">
                Turn <b className="ml-1 text-white">{currentTurn}</b>
              </span>

              <span
                className={`rounded-lg border px-3 py-2 ${hasUsedItem
                  ? 'border-slate-600 bg-slate-800 text-slate-400'
                  : 'border-violet-400/30 bg-violet-500/10 text-violet-200'
                  }`}
              >
                Item <b className="ml-1 text-white">{hasUsedItem ? 'USED' : 'READY'}</b>
              </span>
            </div>
          </div>

          {gameStatus === 'playing' && (
            <div
              className={`min-w-[170px] rounded-2xl border px-5 py-4 text-center shadow-lg ${isMyTurn
                ? secondsLeft <= 5
                  ? 'border-red-400 bg-red-500/15 text-red-100 shadow-red-950/40'
                  : secondsLeft <= 10
                    ? 'border-yellow-400 bg-yellow-500/10 text-yellow-100 shadow-yellow-950/30'
                    : 'border-emerald-400/60 bg-emerald-500/10 text-emerald-100 shadow-emerald-950/30'
                : 'border-slate-700 bg-slate-950/50 text-slate-400'
                }`}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.22em]">
                {isMyTurn ? 'Your turn' : 'Opponent turn'}
              </p>

              <p
                className={`mt-1 text-4xl font-black tabular-nums ${isMyTurn && secondsLeft <= 5 ? 'animate-pulse' : ''
                  }`}
              >
                {isMyTurn
                  ? isTimingOut
                    ? '...'
                    : `${secondsLeft}s`
                  : 'WAIT'}
              </p>

              <p className="mt-1 text-[10px] font-bold uppercase tracking-wider opacity-70">
                {isMyTurn ? 'Make your move' : 'Stay sharp'}
              </p>
            </div>
          )}
        </div>
      </header>

      {message && (
        <div className="mx-auto mt-4 max-w-7xl rounded-2xl border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-sm font-medium text-sky-100 shadow-lg shadow-sky-950/20">
          {message}
        </div>
      )}

      {gameStatus === 'finished' && (
        <section
          className={`mx-auto mt-5 max-w-7xl rounded-3xl border p-6 text-center shadow-2xl ${isWinner
            ? 'border-emerald-400/50 bg-emerald-500/10 shadow-emerald-950/40'
            : isLoser
              ? 'border-red-400/40 bg-red-500/10 shadow-red-950/40'
              : 'border-slate-600 bg-slate-800/60'
            }`}
        >
          <p className="text-4xl">
            {isWinner ? '🏆' : isLoser ? '🧩' : '🎴'}
          </p>

          <h2 className="mt-3 text-3xl font-black">
            {isWinner ? 'You win!' : isLoser ? 'You lose!' : 'Game finished'}
          </h2>

          <p className="mt-2 text-sm text-slate-300">
            Winner: <span className="font-bold text-white">{winner?.nickname ?? 'Unknown player'}</span>
          </p>

          <button
            type="button"
            onClick={requestRematch}
            disabled={didIRequestRematch || isRequestingRematch}
            className={`${purpleButton} mt-5`}
          >
            {isRequestingRematch
              ? 'Preparing...'
              : didIRequestRematch
                ? 'Rematch requested'
                : 'Play rematch'}
          </button>

          {didIRequestRematch && !didOpponentRequestRematch && (
            <p className="mt-4 text-sm text-violet-200">
              Waiting for opponent to accept the rematch...
            </p>
          )}

          {!didIRequestRematch && didOpponentRequestRematch && (
            <p className="mt-4 text-sm text-violet-200">
              Your opponent wants a rematch.
            </p>
          )}
        </section>
      )}

      <div className="mx-auto mt-6 grid max-w-7xl gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-3xl border border-indigo-400/20 bg-slate-900/75 p-5 shadow-xl shadow-black/20 backdrop-blur sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-300">
                Opponent board
              </p>

              <h2 className="mt-1 text-2xl font-black">
                {opponent?.nickname ?? 'Waiting...'}
                <span className="ml-2 text-base font-semibold text-slate-500">
                  {opponentTiles.length} cards
                </span>
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                {itemMode
                  ? `Reveal Item active — choose a card to reveal its ${itemMode}.`
                  : 'Select a hidden or partially revealed card to investigate.'}
              </p>
            </div>

            <span className="rounded-full border border-indigo-400/25 bg-indigo-400/10 px-3 py-1 text-xs font-black text-indigo-200">
              TARGET AREA
            </span>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            {opponentTiles.map((tile) => {
              const canClick =
                gameStatus !== 'finished' &&
                isMyTurn &&
                !isGuessing &&
                !isDrawing &&
                !isUsingItem &&
                !isTimingOut &&
                tile.reveal_level !== 'full'

              return (
                <button
                  key={tile.id}
                  type="button"
                  disabled={!canClick}
                  onClick={() => handleTileClick(tile)}
                  className={`relative flex h-28 w-24 flex-col items-center justify-center rounded-2xl border-2 text-xs shadow-lg transition-all duration-200 sm:h-32 sm:w-28 ${selectedTile === tile.id
                    ? itemMode
                      ? 'scale-105 ring-4 ring-violet-400 ring-offset-4 ring-offset-slate-950'
                      : 'scale-105 ring-4 ring-cyan-400 ring-offset-4 ring-offset-slate-950'
                    : ''
                    } ${tile.reveal_level === 'full'
                      ? tile.color === 'BLACK'
                        ? 'border-slate-600 bg-gradient-to-b from-slate-700 to-slate-950 text-white'
                        : 'border-slate-200 bg-gradient-to-b from-white to-slate-200 text-slate-950'
                      : tile.reveal_level === 'color'
                        ? 'border-yellow-400 bg-gradient-to-b from-yellow-100 to-yellow-300 text-slate-950'
                        : tile.reveal_level === 'number'
                          ? 'border-violet-400 bg-gradient-to-b from-violet-100 to-violet-300 text-slate-950'
                          : 'border-slate-600 bg-gradient-to-b from-slate-800 to-slate-950 text-slate-300'
                    } ${canClick
                      ? 'cursor-pointer hover:-translate-y-1 hover:border-cyan-300 hover:shadow-cyan-500/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300'
                      : 'cursor-not-allowed opacity-60'
                    }`}
                >
                  {renderOpponentCard(tile)}
                </button>
              )
            })}
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-3xl border border-violet-400/25 bg-gradient-to-br from-violet-950/70 to-slate-900/90 p-5 shadow-xl shadow-violet-950/20 backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">
                  Special action
                </p>

                <h2 className="mt-1 text-xl font-black text-white">
                  Reveal Item
                </h2>

                <p className="mt-2 text-sm leading-5 text-violet-200/80">
                  Reveal one opponent card&apos;s color or number.
                  It does not end your turn.
                </p>
              </div>

              <span
                className={`rounded-lg px-3 py-2 text-[10px] font-black tracking-wider ${hasUsedItem
                  ? 'bg-slate-700 text-slate-300'
                  : 'bg-violet-500 text-white shadow-lg shadow-violet-950/40'
                  }`}
              >
                {hasUsedItem ? 'USED' : 'READY'}
              </span>
            </div>

            {!hasUsedItem && !itemMode && (
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => selectItemMode('color')}
                  disabled={!canUseItem}
                  className="rounded-xl bg-yellow-400 px-3 py-3 text-sm font-black text-slate-950 shadow-lg shadow-yellow-950/20 transition hover:-translate-y-0.5 hover:bg-yellow-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                >
                  Reveal color
                </button>

                <button
                  type="button"
                  onClick={() => selectItemMode('number')}
                  disabled={!canUseItem}
                  className={purpleButton}
                >
                  Reveal number
                </button>
              </div>
            )}

            {itemMode && (
              <div className="mt-5 rounded-2xl border border-violet-400/30 bg-violet-500/10 p-4">
                <p className="text-sm font-bold text-violet-100">
                  {selectedTile
                    ? `Reveal selected card's ${itemMode}?`
                    : `Choose an opponent card to reveal its ${itemMode}.`}
                </p>

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={useRevealItem}
                    disabled={
                      !selectedTile ||
                      !canUseItem ||
                      isUsingItem ||
                      isTimingOut
                    }
                    className={`${purpleButton} flex-1 px-3`}
                  >
                    {isUsingItem ? 'Revealing...' : 'Use item'}
                  </button>

                  <button
                    type="button"
                    onClick={cancelItemMode}
                    disabled={isUsingItem || isTimingOut}
                    className={`${secondaryButton} px-3`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-5 shadow-xl shadow-black/20 backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
              Your move
            </p>

            <h2 className="mt-1 text-xl font-black">Guess settings</h2>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => changeGuessMode('color')}
                disabled={
                  gameStatus === 'finished' ||
                  !isMyTurn ||
                  isDrawing ||
                  isGuessing ||
                  isUsingItem ||
                  isTimingOut ||
                  itemMode !== null
                }
                className={`rounded-xl px-3 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${guessMode === 'color'
                  ? 'bg-yellow-400 text-slate-950 ring-2 ring-yellow-200'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
              >
                Color only
              </button>

              <button
                type="button"
                onClick={() => changeGuessMode('full')}
                disabled={
                  gameStatus === 'finished' ||
                  !isMyTurn ||
                  isDrawing ||
                  isGuessing ||
                  isUsingItem ||
                  isTimingOut ||
                  itemMode !== null
                }
                className={`rounded-xl px-3 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${guessMode === 'full'
                  ? 'bg-cyan-500 text-slate-950 ring-2 ring-cyan-200'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
              >
                Color + number
              </button>
            </div>

            <div className="mt-5">
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                Pick color
              </p>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setGuessedColor('BLACK')}
                  disabled={
                    gameStatus === 'finished' ||
                    !isMyTurn ||
                    isDrawing ||
                    isGuessing ||
                    isUsingItem ||
                    isTimingOut ||
                    itemMode !== null
                  }
                  className={`rounded-xl px-3 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${guessedColor === 'BLACK'
                    ? 'bg-slate-950 text-white ring-2 ring-cyan-400'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                >
                  BLACK
                </button>

                <button
                  type="button"
                  onClick={() => setGuessedColor('WHITE')}
                  disabled={
                    gameStatus === 'finished' ||
                    !isMyTurn ||
                    isDrawing ||
                    isGuessing ||
                    isUsingItem ||
                    isTimingOut ||
                    itemMode !== null
                  }
                  className={`rounded-xl px-3 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${guessedColor === 'WHITE'
                    ? 'bg-white text-slate-950 ring-2 ring-cyan-400'
                    : 'bg-slate-200 text-slate-800 hover:bg-white'
                    }`}
                >
                  WHITE
                </button>
              </div>
            </div>

            {guessMode === 'full' && (
              <div className="mt-5">
                <label
                  htmlFor="guessedNumber"
                  className="text-xs font-black uppercase tracking-wider text-slate-400"
                >
                  Pick number
                </label>

                <input
                  id="guessedNumber"
                  type="number"
                  min={0}
                  max={11}
                  value={guessedNumber ?? ''}
                  onChange={(event) => {
                    const value = event.target.value
                    setGuessedNumber(value === '' ? null : Number(value))
                  }}
                  disabled={
                    gameStatus === 'finished' ||
                    !isMyTurn ||
                    isDrawing ||
                    isGuessing ||
                    isUsingItem ||
                    isTimingOut ||
                    itemMode !== null
                  }
                  placeholder="0–11"
                  className="mt-3 w-full rounded-xl border border-slate-600 bg-slate-950 px-4 py-3 text-lg font-black text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/20 disabled:opacity-40"
                />
              </div>
            )}

            <button
              type="button"
              onClick={makeGuess}
              disabled={
                gameStatus === 'finished' ||
                !selectedTile ||
                !isMyTurn ||
                isDrawing ||
                isGuessing ||
                isUsingItem ||
                isTimingOut ||
                itemMode !== null ||
                (guessMode === 'full' && guessedNumber === null)
              }
              className={`${primaryButton} mt-6 w-full`}
            >
              {isGuessing
                ? 'Checking deduction...'
                : guessMode === 'color'
                  ? 'Guess color'
                  : 'Guess color + number'}
            </button>

            <p className="mt-4 rounded-xl border border-slate-700 bg-slate-950/50 p-3 text-xs leading-5 text-slate-400">
              {gameStatus === 'finished'
                ? 'This match has ended.'
                : !isMyTurn
                  ? "Waiting for your opponent's move."
                  : isTimingOut
                    ? 'Time expired. Processing your timeout...'
                    : isDrawing
                      ? deckCount > 0
                        ? 'Drawing a card from the deck...'
                        : 'Deck empty. You may still make a guess.'
                      : itemMode
                        ? 'Reveal Item mode is active.'
                        : !selectedTile
                          ? 'Choose an opponent card first.'
                          : guessMode === 'color'
                            ? `You are guessing: ${guessedColor}.`
                            : guessedNumber === null
                              ? 'Choose a number from 0 to 11.'
                              : `You are guessing: ${guessedColor} ${guessedNumber}.`}
            </p>
          </section>
        </aside>
      </div>

      <section className="mx-auto mt-6 max-w-7xl rounded-3xl border border-emerald-400/15 bg-slate-900/75 p-5 shadow-xl shadow-black/20 backdrop-blur sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
              Your hand
            </p>

            <h2 className="mt-1 text-2xl font-black">
              Your Cards
              <span className="ml-2 text-base font-semibold text-slate-500">
                {myTiles.length} cards
              </span>
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Cards are automatically ordered left to right by number.
            </p>
          </div>

          <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-200">
            SORTED HAND
          </span>
        </div>

        <div className="mt-7 flex flex-wrap gap-3">
          {myTiles.map((tile) => (
            <div
              key={tile.id}
              className={`relative flex h-28 w-24 flex-col items-center justify-center rounded-2xl border-2 text-xs shadow-lg transition-transform duration-200 hover:-translate-y-1 sm:h-32 sm:w-28 ${tile.color === 'BLACK'
                ? 'border-slate-600 bg-gradient-to-b from-slate-700 to-slate-950 text-white shadow-black/40'
                : 'border-slate-200 bg-gradient-to-b from-white to-slate-200 text-slate-950 shadow-white/10'
                } ${tile.is_draw_card && tile.reveal_level === 'hidden'
                  ? 'ring-4 ring-cyan-400/80 ring-offset-4 ring-offset-slate-950'
                  : ''
                } ${tile.reveal_level === 'color'
                  ? 'border-yellow-400 ring-2 ring-yellow-400/60'
                  : ''
                } ${tile.reveal_level === 'number'
                  ? 'border-violet-400 ring-2 ring-violet-400/60'
                  : ''
                } ${tile.reveal_level === 'full'
                  ? 'border-red-400 ring-2 ring-red-400/60'
                  : ''
                }`}
            >
              <span className="text-[10px] font-black tracking-[0.12em] opacity-75">
                {tile.color}
              </span>

              <span className="mt-1 text-3xl font-black tabular-nums">
                {tile.number}
              </span>

              {tile.is_draw_card && tile.reveal_level === 'hidden' && (
                <span className="mt-2 rounded-md bg-cyan-400/20 px-2 py-1 text-[9px] font-black text-cyan-200">
                  NEW
                </span>
              )}

              {tile.reveal_level === 'color' && (
                <span className="mt-2 text-[9px] font-black text-yellow-300">
                  COLOR SHOWN
                </span>
              )}

              {tile.reveal_level === 'number' && (
                <span className="mt-2 text-[9px] font-black text-violet-300">
                  NUMBER SHOWN
                </span>
              )}

              {tile.reveal_level === 'full' && (
                <span className="mt-2 text-[9px] font-black text-red-300">
                  REVEALED
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      <footer className="mx-auto mt-8 max-w-7xl pb-4 text-center text-xs text-slate-600">
        Deduce carefully. Every card reveals a clue.
      </footer>
    </main>
  )
}
