// Pure helpers shared by the game and offline regression tests.
export function parseQuestionCsv(source) {
    const rows = [];
    let row = [], field = '', quoted = false;
    const text = String(source).replace(/^\uFEFF/, '');
    const finishField = () => { row.push(field.trim()); field = ''; };
    const finishRow = () => { finishField(); rows.push(row); row = []; };
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') {
            if (quoted && text[i + 1] === '"') { field += '"'; i++; }
            else quoted = !quoted;
        } else if (char === ',' && !quoted) finishField();
        else if ((char === '\n' || char === '\r') && !quoted) {
            finishRow();
            if (char === '\r' && text[i + 1] === '\n') i++;
        } else field += char;
    }
    if (quoted) throw new Error('題庫 CSV 的引號未成對');
    if (field || row.length) finishRow();
    const headers = new Set(['題目', 'question', 'a欄 (題目)']);
    return rows.filter(columns => columns.length >= 2 && columns[0] && columns[1] && !headers.has(columns[0].toLowerCase()))
        .map(([q, a, ...wrong]) => ({ q, a, wrong: [...new Set(wrong.slice(0, 3).filter(value => value && value !== a))] }));
}

export async function fetchQuestionCsv(url, { fetchImpl = globalThis.fetch, timeoutMs = 15000 } = {}) {
    const controller = new AbortController();
    let timer;
    const request = (async () => {
        const response = await fetchImpl(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`題庫連線失敗（HTTP ${response.status}）`);
        const text = await response.text();
        if (/^\s*(?:<!doctype\s+html|<html)\b/i.test(text)) throw new Error('題庫網址回傳網頁，請確認已發布 CSV');
        const questions = parseQuestionCsv(text);
        if (!questions.length) throw new Error('題庫沒有可用的題目與答案');
        return questions;
    })();
    try {
        return await Promise.race([request, new Promise((_, reject) => {
            timer = setTimeout(() => { controller.abort(); reject(new Error('題庫讀取逾時，請重試')); }, timeoutMs);
        })]);
    } finally { clearTimeout(timer); }
}

export function addInventoryItem(inventory, itemId, count = 1, stackable = true) {
    if (!Number.isInteger(count) || count <= 0) return inventory;
    const next = inventory.map(slot => ({ ...slot }));
    let remaining = count;
    if (stackable) {
        for (const slot of next) {
            if (slot.id !== itemId || slot.qty >= 99) continue;
            const amount = Math.min(99 - slot.qty, remaining);
            slot.qty += amount;
            remaining -= amount;
            if (!remaining) break;
        }
    }
    while (remaining > 0) {
        const amount = stackable ? Math.min(99, remaining) : 1;
        next.push({ id: itemId, qty: amount });
        remaining -= amount;
    }
    return next;
}

export function removeInventoryItem(inventory, itemId, count = 1) {
    if (!Number.isInteger(count) || count <= 0) return inventory;
    let remaining = count;
    return inventory.flatMap(slot => {
        if (slot.id !== itemId || remaining === 0) return [slot];
        const amount = Math.min(slot.qty, remaining);
        remaining -= amount;
        return slot.qty > amount ? [{ ...slot, qty: slot.qty - amount }] : [];
    });
}

// The lock changes synchronously, before React's next render.
export function createActionGate() {
    let locked = false;
    return {
        acquire() { if (locked) return false; locked = true; return true; },
        release() { locked = false; }
    };
}

export function validateCloudPlayer(data, requestedName, requestedAccountId) {
    if (!data || data.name !== requestedName) throw new Error('ACCOUNT_NAME_MISMATCH');
    if (data.accountId && data.accountId !== requestedAccountId) throw new Error('雲端存檔的帳號不一致');
    if (!Array.isArray(data.inventory) || !data.equipped || typeof data.equipped !== 'object' ||
        !['level', 'exp', 'gold', 'hp'].every(key => Number.isFinite(data[key])) ||
        data.inventory.some(slot => !slot || typeof slot.id !== 'string' || !Number.isInteger(slot.qty) || slot.qty < 1)) {
        throw new Error('雲端存檔格式不完整，已保留原存檔，請聯絡老師');
    }
    return { ...data, accountId: requestedAccountId };
}

export function canSavePlayer(player, session) {
    return Boolean(session && player.accountId && session.accountId === player.accountId && session.name === player.name);
}

// Equipment is an overlay on the current activity, not an abandoned game.
export function getGameplayScene(scene, previousScene) {
    return scene === 'equipment' ? previousScene : scene;
}
