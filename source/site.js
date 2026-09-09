/* Progressive enhancement only. No networking, tracking, or third-party code. */
'use strict';
document.addEventListener('DOMContentLoaded', () => {
  const wrap = document.querySelector('.filter-wrap');
  if (!wrap) return;
  const buttons = Array.from(wrap.querySelectorAll('[data-filter]'));
  const cards = Array.from(document.querySelectorAll('.catalogue [data-category]'));
  const count = document.getElementById('filter-count');
  if (!buttons.length || !cards.length || !count) return;
  const select = (chosen) => {
    let visible = 0;
    for (const card of cards) {
      card.hidden = chosen !== 'All' && card.dataset.category !== chosen;
      if (!card.hidden) visible += 1;
    }
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.filter === chosen));
    count.textContent = `${visible} ${visible === 1 ? 'entry' : 'entries'}${chosen === 'All' ? ' across the public record' : ` in ${chosen.toLowerCase()}`}`;
  };
  for (const button of buttons) button.addEventListener('click', () => select(button.dataset.filter));
  wrap.hidden = false;
  select('All');
});
