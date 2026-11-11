// King of the Ocean — peer-to-peer networking over WebRTC (PeerJS).
// The page is static; PeerJS' public broker is used only for the initial handshake,
// after which phones on the same Wi-Fi talk directly to each other.
const PREFIX = 'kingocean-v1-';
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

function makeCode() {
  let s = '';
  for (let i = 0; i < 4; i++) s += LETTERS[(Math.random() * LETTERS.length) | 0];
  return s;
}
const opts = () => ({ debug: 0 });

export function hostRoom(h) {
  // h: onOpen(code), onJoin(id, name), onLeave(id), onMsg(id, msg), onError(text)
  let peer = null, closed = false, tries = 0, code = '';
  const conns = new Map();
  function open() {
    code = makeCode();
    peer = new window.Peer(PREFIX + code, opts());
    peer.on('open', () => h.onOpen(code));
    peer.on('connection', (c) => {
      c.on('open', () => { conns.set(c.peer, c); });
      c.on('data', (m) => {
        if (!m || typeof m !== 'object') return;
        if (m.t === 'hello') h.onJoin(c.peer, String(m.name || 'Guest').slice(0, 12));
        else h.onMsg(c.peer, m);
      });
      const bye = () => { if (conns.delete(c.peer)) h.onLeave(c.peer); };
      c.on('close', bye); c.on('error', bye);
    });
    peer.on('error', (e) => {
      if (closed) return;
      if (e.type === 'unavailable-id' && tries++ < 5) { peer.destroy(); open(); return; }
      if (e.type === 'peer-unavailable') return;
      h.onError(e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error'
        ? 'Could not reach the matchmaking server. Check your internet connection.' : 'Connection error: ' + e.type);
    });
    peer.on('disconnected', () => { if (!closed) { try { peer.reconnect(); } catch (_) {} } });
  }
  open();
  return {
    get code() { return code; },
    send(id, m) { const c = conns.get(id); if (c && c.open) { try { c.send(m); } catch (_) {} } },
    broadcast(m) { for (const c of conns.values()) if (c.open) { try { c.send(m); } catch (_) {} } },
    kick(id) { const c = conns.get(id); if (c) c.close(); },
    close() { closed = true; try { peer.destroy(); } catch (_) {} },
  };
}

export function joinRoom(code, name, h) {
  // h: onOpen(), onMsg(msg), onClose(text)
  let closed = false, opened = false;
  const peer = new window.Peer(opts());
  let conn = null;
  const fail = (text) => { if (closed) return; closed = true; try { peer.destroy(); } catch (_) {} h.onClose(text); };
  const timer = setTimeout(() => { if (!opened) fail('Could not find that party. Check the code and that you are on the same Wi-Fi.'); }, 12000);
  peer.on('open', () => {
    conn = peer.connect(PREFIX + code.toUpperCase(), { reliable: true, serialization: 'json' });
    conn.on('open', () => { opened = true; clearTimeout(timer); conn.send({ t: 'hello', name }); h.onOpen(); });
    conn.on('data', (m) => { if (m && typeof m === 'object') h.onMsg(m); });
    conn.on('close', () => fail(opened ? 'The host left the party.' : 'Could not join that party.'));
    conn.on('error', () => fail('Connection lost.'));
  });
  peer.on('error', (e) => {
    clearTimeout(timer);
    fail(e.type === 'peer-unavailable' ? 'No party found with code ' + code.toUpperCase() + '.' : 'Could not connect (' + e.type + ').');
  });
  return {
    send(m) { if (conn && conn.open) { try { conn.send(m); } catch (_) {} } },
    close() { closed = true; clearTimeout(timer); try { peer.destroy(); } catch (_) {} },
  };
}
