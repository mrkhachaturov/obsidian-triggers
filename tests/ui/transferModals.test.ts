import type { App } from 'obsidian';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { strings } from '../../src/i18n';
import { ExportRulesModal, ImportRulesModal } from '../../src/ui/transferModals';
import { write } from '../../src/utils/packageTransfer';
import { makeRule, makeView } from '../factories';

// Modal construction does not read the app; its DOM lifecycle is supplied by the shared stub.
const app = {} as App;

function button(root: HTMLElement, text: string): HTMLButtonElement {
  const found = Array.from(root.querySelectorAll('button')).find(
    (entry) => entry.textContent === text,
  );
  if (found === undefined) throw new Error(`Missing button: ${text}`);
  return found;
}

function paste(modal: ImportRulesModal, text: string) {
  const textarea = modal.contentEl.querySelector('textarea');
  if (textarea === null) throw new Error('Missing import text');
  textarea.value = text;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ImportRulesModal', () => {
  it.each([
    ['', ''],
    ['broken json', strings.library.notRules],
    [JSON.stringify({ schemaVersion: 99, views: [] }), strings.library.newer],
    [JSON.stringify({ views: [] }), strings.library.noneReadable],
  ])('refuses unusable input %s without closing or importing', (text, summary) => {
    const imported = vi.fn();
    const modal = new ImportRulesModal(app, [], imported);
    modal.open();
    paste(modal, text);
    expect(modal.contentEl.querySelector('.tr-transfer-status')?.textContent).toBe(summary);
    button(modal.contentEl, strings.library.import).click();
    expect(imported).not.toHaveBeenCalled();
    expect(modal.modalEl.isConnected).toBe(true);
    modal.close();
  });

  it('clears a previously valid analysis when the user replaces it with invalid JSON', () => {
    const imported = vi.fn();
    const modal = new ImportRulesModal(app, [], imported);
    modal.open();
    paste(modal, write([makeView('markdown')], '0.0.1'));
    paste(modal, '{');
    button(modal.contentEl, strings.library.import).click();
    expect(imported).not.toHaveBeenCalled();
  });

  it.each(['replace', 'merge', 'skip'])(
    'passes the analysed rules and %s conflict choice only on import',
    (conflict) => {
      const incoming = makeView('markdown', [makeRule({ name: 'Incoming rule' })]);
      const current = [makeView('markdown', [makeRule({ name: 'Existing rule' })])];
      const imported = vi.fn();
      const modal = new ImportRulesModal(app, current, imported);
      modal.open();
      paste(modal, JSON.stringify({ schemaVersion: 1, views: [incoming, null] }));
      expect(modal.contentEl.querySelector('.tr-transfer-status')?.textContent).toBe(
        [
          strings.library.found.replace('{count}', '1'),
          strings.library.alreadyHere.replace('{count}', '1'),
          strings.library.dropped.replace('{count}', '1'),
        ].join(' · '),
      );
      expect(imported).not.toHaveBeenCalled();
      const select = modal.contentEl.querySelector('select');
      if (select === null) throw new Error('Missing conflict selector');
      select.value = conflict;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      button(modal.contentEl, strings.library.import).click();
      expect(imported).toHaveBeenCalledExactlyOnceWith([incoming], conflict);
      expect(current[0]?.rules[0]?.name).toBe('Existing rule');
      expect(modal.modalEl.isConnected).toBe(false);
      expect(modal.contentEl.childElementCount).toBe(0);
    },
  );

  it('reads a selected JSON file and analyses it before allowing import', async () => {
    const incoming = [makeView('bases', [makeRule({ name: 'From file' })])];
    const imported = vi.fn();
    const modal = new ImportRulesModal(app, [], imported);
    modal.open();
    const picker = modal.contentEl.querySelector<HTMLInputElement>('input[type="file"]');
    if (picker === null) throw new Error('Missing file picker');
    const file = new File([write(incoming, '0.0.1')], 'rules.json', { type: 'application/json' });
    // jsdom has File but lacks Blob.text; preserve the browser File boundary.
    Object.defineProperty(file, 'text', { value: async () => write(incoming, '0.0.1') });
    Object.defineProperty(picker, 'files', { value: [file] });
    picker.dispatchEvent(new Event('change'));
    await Promise.resolve();
    expect(modal.contentEl.querySelector('.tr-transfer-status')?.textContent).toBe(
      strings.library.found.replace('{count}', '1'),
    );
    expect(imported).not.toHaveBeenCalled();
    button(modal.contentEl, strings.library.import).click();
    expect(imported).toHaveBeenCalledExactlyOnceWith(incoming, 'replace');
  });

  it('cancels a populated import without calling the mutation callback', () => {
    const imported = vi.fn();
    const modal = new ImportRulesModal(app, [], imported);
    modal.open();
    paste(modal, write([makeView('bases')], '0.0.1'));
    modal.close();
    expect(imported).not.toHaveBeenCalled();
    expect(modal.contentEl.childElementCount).toBe(0);
  });
});

describe('ExportRulesModal', () => {
  it('downloads the actual JSON bytes and releases its temporary link and object URL', async () => {
    const text = write([makeView('bases', [makeRule({ name: 'Экспорт' })])], '0.0.1');
    const createObjectURL = vi.fn<(blob: Blob) => string>().mockReturnValue('blob:rules-download');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    vi.stubGlobal('activeDocument', document);
    let download = '';
    let href = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      download = this.download;
      href = this.href;
    });
    const modal = new ExportRulesModal(app, text);
    modal.open();
    button(modal.contentEl, strings.library.save).click();
    const blob = createObjectURL.mock.calls[0]?.[0];
    if (blob === undefined) throw new Error('No download payload');
    expect(blob.type).toBe('application/json;charset=utf-8');
    const content = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Not text'));
      reader.onerror = () => reject(reader.error ?? new Error('Could not read download payload'));
      reader.readAsText(blob);
    });
    expect(content).toBe(text);
    expect(download).toMatch(/^triggers-rules-.*\.json$/);
    expect(href).toBe('blob:rules-download');
    expect(document.querySelector('a')).toBeNull();
    expect(modal.modalEl.isConnected).toBe(false);
    await vi.waitFor(() =>
      expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:rules-download'),
    );
  });

  it('displays and copies the exact serialized package, preserving unicode and the final newline', async () => {
    const text = write(
      [makeView('markdown', [makeRule({ name: 'Заметка "A"\nстрока' })])],
      '0.0.1',
    );
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue();
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const modal = new ExportRulesModal(app, text);
    modal.open();
    const textarea = modal.contentEl.querySelector('textarea');
    expect(textarea?.value).toBe(text);
    expect(textarea?.readOnly).toBe(true);
    button(modal.contentEl, strings.library.copy).click();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledExactlyOnceWith(text);
    expect(modal.modalEl.isConnected).toBe(true);
    modal.close();
    expect(modal.contentEl.childElementCount).toBe(0);
  });
});
