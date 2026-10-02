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

// Only generated arithmetic uses numeric equivalence. CSV answers may intentionally
// distinguish spellings such as 0.20 and 0.2, so their comparison remains textual.
export function answersMatch(selected, answer, numeric = false) {
    if (String(selected) === String(answer)) return true;
    if (!numeric) return false;
    const value = input => {
        const text = String(input).trim();
        const fraction = /^(-?\d+)\s*\/\s*(-?\d+)$/.exec(text);
        if (fraction) return Number(fraction[2]) !== 0 ? Number(fraction[1]) / Number(fraction[2]) : NaN;
        return /^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) ? Number(text) : NaN;
    };
    const left = value(selected), right = value(answer);
    return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= Number.EPSILON * 8 * Math.max(1, Math.abs(left), Math.abs(right));
}

export function questionOptions(question) {
    const choices = [question.a];
    for (const wrong of question.wrong || []) {
        if (wrong !== '' && !choices.some(value => answersMatch(value, wrong, question.numericAnswer))) choices.push(wrong);
        if (choices.length === 4) break;
    }
    return choices;
}

export function makeGuestCheckpoint(player, hatchSlot = { eggId: null, progress: 0 }) {
    if (player.accountId) throw new Error('雲端角色不能寫入訪客存檔');
    return { version: 1, savedAt: new Date().toISOString(), player: { ...player, accountId: '' }, hatchSlot: { ...hatchSlot } };
}

export function parseGuestCheckpoint(raw, items) {
    if (!raw) return null;
    const data = JSON.parse(raw);
    const p = data?.player;
    if (data.version !== 1 || !p || typeof p.name !== 'string' || !p.name.trim() || p.name.length > 5 || p.accountId) throw new Error('訪客存檔格式不符');
    validateCloudPlayer(p, p.name, '');
    const knownItem = id => typeof id === 'string' && Object.hasOwn(items, id);
    if (p.inventory.some(slot => !knownItem(slot.id) || slot.qty > 99) ||
        ['weapon', 'pet'].some(type => p.equipped[type] !== null && (!knownItem(p.equipped[type]) || items[p.equipped[type]].type !== type)) ||
        !['level', 'exp', 'gold', 'hp', 'baseAtk', 'baseMaxHp', 'maxExp'].every(key => Number.isFinite(p[key]) && p[key] >= 0) || p.level < 1 ||
        !p.zoneClears || typeof p.zoneClears !== 'object' || Array.isArray(p.zoneClears)) throw new Error('訪客存檔內容不完整');
    const hatch = data.hatchSlot;
    if (!hatch || !Number.isFinite(hatch.progress) || hatch.progress < 0 || hatch.progress > 100 ||
        (hatch.eggId !== null && (!knownItem(hatch.eggId) || items[hatch.eggId].type !== 'egg'))) throw new Error('孵蛋存檔格式不符');
    return { ...data, player: { ...p, accountId: '' } };
}

// Storage can be unavailable in private browsing or an embedded reader. Preserve
// the running character and report the limitation instead of interrupting play.
export function readGuestCheckpoint(getStorage, key, items) {
    try { return { save: parseGuestCheckpoint(getStorage().getItem(key), items), error: '' }; }
    catch { return { save: null, error: '無法讀取本機訪客進度；原資料未被刪除。' }; }
}

export function writeGuestCheckpoint(getStorage, key, player, hatchSlot) {
    try {
        const save = makeGuestCheckpoint(player, hatchSlot);
        getStorage().setItem(key, JSON.stringify(save));
        return { save, error: '' };
    } catch { return { save: null, error: '瀏覽器未能保存訪客進度；關閉或重新整理後可能遺失。' }; }
}


export function generateMathQuestion(random = Math.random) {
                const isFraction = random() > 0.5; const ops = ['+', '-', '×', '÷']; const op = ops[Math.floor(random() * 4)];
                if (isFraction) {
                    let n1 = Math.floor(random() * 5) + 1; let d1 = Math.floor(random() * 5) + 2; let n2 = Math.floor(random() * 5) + 1; let d2 = Math.floor(random() * 5) + 2;
                    if(n1>=d1) d1=n1+1; if(n2>=d2) d2=n2+1;
                    let ansN, ansD;
                    if (op === '+') { ansN = n1*d2 + n2*d1; ansD = d1*d2; }
                    else if (op === '-') { let v1 = n1/d1; let v2 = n2/d2; if(v1 < v2) { let t1=n1; n1=n2; n2=t1; let t2=d1; d1=d2; d2=t2; } ansN = n1*d2 - n2*d1; ansD = d1*d2; }
                    else if (op === '×') { ansN = n1*n2; ansD = d1*d2; } else { ansN = n1*d2; ansD = d1*n2; }
                    const gcd = (a, b) => b ? gcd(b, a % b) : a; const common = gcd(ansN, ansD); ansN /= common; ansD /= common;
                    const qStr = `${n1}/${d1} ${op} ${n2}/${d2} = ?`; const aStr = `${ansN}/${ansD}`;
                    let wrongs = []; let _t1 = 0; while(wrongs.length < 3 && _t1++ < 50) { let wN = ansN + Math.floor(random()*5) - 2; let wD = ansD + Math.floor(random()*5) - 2; if(wN<=0) wN=1; if(wD<=0) wD=2; let wStr = `${wN}/${wD}`; if(!answersMatch(wStr, aStr, true) && !wrongs.some(value => answersMatch(wStr, value, true))) wrongs.push(wStr); } for(let k=1; wrongs.length < 3; k++) { const fb = `${ansN+k*ansD}/${ansD}`; if(!wrongs.some(value => answersMatch(fb, value, true))) wrongs.push(fb); }
                    return { q: qStr, a: aStr, wrong: wrongs, numericAnswer: true };
                } else {
                    let n1 = (Math.floor(random() * 50) + 1) / 10; let n2 = (Math.floor(random() * 50) + 1) / 10; let ans;
                    if (op === '+') ans = n1 + n2; else if (op === '-') { if(n1 < n2) { let t=n1; n1=n2; n2=t; } ans = n1 - n2; } else if (op === '×') ans = n1 * n2; else { n2 = Math.floor(random() * 5) + 1; n1 = n2 * (Math.floor(random() * 5) + 1); ans = n1 / n2; }
                    ans = Math.round(ans * 100) / 100; const qStr = `${n1} ${op} ${n2} = ?`;
                    let wrongs = []; let _t2 = 0; while(wrongs.length < 3 && _t2++ < 50) { let w = Math.round((ans + (random() > 0.5 ? 0.1 : -0.1) * (Math.floor(random()*5) + 1)) * 100) / 100; if(w !== ans && !wrongs.includes(w) && w >= 0) wrongs.push(w); } for(let k=1; wrongs.length < 3; k++) { const fb = Math.round((ans + k * 0.1) * 100) / 100; if(fb !== ans && !wrongs.includes(fb)) wrongs.push(fb); }
                    return { q: qStr, a: ans, wrong: wrongs, numericAnswer: true };
                }
            }
