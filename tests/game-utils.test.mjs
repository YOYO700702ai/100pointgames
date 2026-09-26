import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQuestionCsv, fetchQuestionCsv, addInventoryItem, removeInventoryItem, createActionGate, validateCloudPlayer, canSavePlayer, getGameplayScene } from '../src/game-utils.mjs';

test('CSV preserves quoted line breaks, commas, escaped quotes, and UTF-8 BOM', () => {
    const source = '\uFEFF題目,答案,錯一,錯二,錯三\r\n"第一行\n第二行，含,逗號",正解,"他說""你好""",乙,丙\r\n';
    assert.deepEqual(parseQuestionCsv(source), [{ q: '第一行\n第二行，含,逗號', a: '正解', wrong: ['他說"你好"', '乙', '丙'] }]);
});

test('CSV skips blank or incomplete rows and deduplicates alternatives', () => {
    assert.deepEqual(parseQuestionCsv('Question,Answer\n,,,\n只有題目,\n,只有答案\n題,答,答,甲,甲\n'), [{ q: '題', a: '答', wrong: ['甲'] }]);
});

test('CSV refuses incomplete quoted fields instead of silently changing the answer', () => {
    assert.throws(() => parseQuestionCsv('"問題,答案'), /引號未成對/);
});

test('question fetch rejects HTTP errors even when their body resembles CSV', async () => {
    await assert.rejects(fetchQuestionCsv('fixture', { fetchImpl: async () => ({ ok: false, status: 403, text: async () => 'wrong,error' }) }), /HTTP 403/);
});

test('question fetch rejects an HTML login page and empty question bank', async () => {
    for (const body of ['<!DOCTYPE html><html>登入,請求</html>', '題目,答案\n,,,\n']) {
        await assert.rejects(fetchQuestionCsv('fixture', { fetchImpl: async () => ({ ok: true, text: async () => body }) }));
    }
});

test('question fetch times out and aborts a request that never responds', async () => {
    let signal;
    await assert.rejects(fetchQuestionCsv('fixture', {
        timeoutMs: 10,
        fetchImpl: (_, options) => { signal = options.signal; return new Promise(() => {}); }
    }), /逾時/);
    assert.equal(signal.aborted, true);
});

test('question fetch timeout also covers a stalled response body', async () => {
    await assert.rejects(fetchQuestionCsv('fixture', {
        timeoutMs: 10,
        fetchImpl: async () => ({ ok: true, text: () => new Promise(() => {}) })
    }), /逾時/);
});

test('question fetch decodes normal content without changing numeric strings', async () => {
    assert.deepEqual(await fetchQuestionCsv('fixture', { fetchImpl: async () => ({ ok: true, text: async () => '小數,0.20,0.2,2,20' }) }), [{ q: '小數', a: '0.20', wrong: ['0.2', '2', '20'] }]);
});

test('stacking items preserves prior snapshots and creates 99-item stacks', () => {
    const slot = Object.freeze({ id: 'potion_s', qty: 98 });
    const inventory = Object.freeze([slot]);
    const next = addInventoryItem(inventory, 'potion_s', 102);
    assert.deepEqual(next, [{ id: 'potion_s', qty: 99 }, { id: 'potion_s', qty: 99 }, { id: 'potion_s', qty: 2 }]);
    assert.equal(slot.qty, 98);
});

test('weapons remain individual slots and invalid quantities do not add items', () => {
    assert.deepEqual(addInventoryItem([], 'sword_wood', 2, false), [{ id: 'sword_wood', qty: 1 }, { id: 'sword_wood', qty: 1 }]);
    assert.deepEqual(addInventoryItem([], 'potion_s', -2), []);
});

test('removal spans stacks without mutating an existing save snapshot', () => {
    const inventory = Object.freeze([Object.freeze({ id: 'coin_gacha', qty: 1 }), Object.freeze({ id: 'potion_s', qty: 3 }), Object.freeze({ id: 'coin_gacha', qty: 3 })]);
    assert.deepEqual(removeInventoryItem(inventory, 'coin_gacha', 3), [{ id: 'potion_s', qty: 3 }, { id: 'coin_gacha', qty: 1 }]);
    assert.equal(inventory[2].qty, 3);
});

test('rapid synchronous clicks acquire a gate once until the next question', () => {
    const gate = createActionGate();
    let rewards = 0;
    for (let click = 0; click < 20; click++) if (gate.acquire()) rewards++;
    assert.equal(rewards, 1);
    gate.release();
    assert.equal(gate.acquire(), true);
    assert.equal(gate.acquire(), false);
});

const cloudPlayer = { name: '勇者', accountId: 'abc123', level: 3, exp: 8, gold: 100, hp: 5, inventory: [{ id: 'exam_zero', qty: 1 }], equipped: { weapon: null, pet: null } };

test('loading retains the existing exact-name account rule', () => {
    assert.throws(() => validateCloudPlayer(cloudPlayer, '別人', 'abc123'), /ACCOUNT_NAME_MISMATCH/);
    assert.throws(() => validateCloudPlayer(cloudPlayer, '勇者', 'other123'), /帳號不一致/);
    assert.deepEqual(validateCloudPlayer(cloudPlayer, '勇者', 'abc123'), cloudPlayer);
});

test('corrupt cloud inventory is rejected rather than becoming a new character', () => {
    for (const inventory of [null, [{ id: 'potion_s', qty: -1 }], [{ id: 'potion_s', qty: '3' }]]) {
        assert.throws(() => validateCloudPlayer({ ...cloudPlayer, inventory }, '勇者', 'abc123'), /存檔格式不完整/);
    }
    assert.equal(cloudPlayer.level, 3);
});

test('cloud saves require a matching successfully loaded account session', () => {
    assert.equal(canSavePlayer(cloudPlayer, null), false);
    assert.equal(canSavePlayer({ ...cloudPlayer, accountId: '' }, { name: '勇者', accountId: '' }), false);
    assert.equal(canSavePlayer(cloudPlayer, { name: '別人', accountId: 'abc123' }), false);
    assert.equal(canSavePlayer(cloudPlayer, { name: '勇者', accountId: 'other123' }), false);
    assert.equal(canSavePlayer(cloudPlayer, { name: '勇者', accountId: 'abc123' }), true);
});

test('opening and closing the backpack preserves battle and memory activity lifetimes', () => {
    for (const activity of ['battle', 'minigame_memory']) {
        const transitions = [activity, 'equipment', activity, 'map'].map(scene => getGameplayScene(scene, activity));
        let activityExits = 0;
        for (let i = 1; i < transitions.length; i++) if (transitions[i - 1] === activity && transitions[i] !== activity) activityExits++;
        assert.deepEqual(transitions.slice(0, 3), [activity, activity, activity]);
        assert.equal(activityExits, 1, 'only returning to the map cancels unfinished activity timers');
    }
});
