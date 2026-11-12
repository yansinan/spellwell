/**
 * @layer ui
 * @phase P9
 * @doc §2.1 孩子端（学习模块）
 *
 * 练习设计：只保留孩子需要理解的两个选择——单元（多选）和复习/努力。
 * 题量由后台设置决定，前台不选。
 */

import { visibleUnitProgress } from './unitProgress.js';

function escape(value) {
  return String(value)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

export class PracticeSetupScreen {
  /**
   * @param {{
   *   root: HTMLElement,
   *   workspace: Awaited<ReturnType<typeof import('./bootstrap.js').createPracticeWorkspace>>,
   *   onStart: (result: any) => void
   * }} input
   */
  constructor({ root, workspace, onStart }) {
    this.root = root;
    this.workspace = workspace;
    this.onStart = onStart;
    const progress = visibleUnitProgress(workspace.units);
    const auto = workspace.autoSelection(workspace.settings.questionsPerPractice);
    this.visibleUnits = progress.visible;
    this.completedUnits = progress.completed;
    this.currentUnit = progress.current;
    this.selectedUnits = new Set(
      auto.selected.length > 0
        ? auto.selected.map((unit) => unit.id)
        : progress.current ? [progress.current.id] : progress.completed.map((unit) => unit.id),
    );
    this.mode = workspace.settings.defaultMode;
    this.loading = false;
    const selectedForTerm = this.selectedUnits.values().next().value;
    const currentTerm = workspace.terms.find((term) => term.units.some((unit) =>
      unit.id === (selectedForTerm ?? progress.current?.id),
    ));
    this.expandedTerms = new Set(currentTerm ? [currentTerm.id] : []);
  }

  mount() {
    this.render();
  }

  render(message = '') {
    const visibleIds = new Set(this.visibleUnits.map((unit) => unit.id));
    const terms = this.workspace.terms
      .map((term) => ({ ...term, units: term.units.filter((unit) => visibleIds.has(unit.id)) }))
      .filter((term) => term.units.length > 0);
    const units = this.visibleUnits;
    const available = units
      .filter((unit) => this.selectedUnits.has(unit.id))
      .reduce((sum, unit) => sum + unit.count, 0);
    const questions = Math.min(this.workspace.settings.questionsPerPractice, available);
    this.root.innerHTML = `
      <div class="sw-practice sw-setup">
        <header class="sw-practice__header">
          <span class="sw-brand">SpellWell</span>
          <div class="sw-practice__tools">
            <span class="sw-progress">${questions} questions</span>
          </div>
        </header>
        <main class="sw-practice__stage sw-setup__stage">
          <h1 class="sw-done__title">Ready to spell?</h1>

          <section class="sw-setup__section">
            <h2>年级 / 单元</h2>
            <div class="sw-setup__terms">
              ${terms.map((term) => {
                const selectedCount = term.units.filter((unit) => this.selectedUnits.has(unit.id)).length;
                const allSelected = term.units.length > 0 && selectedCount === term.units.length;
                return `
                  <details class="sw-setup__term" ${this.expandedTerms.has(term.id) ? 'open' : ''}>
                    <summary>
                      <label class="sw-setup__term-check" data-term-label>
                        <input type="checkbox" data-setup-term="${escape(term.id)}" ${allSelected ? 'checked' : ''} ${term.units.length === 0 ? 'disabled' : ''} />
                      </label>
                      <span>${escape(term.label)}</span>
                      <small>${term.units.length === 0 ? '暂无内容' : `${selectedCount}/${term.units.length} 单元`}</small>
                    </summary>
                    <div class="sw-setup__units">
                      ${term.units.map((unit) => {
                        const done = Boolean(unit.completed);
                        
                        return `
                        <label class="sw-setup__unit ${this.selectedUnits.has(unit.id) ? 'is-selected' : ''} ${done ? 'is-done' : 'is-current'}" style="--unit-progress:${unit.percent ?? 0}%">
                          <span class="sw-setup__unit-fill" aria-hidden="true"></span>
                          <input type="checkbox" data-setup-unit="${escape(unit.id)}" ${this.selectedUnits.has(unit.id) ? 'checked' : ''} />
                          <span>${escape(unit.label)}</span>
                          <small>${unit.percent ?? 0}% · ${unit.practiced ?? 0}/${unit.count}</small>
                        </label>
                      `;
                      }).join('')}
                    </div>
                  </details>
                `;
              }).join('')}
            </div>
          </section>

          <section class="sw-setup__section">
            <h2>Mode</h2>
            <div class="sw-setup__modes">
              <button type="button" class="sw-setup__mode ${this.mode === 'review' ? 'is-selected' : ''}" data-setup-mode="review">
                <strong>Review</strong>
              </button>
              <button type="button" class="sw-setup__mode ${this.mode === 'effort' ? 'is-selected' : ''}" data-setup-mode="effort">
                <strong>Effort</strong>
              </button>
            </div>
          </section>

          <button type="button" class="sw-check" data-setup-start ${this.selectedUnits.size === 0 || this.loading ? 'disabled' : ''}>
            ${this.loading ? 'Starting…' : 'Start practice'}
          </button>
          ${message ? `<p class="sw-setup__error">${escape(message)}</p>` : ''}
        </main>
      </div>
    `;

    for (const details of this.root.querySelectorAll('.sw-setup__term')) {
      const term = this.workspace.terms.find((item) => item.units.some((unit) => details.querySelector(`[data-setup-unit="${unit.id}"]`)));
      details.addEventListener('toggle', () => {
        if (!term) return;
        if (details.open) this.expandedTerms.add(term.id);
        else this.expandedTerms.delete(term.id);
      });
    }
    for (const input of this.root.querySelectorAll('[data-setup-term]')) {
      const term = this.workspace.terms.find((item) => item.id === input.dataset.setupTerm);
      if (term) {
        const selected = term.units.filter((unit) => this.selectedUnits.has(unit.id)).length;
        input.indeterminate = selected > 0 && selected < term.units.length;
      }
    }
    for (const label of this.root.querySelectorAll('[data-term-label]')) {
      label.addEventListener('click', (event) => event.stopPropagation());
    }
    for (const input of this.root.querySelectorAll('[data-setup-term]')) {
      input.addEventListener('change', () => {
        const term = this.workspace.terms.find((item) => item.id === input.dataset.setupTerm);
        if (!term) return;
        for (const unit of term.units) {
          if (input.checked) this.selectedUnits.add(unit.id);
          else this.selectedUnits.delete(unit.id);
        }
        this.render();
      });
    }
    for (const input of this.root.querySelectorAll('[data-setup-unit]')) {
      input.addEventListener('change', () => {
        if (input.checked) this.selectedUnits.add(input.dataset.setupUnit);
        else this.selectedUnits.delete(input.dataset.setupUnit);
        this.render();
      });
    }
    for (const button of this.root.querySelectorAll('[data-setup-mode]')) {
      button.addEventListener('click', () => {
        this.mode = button.dataset.setupMode;
        this.render();
      });
    }
    this.root.querySelector('[data-setup-start]')?.addEventListener('click', async () => {
      if (this.loading || this.selectedUnits.size === 0) return;
      this.loading = true;
      this.render();
      try {
        const result = await this.workspace.startPractice({
          units: [...this.selectedUnits],
          mode: this.mode,
        });
        this.onStart(result);
      } catch (error) {
        this.loading = false;
        this.render(String(error.message ?? error));
      }
    });
  }
}
