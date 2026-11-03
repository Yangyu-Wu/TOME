import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mineflayer from 'mineflayer';
import pathfinderPackage from 'mineflayer-pathfinder';

const here = path.dirname(fileURLToPath(import.meta.url));
const { pathfinder, Movements, goals } = pathfinderPackage;
const logDir = path.join(here, '..', 'logs', 'minecraft');
fs.mkdirSync(logDir, { recursive: true });
const logFile = path.join(logDir, 'events.jsonl');

function record(type, payload = {}) {
  const event = { at: new Date().toISOString(), type, ...payload };
  fs.appendFileSync(logFile, `${JSON.stringify(event)}\n`);
  console.log(JSON.stringify(event));
}

const bot = mineflayer.createBot({
  host: process.env.MC_HOST ?? '127.0.0.1',
  port: Number(process.env.MC_PORT ?? 25565),
  username: process.env.MC_BOT_NAME ?? 'ResearchNPC',
  auth: 'offline',
});

bot.loadPlugin(pathfinder);

bot.once('spawn', async () => {
  const movements = new Movements(bot);
  movements.canDig = false;
  bot.pathfinder.setMovements(movements);
  try {
    const { mineflayer: viewer } = await import('prismarine-viewer');
    viewer(bot, { port: 3007, firstPerson: true });
    record('viewer_started', { url: 'http://localhost:3007' });
  } catch (error) {
    // The in-game client remains the primary visualizer when canvas is unavailable.
    record('viewer_unavailable', { message: error.message });
  }
  record('spawn', { position: bot.entity.position.toArray() });
  bot.chat('Research NPC online. Commands: !status, !follow, !stop, !goto x y z');
});

bot.on('chat', (username, message) => {
  if (username === bot.username || !message.startsWith('!')) return;
  const [command, ...args] = message.slice(1).trim().split(/\s+/);
  if (command === 'status') {
    const p = bot.entity.position;
    bot.chat(`state=idle position=${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}`);
    record('status_requested', { by: username, position: p.toArray() });
  } else if (command === 'follow') {
    const player = bot.players[username]?.entity;
    if (!player) return bot.chat('I cannot see you yet.');
    bot.pathfinder.setGoal(new goals.GoalFollow(player, 2), true);
    record('goal_follow', { by: username });
  } else if (command === 'goto' && args.length === 3 && args.every((v) => Number.isFinite(Number(v)))) {
    const [x, y, z] = args.map(Number);
    bot.pathfinder.setGoal(new goals.GoalNear(x, y, z, 1));
    record('goal_goto', { by: username, target: [x, y, z] });
  } else if (command === 'stop') {
    bot.pathfinder.setGoal(null);
    record('goal_stop', { by: username });
  }
});

bot.on('goal_reached', () => record('goal_reached', { position: bot.entity.position.toArray() }));
bot.on('kicked', (reason) => record('kicked', { reason: String(reason) }));
bot.on('error', (error) => record('error', { message: error.message }));
bot.on('end', () => record('end'));
