/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  getOrCreatePlayer,
  getPlayerByToken,
  createLobby,
  joinLobby,
  updateLobbySettings,
  startSession,
  proposeTransfer,
  acceptTransfer,
  rejectTransfer,
  cancelTransfer,
  cancelAllPendingTransfers,
  finalizeSession,
  getLobbyState,
  getPlayerStats,
  getAllSessionsHistory,
} from './src/server/mahjong-engine.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Track connected sockets: lobbyId -> Set<WebSocket>
const lobbySockets = new Map<string, Set<WebSocket>>();
// WebSocket metadata: ws -> { playerId, token, lobbyId }
interface SocketMeta {
  playerId?: string;
  token?: string;
  lobbyId?: string;
}
const socketMetadata = new WeakMap<WebSocket, SocketMeta>();

function getOnlinePlayerIds(lobbyId: string): Set<string> {
  const online = new Set<string>();
  const sockets = lobbySockets.get(lobbyId.toUpperCase());
  if (sockets) {
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        const meta = socketMetadata.get(ws);
        if (meta?.playerId) {
          online.add(meta.playerId);
        }
      }
    }
  }
  return online;
}

export function broadcastLobby(lobbyId: string) {
  const normalizedLobbyId = lobbyId.toUpperCase();
  const sockets = lobbySockets.get(normalizedLobbyId);
  if (!sockets || sockets.size === 0) return;

  const onlinePlayers = getOnlinePlayerIds(normalizedLobbyId);
  const state = getLobbyState(normalizedLobbyId, onlinePlayers);
  if (!state) return;

  const message = JSON.stringify({
    type: 'state',
    state,
  });

  for (const client of sockets) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (err) {
        console.error('Error sending WS message to client:', err);
      }
    }
  }
}

wss.on('connection', (ws: WebSocket) => {
  socketMetadata.set(ws, {});

  ws.on('message', (data: string) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'subscribe') {
        const { lobbyId, token } = msg;
        if (!lobbyId) return;

        const normLobbyId = lobbyId.trim().toUpperCase();
        let player = null;
        if (token) {
          player = getPlayerByToken(token);
        }

        const meta: SocketMeta = {
          lobbyId: normLobbyId,
          playerId: player?.id,
          token,
        };
        socketMetadata.set(ws, meta);

        if (!lobbySockets.has(normLobbyId)) {
          lobbySockets.set(normLobbyId, new Set());
        }
        lobbySockets.get(normLobbyId)!.add(ws);

        // Send immediate state back to this client
        const onlineIds = getOnlinePlayerIds(normLobbyId);
        const state = getLobbyState(normLobbyId, onlineIds);
        if (state) {
          ws.send(JSON.stringify({ type: 'state', state }));
        }

        // Notify other clients about presence update
        broadcastLobby(normLobbyId);
      } else if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      }
    } catch (e) {
      console.error('Failed to parse WebSocket message:', e);
    }
  });

  ws.on('close', () => {
    const meta = socketMetadata.get(ws);
    if (meta?.lobbyId) {
      const set = lobbySockets.get(meta.lobbyId);
      if (set) {
        set.delete(ws);
        if (set.size === 0) {
          lobbySockets.delete(meta.lobbyId);
        }
      }
      broadcastLobby(meta.lobbyId);
    }
  });
});

// Middleware: Authenticate Player via Bearer token
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header.' });
    return;
  }
  const token = authHeader.slice(7).trim();
  const player = getPlayerByToken(token);
  if (!player) {
    res.status(401).json({ error: 'Invalid player token.' });
    return;
  }
  (req as any).player = player;
  next();
}

// REST API Endpoints

