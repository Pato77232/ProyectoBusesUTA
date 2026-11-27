import { createApiClient } from '../api/api-client.js';
import { createPendingController } from './pending-controller.js';
import { createPendingView } from './pending-view.js';
import { createDecisionController } from './decision-controller.js';

const view = createPendingView(document);
const client = createApiClient();
const controller = createPendingController({ client, view });
const decisions = createDecisionController({ client, view });
document.querySelector('#proofs').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  const card = button?.closest('article[data-proof-id]');
  if (!card) return;
  const id = card.dataset.proofId;
  if (button.dataset.action === 'approve')
    decisions.approve(id, {
      reviewed: card.querySelector('[data-role=reviewed]').checked,
    });
  else decisions.reject(id, card.querySelector('[data-role=justification]').value);
});
document.querySelector('#refresh').addEventListener('click', () => controller.load());
document.querySelector('#next').addEventListener('click', () => controller.load(true));
document.querySelector('#previous').addEventListener('click', () => controller.previous());
document.querySelector('#retry').addEventListener('click', () => controller.retry());
controller.load();
