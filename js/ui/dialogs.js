// Minimal dialog layer shared by header menus, sound consent and round info.
const layer = () => document.getElementById('dialog-layer');

export function closeDialog() {
  const el = layer();
  el.hidden = true;
  el.innerHTML = '';
}

export function openDialog({ title, bodyHTML, buttons = [] }) {
  const el = layer();
  el.innerHTML = '';
  el.hidden = false;

  const box = document.createElement('div');
  box.className = 'dialog';
  box.innerHTML = `<h2>${title}</h2>${bodyHTML}`;

  if (buttons.length) {
    const row = document.createElement('div');
    row.className = 'dialog-buttons';
    buttons.forEach(({ label, primary, onClick }) => {
      const btn = document.createElement('button');
      btn.className = `dialog-btn${primary ? ' primary' : ''}`;
      btn.textContent = label;
      btn.addEventListener('click', () => {
        closeDialog();
        onClick?.();
      });
      row.appendChild(btn);
    });
    box.appendChild(row);
  }

  el.appendChild(box);
  el.onclick = (e) => {
    if (e.target === el) closeDialog();
  };
  return box;
}