// Register or reconnect player
app.post('/api/player', (req: Request, res: Response) => {
  try {
    const { displayName, token } = req.body;
    const player = getOrCreatePlayer(displayName, token);
    res.json({ player });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Get current player profile
app.get('/api/player/me', requireAuth, (req: Request, res: Response) => {
  const player = (req as any).player;
  res.json({ player });
});

// Get player lifetime statistics
app.get('/api/player/stats', requireAuth, (req: Request, res: Response) => {
  try {
    const player = (req as any).player;
    const stats = getPlayerStats(player.id);
    res.json({ stats });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get completed sessions history
app.get('/api/sessions/history', (req: Request, res: Response) => {
  try {
    const history = getAllSessionsHistory();
    res.json({ history });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create Lobby
app.post('/api/lobbies', requireAuth, (req: Request, res: Response) => {
  try {
    const player = (req as any).player;
    const { startingChips, houseRules } = req.body;
    const lobbyId = createLobby(player.id, startingChips, houseRules);
    res.json({ lobbyId });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Get Lobby State
app.get('/api/lobbies/:lobbyId', (req: Request, res: Response) => {
  try {
    const { lobbyId } = req.params;
    const onlineIds = getOnlinePlayerIds(lobbyId);
    const state = getLobbyState(lobbyId, onlineIds);
    if (!state) {
      res.status(404).json({ error: 'Lobby not found.' });
      return;
    }
    res.json({ state });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Join Lobby
app.post('/api/lobbies/:lobbyId/join', requireAuth, (req: Request, res: Response) => {
  try {
    const player = (req as any).player;
    const { lobbyId } = req.params;
    const result = joinLobby(lobbyId, player.id);
    broadcastLobby(result.lobbyId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Update Lobby Settings (Host only, waiting status)
app.patch('/api/lobbies/:lobbyId/settings', requireAuth, (req: Request, res: Response) => {
  try {
    const player = (req as any).player;
    const { lobbyId } = req.params;
    const { startingChips, houseRules } = req.body;
    updateLobbySettings(lobbyId, player.id, startingChips, houseRules);
    broadcastLobby(lobbyId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Start Session (Host only)
app.post('/api/lobbies/:lobbyId/start', requireAuth, (req: Request, res: Response) => {
  try {
    const player = (req as any).player;
    const { lobbyId } = req.params;
    startSession(lobbyId, player.id);
    broadcastLobby(lobbyId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Propose Chip Transfer
app.post('/api/lobbies/:lobbyId/transfers', requireAuth, (req: Request, res: Response) => {
  try {
    const player = (req as any).player;
    const { lobbyId } = req.params;
    const { direction, otherPlayerId, amount, reasonType, reasonNote } = req.body;

    const transferId = proposeTransfer(lobbyId, player.id, {
      direction,
      otherPlayerId,
      amount: parseInt(amount, 10),
      reasonType,
      reasonNote,
    });

    broadcastLobby(lobbyId);
    res.json({ transferId });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Accept Transfer
app.post('/api/lobbies/:lobbyId/transfers/:transferId/accept', requireAuth, (req: Request, res: Response) => {
  try {
    const player = (req as any).player;
    const { lobbyId, transferId } = req.params;
    acceptTransfer(lobbyId, transferId, player.id);
    broadcastLobby(lobbyId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Reject Transfer
app.post('/api/lobbies/:lobbyId/transfers/:transferId/reject', requireAuth, (req: Request, res: Response) => {
  try {
    const player = (req as any).player;
    const { lobbyId, transferId } = req.params;
    rejectTransfer(lobbyId, transferId, player.id);
    broadcastLobby(lobbyId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Cancel Transfer (Initiator only)
app.post('/api/lobbies/:lobbyId/transfers/:transferId/cancel', requireAuth, (req: Request, res: Response) => {
  try {
    const player = (req as any).player;
    const { lobbyId, transferId } = req.params;
    cancelTransfer(lobbyId, transferId, player.id);
    broadcastLobby(lobbyId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Host Cancels All Remaining Pending Transfers
app.post('/api/lobbies/:lobbyId/transfers/cancel-all', requireAuth, (req: Request, res: Response) => {
  try {
    const player = (req as any).player;
    const { lobbyId } = req.params;
    cancelAllPendingTransfers(lobbyId, player.id);
    broadcastLobby(lobbyId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Finalize Session (Host only)
app.post('/api/lobbies/:lobbyId/finalize', requireAuth, (req: Request, res: Response) => {
  try {
    const player = (req as any).player;
    const { lobbyId } = req.params;
    const results = finalizeSession(lobbyId, player.id);
    broadcastLobby(lobbyId);
    res.json({ success: true, results });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Vite middleware in dev or static files in production
async function start() {
  const isProd = process.env.NODE_ENV === 'production';
  const PORT = Number(process.env.PORT) || 3000;

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🀄 Mahjong Chip Ledger server running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
