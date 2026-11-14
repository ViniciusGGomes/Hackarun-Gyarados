import { randomInt } from 'node:crypto'

// Same alphabet as prisma/seed.ts: no 0, 1, I, O.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function part(length: number) {
  return Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')
}

export function generateProtocol() {
  return `CAP-${part(4)}-${part(4)}`
}
