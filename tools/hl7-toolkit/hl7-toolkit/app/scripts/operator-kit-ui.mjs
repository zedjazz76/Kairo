import { createFailureMuseum, runClipboardSanitize } from './operator-kit.mjs';
import { createFieldCoach } from './field-coach.mjs';
import { createOcrEngineRoster } from './ocr-engines.mjs';

function node(document, tag, text = '', className = '') {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  if (className) element.className = className;
  return element;
}

export function mountOperatorKit(root, { sanitizer, basicFields, segmentHelp, api } = {}) {
  const museum = createFailureMuseum();
  const coach = createFieldCoach({ fields: basicFields, segments: segmentHelp });
  const engines = createOcrEngineRoster(api ? () => api.request('/api/ocr/engines') : null);
  const panel = node(root, 'section', '', 'operator-kit');
  panel.id = 'operator-kit';

  const title = node(root, 'h2', 'Operator kit');
  const note = node(root, 'p', 'Session only. No OS hook, no raw PHI stored. Clipboard sanitize runs when you click or press Ctrl+Shift+S in this tab.');
  const clipboardButton = node(root, 'button', 'Sanitize clipboard');
  clipboardButton.type = 'button';
  clipboardButton.id = 'operator-clipboard-sanitize';
  const clipboardStatus = node(root, 'p', 'Clipboard idle.');
  clipboardStatus.id = 'operator-clipboard-status';

  const coachLabel = node(root, 'label', 'Field coach');
  const coachInput = node(root, 'input');
  coachInput.id = 'operator-field-path';
  coachInput.placeholder = 'OBR-16';
  const coachOut = node(root, 'p', 'Type a path such as OBR-16 or PID-5.');
  coachOut.id = 'operator-field-coach';

  const engineStatus = node(root, 'p', '');
  engineStatus.id = 'operator-ocr-engines';
  const museumBox = node(root, 'ol');
  museumBox.id = 'operator-failure-museum';
  const museumClear = node(root, 'button', 'Clear failure codes');
  museumClear.type = 'button';

  function renderMuseum() {
    museumBox.replaceChildren();
    const items = museum.list();
    if (!items.length) {
      museumBox.append(node(root, 'li', 'No failure codes this session.'));
      return;
    }
    for (const item of items) {
      museumBox.append(node(root, 'li', `${item.code} · ${item.source}`));
    }
  }

  function renderCoach() {
    const help = coach.explain(coachInput.value);
    coachOut.textContent = help.found
      ? `${help.title}${help.datatype ? ` (${help.datatype})` : ''}. ${help.detail}`
      : help.detail;
  }

  async function renderEngines() {
    const list = await engines.refresh();
    engineStatus.textContent = list.map((item) => `${item.label}: ${item.available ? 'READY' : item.reason}`).join(' · ');
  }

  async function sanitizeClip() {
    if (!sanitizer) {
      clipboardStatus.textContent = 'Sanitizer is not mounted yet.';
      museum.record('SANITIZER_REQUIRED', 'clipboard');
      renderMuseum();
      return;
    }
    clipboardStatus.textContent = 'Reading clipboard…';
    try {
      const result = await runClipboardSanitize({
        readText: () => navigator.clipboard.readText(),
        writeText: (text) => navigator.clipboard.writeText(text),
        sanitizer,
        museum,
      });
      clipboardStatus.textContent = `Clipboard sanitized · ${result.copiedCharacters} characters · ${result.replacementCount} replacements. Review before sharing.`;
    } catch (error) {
      clipboardStatus.textContent = `Clipboard sanitize stopped · ${String(error?.message || 'CLIPBOARD_SANITIZE_FAILED')}`;
    }
    renderMuseum();
  }

  clipboardButton.addEventListener('click', () => void sanitizeClip());
  coachInput.addEventListener('input', renderCoach);
  museumClear.addEventListener('click', () => { museum.clear(); renderMuseum(); });
  root.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 's')) return;
    if (event.target && ['INPUT', 'TEXTAREA'].includes(event.target.tagName) && event.target !== coachInput) return;
    event.preventDefault();
    void sanitizeClip();
  });

  panel.append(title, note, clipboardButton, clipboardStatus, coachLabel, coachInput, coachOut, engineStatus, node(root, 'h3', 'Failure museum'), museumBox, museumClear);
  const host = root.querySelector('#service-status')?.parentElement || root.body || root;
  host.append(panel);
  renderMuseum();
  renderCoach();
  void renderEngines();
  return { museum, coach, engines, sanitizeClip };
}
