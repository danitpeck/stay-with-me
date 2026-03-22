# Stay With Me

A turn-based grid game about closeness, timing, and commitment.

Two characters on a 7×7 grid. One follows. One leads. Overlap is a choice — and choices have weight.

## How to play

- **Arrow keys / WASD** — move one tile per turn
- **Space** — wait (skip your move)
- Walk onto the partner's tile to **overlap**

## Mechanics

- **Overlap** locks you in place — you committed to the moment
- **Hesitation** — when the partner stops next to you, she's waiting. That's your window
- **Timing matters** — overlap during hesitation is gentle. Force it and you'll lose HP
- **HP** — you have 3. Forcing overlap costs 1. Spend wisely

## Built for LLM agents

This game is designed to be played by language model agents. Every mechanic is a legible decision: move, wait, approach, overlap, or retreat. No reflexes required — just reasoning and timing.

## Run locally

```
npm install
npm run dev
```

## Stack

Plain JavaScript, HTML5 Canvas, Vite. Nothing else.
