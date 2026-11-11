# 👑 King of the Ocean

A fast, silly sawfish party brawler for **1–4 players**. Steal the crown, hold it for 45 seconds, rule the reef.

**Play:** https://mattschwartz691.github.io/king-of-the-ocean/

## How to play
- **Drag** anywhere on the left side of the screen to swim. **Tap** the right side to **Saw Dash**.
- Hit a rival with your saw to stun them and knock the crown loose. Head-on dashes **clash**.
- Wear the crown to fill your reign bar. First to **45 seconds** wins.
- Slice through 6 fish for a **Feeding Frenzy** (speed + rapid dashes). The golden fish fills it instantly.
- Bubbles hold power-ups: **Speed**, **Shield**, **Zap**. Jellyfish sting — or dash through to pop them.
- Desktop: WASD / arrow keys + Space.

## Modes
- **Solo** – climb a 10-rank ladder against increasingly ruthless bots.
- **Party (2–4 players, same Wi-Fi)** – one phone taps **Host Party**; friends scan the QR code (or tap **Join Party** and type the 4-letter code). Empty seats can be filled with bots.

On iPhone, use Share → **Add to Home Screen** for full-screen play. Landscape feels best.

## Tech
Zero-build static site: vanilla JS modules + Canvas 2D. All art and audio are generated in code.
Multiplayer is peer-to-peer WebRTC (via [PeerJS](https://peerjs.com); its public broker is used only for the handshake), with the host phone running the authoritative simulation.

Run locally: `python3 -m http.server` and open `http://localhost:8000`.
