const state = { batteries: [], editingId: null, sort: localStorage.getItem('sort') === 'charged' ? 'charged' : 'name' };
const $ = (selector) => document.querySelector(selector);
const api = async (url, options = {}) => {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error_message || data?.error || `Request failed (${response.status})`);
  return data;
};
let noticeTimer;
// An optional action ({ label, run }) adds a button to the banner; those notices stay up longer so there is time to use it.
function notice(message, error = false, action = null) {
  const el = $('#notice'); el.className = `notice${error ? ' error' : ''}`; el.replaceChildren(message);
  if (action) { const button = document.createElement('button'); button.type = 'button'; button.className = 'notice-action'; button.textContent = action.label; button.addEventListener('click', () => action.run(button)); el.append(button); }
  el.hidden = false; clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { el.hidden = true; }, action ? 10000 : 4000);
}
function lastCharged(battery) { return battery.last_tracked_time || battery.charged_time || battery.last_charged; }
function formatTime(value) { if (!value) return 'Never charged'; const date = new Date(value.replace(' ', 'T')); return Number.isNaN(date) ? value : `Last charged ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)}`; }
function byName(a, b) { return a.name.localeCompare(b.name); }
// Timestamps are 'YYYY-MM-DD HH:MM:SS', so a plain string compare is chronological.
// Oldest first, with never-charged batteries ahead of them: the shelf reads as a
// queue of what needs charging soonest.
function byLastCharged(a, b) { const x = lastCharged(a); const y = lastCharged(b); if (!x && !y) return byName(a, b); if (!x) return -1; if (!y) return 1; return x.localeCompare(y) || byName(a, b); }
function sortedForList() { return [...state.batteries].sort(state.sort === 'charged' ? byLastCharged : byName); }
function setSort(mode) { state.sort = mode; localStorage.setItem('sort', mode); render(); }
function render() {
  const list = $('#battery-list'); const manage = $('#manage-list'); list.replaceChildren(); manage.replaceChildren();
  document.querySelectorAll('.sort-button').forEach((button) => { const on = button.dataset.sort === state.sort; button.classList.toggle('active', on); button.setAttribute('aria-pressed', String(on)); });
  $('#sort-bar').hidden = !state.batteries.length;
  if (!state.batteries.length) { list.append($('#empty-state').content.cloneNode(true)); return; }
  for (const battery of sortedForList()) {
    const card = document.createElement('article'); card.className = 'battery card';
    const description = battery.description?.trim();
    card.innerHTML = `<div><h2>${escapeHtml(battery.name)}</h2>${description ? `<p class="description">${escapeHtml(description)}</p>` : ''}<p class="date">${escapeHtml(formatTime(lastCharged(battery)))}</p></div><button class="charge" data-charge="${battery.id}">Charged</button>`; list.append(card);
  }
  // The manage screen is for renaming and deleting, so it stays alphabetical regardless of the shelf's sort.
  for (const battery of [...state.batteries].sort(byName)) {
    const description = battery.description?.trim();
    const row = document.createElement('div'); row.className = 'manage-row card'; row.innerHTML = `<div class="manage-row-copy"><strong>${escapeHtml(battery.name)}</strong>${description ? `<p class="description">${escapeHtml(description)}</p>` : ''}</div><div class="row-actions"><button data-edit="${battery.id}">Edit</button><button class="delete" data-delete="${battery.id}">Delete</button></div>`; manage.append(row);
  }
}
function escapeHtml(value = '') { const el = document.createElement('span'); el.textContent = value; return el.innerHTML; }
async function load() { try { const details = await api('/api/batteries'); state.batteries = details.map(({ battery, last_tracked_time }) => ({ ...battery, last_tracked_time })); render(); } catch (error) { notice(error.message, true); } }
async function charge(id) { const button = document.querySelector(`[data-charge="${id}"]`); button.disabled = true; button.textContent = 'Saving…'; try { await api(`/api/batteries/${id}/charge`, { method: 'POST', body: JSON.stringify({ tracked_time: new Date().toISOString().slice(0, 19).replace('T', ' ') }) }); await load(); notice('Battery marked as charged.'); } catch (error) { notice(error.message, true); button.disabled = false; button.textContent = 'Charged'; } }
function edit(id) { const battery = state.batteries.find((item) => String(item.id) === String(id)); state.editingId = id; $('#battery-name').value = battery.name; $('#battery-description').value = battery.description || ''; $('#form-title').textContent = `Edit ${battery.name}`; $('#cancel-edit').hidden = false; $('#battery-name').focus(); }
function clearForm() { state.editingId = null; $('#battery-form').reset(); $('#form-title').textContent = 'Add a battery'; $('#cancel-edit').hidden = true; }
document.addEventListener('click', async (event) => { const target = event.target.closest('button'); if (!target) return; if (target.dataset.page) { const manage = target.dataset.page === 'manage'; $('#battery-page').hidden = manage; $('#manage-page').hidden = !manage; $('#page-title').textContent = manage ? 'Manage batteries' : 'Battery shelf'; $('#page-subtitle').textContent = manage ? 'Add, rename, or remove items.' : 'Keep the little things powered.'; document.querySelectorAll('.nav-button').forEach((button) => button.classList.toggle('active', button === target)); } if (target.dataset.sort) setSort(target.dataset.sort); if (target.dataset.charge) charge(target.dataset.charge); if (target.dataset.edit) edit(target.dataset.edit); if (target.dataset.delete && confirm('Delete this battery from Grocy?')) { try { await api(`/api/objects/batteries/${target.dataset.delete}`, { method: 'DELETE' }); await load(); notice('Battery deleted.'); } catch (error) { notice(error.message, true); } } });
$('#cancel-edit').addEventListener('click', clearForm);
$('#battery-form').addEventListener('submit', async (event) => { event.preventDefault(); const name = $('#battery-name').value.trim(); const description = $('#battery-description').value.trim(); if (!name) return; try { const id = state.editingId; const result = await api(id ? `/api/objects/batteries/${id}` : '/api/objects/batteries', { method: id ? 'PUT' : 'POST', body: JSON.stringify({ name, description }) }); clearForm(); await load(); if (id) notice('Battery updated.'); else showAdded(result?.created_object_id); } catch (error) { notice(error.message, true); } });
function showAdded(id) {
  if (!id) { notice('Battery added.'); return; }
  notice('Battery added.', false, { label: 'Charged now', run: async (button) => {
    button.disabled = true; button.textContent = 'Saving…';
    try { await api(`/api/batteries/${id}/charge`, { method: 'POST', body: JSON.stringify({ tracked_time: new Date().toISOString().slice(0, 19).replace('T', ' ') }) }); await load(); notice('Battery marked as charged.'); } catch (error) { notice(error.message, true); }
  } });
}
load();
