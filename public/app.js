const state = { batteries: [], editingId: null };
const $ = (selector) => document.querySelector(selector);
const api = async (url, options = {}) => {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error_message || data?.error || `Request failed (${response.status})`);
  return data;
};
function notice(message, error = false) { const el = $('#notice'); el.textContent = message; el.className = `notice${error ? ' error' : ''}`; el.hidden = false; setTimeout(() => { el.hidden = true; }, 4000); }
function lastCharged(battery) { return battery.last_tracked_time || battery.charged_time || battery.last_charged; }
function formatTime(value) { if (!value) return 'Never charged'; const date = new Date(value.replace(' ', 'T')); return Number.isNaN(date) ? value : `Last charged ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)}`; }
function render() {
  const list = $('#battery-list'); const manage = $('#manage-list'); list.replaceChildren(); manage.replaceChildren();
  if (!state.batteries.length) { list.append($('#empty-state').content.cloneNode(true)); return; }
  for (const battery of state.batteries) {
    const card = document.createElement('article'); card.className = 'battery card';
    card.innerHTML = `<div><h2>${escapeHtml(battery.name)}</h2><p class="date">${escapeHtml(formatTime(lastCharged(battery)))}</p></div><button class="charge" data-charge="${battery.id}">Charged</button>`; list.append(card);
    const row = document.createElement('div'); row.className = 'manage-row card'; row.innerHTML = `<strong>${escapeHtml(battery.name)}</strong><div class="row-actions"><button data-edit="${battery.id}">Edit</button><button class="delete" data-delete="${battery.id}">Delete</button></div>`; manage.append(row);
  }
}
function escapeHtml(value = '') { const el = document.createElement('span'); el.textContent = value; return el.innerHTML; }
async function load() { try { state.batteries = await api('/api/objects/batteries'); state.batteries.sort((a, b) => a.name.localeCompare(b.name)); render(); } catch (error) { notice(error.message, true); } }
async function charge(id) { const button = document.querySelector(`[data-charge="${id}"]`); button.disabled = true; button.textContent = 'Saving…'; try { await api(`/api/batteries/${id}/charge`, { method: 'POST', body: JSON.stringify({ tracked_time: new Date().toISOString().slice(0, 19).replace('T', ' ') }) }); await load(); notice('Battery marked as charged.'); } catch (error) { notice(error.message, true); button.disabled = false; button.textContent = 'Charged'; } }
function edit(id) { const battery = state.batteries.find((item) => String(item.id) === String(id)); state.editingId = id; $('#battery-name').value = battery.name; $('#form-title').textContent = `Edit ${battery.name}`; $('#cancel-edit').hidden = false; $('#battery-name').focus(); }
function clearForm() { state.editingId = null; $('#battery-form').reset(); $('#form-title').textContent = 'Add a battery'; $('#cancel-edit').hidden = true; }
document.addEventListener('click', async (event) => { const target = event.target.closest('button'); if (!target) return; if (target.dataset.page) { const manage = target.dataset.page === 'manage'; $('#battery-page').hidden = manage; $('#manage-page').hidden = !manage; $('#page-title').textContent = manage ? 'Manage batteries' : 'Battery shelf'; $('#page-subtitle').textContent = manage ? 'Add, rename, or remove items.' : 'Keep the little things powered.'; document.querySelectorAll('.nav-button').forEach((button) => button.classList.toggle('active', button === target)); } if (target.dataset.charge) charge(target.dataset.charge); if (target.dataset.edit) edit(target.dataset.edit); if (target.dataset.delete && confirm('Delete this battery from Grocy?')) { try { await api(`/api/objects/batteries/${target.dataset.delete}`, { method: 'DELETE' }); await load(); notice('Battery deleted.'); } catch (error) { notice(error.message, true); } } });
$('#cancel-edit').addEventListener('click', clearForm);
$('#battery-form').addEventListener('submit', async (event) => { event.preventDefault(); const name = $('#battery-name').value.trim(); if (!name) return; try { const id = state.editingId; await api(id ? `/api/objects/batteries/${id}` : '/api/objects/batteries', { method: id ? 'PUT' : 'POST', body: JSON.stringify({ name }) }); clearForm(); await load(); notice(id ? 'Battery updated.' : 'Battery added.'); } catch (error) { notice(error.message, true); } });
load();
