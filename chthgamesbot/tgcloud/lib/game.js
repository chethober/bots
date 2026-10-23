// Pure tic-tac-toe rules plus helpers shared by handlers and endpoints.

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export function winLine(board) {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] !== '.' && board[a] === board[b] && board[a] === board[c]) return line;
  }
  return null;
}

// Returns { board, turn, status } after `symbol` plays `cell`, or null if the move is illegal.
export function applyMove(game, symbol, cell) {
  if (game.status !== 'playing' || game.turn !== symbol) return null;
  if (!Number.isInteger(cell) || cell < 0 || cell > 8 || game.board[cell] !== '.') return null;

  const board = game.board.slice(0, cell) + symbol + game.board.slice(cell + 1);
  let status = 'playing';
  if (winLine(board)) status = symbol === 'X' ? 'x_won' : 'o_won';
  else if (!board.includes('.')) status = 'draw';
  return { board, turn: symbol === 'X' ? 'O' : 'X', status };
}

export function symbolOf(game, userId) {
  if (game.xId === userId) return 'X';
  if (game.oId === userId) return 'O';
  return null;
}

export function displayName(user) {
  return user.username ? `@${user.username}` : (user.first_name || 'Player');
}

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

export function newGameId() {
  const bytes = new Uint8Array(8);
  if (globalThis.crypto?.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

// What the Mini App sees: the game minus internal fields, plus the caller's side.
export function view(game, userId) {
  return {
    id: game.id,
    board: game.board,
    turn: game.turn,
    status: game.status,
    version: game.version,
    x: game.xName,
    o: game.oName,
    you: symbolOf(game, userId),
    winLine: winLine(game.board),
    rematchId: game.rematchId,
  };
}
