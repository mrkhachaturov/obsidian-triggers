import type { App } from 'obsidian';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { strings } from '../../src/i18n';
import { type ManageActions, ManageListModal, type ManageRow } from '../../src/ui/manageModal';

// These modal interactions do not access App services.
const app = {} as App;

function action(modal: ManageListModal, index: number, label: string): HTMLButtonElement {
  const row = modal.contentEl.querySelectorAll('.tr-manage-row').item(index);
  const button = Array.from(row.querySelectorAll('button')).find(
    (entry) => entry.getAttribute('aria-label') === label,
  );
  if (button === undefined) throw new Error(`Missing action: ${label}`);
  return button;
}

function fixture() {
  let rows: ManageRow[] = [
    { label: 'First', icon: 'file' },
    { label: 'Second', icon: 'folder' },
  ];
  const actions: ManageActions = {
    list: () => rows,
    move: vi.fn(async (from: number, to: number) => {
      const [entry] = rows.splice(from, 1);
      if (entry === undefined) throw new Error('Missing moved row');
      rows.splice(to, 0, entry);
    }),
    remove: vi.fn(async (index: number) => {
      rows.splice(index, 1);
    }),
    empty: 'No entries',
    buttons: [],
  };
  return {
    actions,
    replace: (next: ManageRow[]) => {
      rows = next;
    },
  };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('ManageListModal', () => {
  it('disables boundary moves and refreshes the displayed order after moving', async () => {
    const { actions } = fixture();
    const modal = new ManageListModal(app, 'Manage rules', actions);
    modal.open();
    expect(action(modal, 0, strings.manage.moveUp).disabled).toBe(true);
    expect(action(modal, 1, strings.manage.moveDown).disabled).toBe(true);
    action(modal, 0, strings.manage.moveUp).click();
    expect(actions.move).not.toHaveBeenCalled();
    action(modal, 1, strings.manage.moveUp).click();
    await Promise.resolve();
    expect(actions.move).toHaveBeenCalledExactlyOnceWith(1, 0);
    expect(
      Array.from(modal.contentEl.querySelectorAll('.tr-manage-label'), (row) => row.textContent),
    ).toEqual(['Second', 'First']);
  });

  it('deletes the selected row and renders the empty state after the last removal', async () => {
    const { actions } = fixture();
    const modal = new ManageListModal(app, 'Manage rules', actions);
    modal.open();
    action(modal, 1, strings.manage.delete).click();
    await Promise.resolve();
    expect(actions.remove).toHaveBeenNthCalledWith(1, 1);
    expect(modal.contentEl.querySelector('.tr-manage-label')?.textContent).toBe('First');
    action(modal, 0, strings.manage.delete).click();
    await Promise.resolve();
    expect(actions.remove).toHaveBeenNthCalledWith(2, 0);
    expect(modal.contentEl.querySelector('.tr-manage-empty')?.textContent).toBe('No entries');
    expect(modal.contentEl.querySelectorAll('.tr-manage-row')).toHaveLength(0);
  });

  it('trims nonempty renames and ignores a blank name', () => {
    const { actions } = fixture();
    const rename = vi.fn<(index: number, name: string) => Promise<void>>().mockResolvedValue();
    const modal = new ManageListModal(app, 'Manage rules', { ...actions, rename });
    modal.open();
    const input = modal.contentEl.querySelector('input');
    if (input === null) throw new Error('Missing rename input');
    input.value = '  New name  ';
    input.dispatchEvent(new Event('change'));
    expect(rename).toHaveBeenCalledExactlyOnceWith(0, 'New name');
    input.value = '   ';
    input.dispatchEvent(new Event('change'));
    expect(rename).toHaveBeenCalledTimes(1);
  });

  it('refreshes after a footer action completes and ignores its late completion after close', () => {
    const { actions, replace } = fixture();
    let finish: () => void = () => {
      throw new Error('Footer action has not run');
    };
    const modal = new ManageListModal(app, 'Manage rules', {
      ...actions,
      buttons: [
        {
          label: 'Add row',
          cta: true,
          onClick: (done) => {
            finish = done;
          },
        },
      ],
    });
    modal.open();
    modal.contentEl.querySelector<HTMLButtonElement>('.tr-manage-footer button')?.click();
    replace([{ label: 'Added', icon: 'file' }]);
    finish();
    expect(modal.contentEl.querySelector('.tr-manage-label')?.textContent).toBe('Added');
    modal.close();
    expect(() => finish()).not.toThrow();
    expect(modal.contentEl.childElementCount).toBe(0);
    expect(modal.modalEl.classList.contains('tr-manage-modal')).toBe(false);
    expect(actions.remove).not.toHaveBeenCalled();
    expect(actions.move).not.toHaveBeenCalled();
  });
});
