import { CONFIG } from '../config.js';
import { bus } from '../core/bus.js';
import { sfx } from '../audio/sfx.js';

export function initChat(getAvatar) {
  const root = document.getElementById('chat-panel');
  root.innerHTML = `
    <div class="chat-header"><span class="chat-icon"></span>Chat</div>
    <div class="chat-messages scroll" id="chat-messages"></div>
    <div class="chat-footer">
      <div class="chat-counter" id="chat-counter">0 / ${CONFIG.chatMessageLimit}</div>
      <div class="chat-input-row">
        <input class="chat-input" id="chat-input" placeholder="Type your text..."
               maxlength="${CONFIG.chatMessageLimit}">
        <button class="chat-send" id="chat-send" aria-label="Send"></button>
      </div>
    </div>`;

  const messages = document.getElementById('chat-messages');
  const input = document.getElementById('chat-input');
  const counter = document.getElementById('chat-counter');
  const send = document.getElementById('chat-send');

  bus.on('chat:message', ({ name, avatar, text, isPlayer }) => {
    const nearBottom = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 60;
    const msg = document.createElement('div');
    msg.className = `chat-message${isPlayer ? ' own' : ''}`;
    const body = document.createElement('div');
    const who = document.createElement('span');
    who.className = 'chat-name';
    who.textContent = name;
    body.appendChild(who);
    body.appendChild(document.createTextNode(text)); // textNode → no HTML injection
    msg.innerHTML = `<img src="${avatar}" alt="">`;
    msg.appendChild(body);
    messages.appendChild(msg);
    while (messages.children.length > 60) messages.firstChild.remove();
    if (nearBottom || isPlayer) messages.scrollTop = messages.scrollHeight;
  });

  function updateCounter() {
    counter.textContent = `${input.value.length} / ${CONFIG.chatMessageLimit}`;
    counter.classList.toggle('warn', input.value.length >= CONFIG.chatMessageLimit);
  }
  input.addEventListener('input', updateCounter);

  function sendMessage() {
    const text = input.value.trim();
    if (!text || text.length > CONFIG.chatMessageLimit) return;
    bus.emit('chat:message', { name: 'You', avatar: getAvatar(), text, isPlayer: true });
    input.value = '';
    updateCounter();
    sfx.play('click');
  }

  send.addEventListener('click', sendMessage);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
}
