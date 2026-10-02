import test from 'node:test';
import assert from 'node:assert/strict';
import { answersMatch, generateMathQuestion, questionOptions, makeGuestCheckpoint, parseGuestCheckpoint, readGuestCheckpoint, writeGuestCheckpoint } from '../src/game-utils.mjs';

test('equivalent fractions count as correct only for arithmetic questions', () => {
    for (const [choice, answer] of [['2/2', '1/1'], ['4/2', '2/1'], ['3/3', '1/1'], ['0/5', '0/1'], ['1/2', '0.5']]) {
        assert.equal(answersMatch(choice, answer, true), true);
        assert.equal(answersMatch(choice, answer), false);
    }
    for (const choice of ['1/0', 'NaN', 'Infinity', '0.5001', 'two', '']) assert.equal(answersMatch(choice, '1/2', true), false);
});

test('20,000 generated arithmetic questions have one correct value and three distinct wrong values', () => {
    let seed = 20261003;
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const number = value => value.includes('/') ? value.split('/').map(Number).reduce((n, d) => n / d) : Number(value);
    let fractionCount = 0;
    for (let i = 0; i < 20000; i++) {
        const q = generateMathQuestion(random);
        const [, left, op, right] = /^(.+) ([+\-×÷]) (.+) = \?$/.exec(q.q);
        const a = number(left), b = number(right);
        const expected = op === '+' ? a + b : op === '-' ? a - b : op === '×' ? a * b : a / b;
        assert.ok(Math.abs(number(String(q.a)) - expected) < 1e-10, q.q);
        if (String(q.a).includes('/')) fractionCount++;
        const options = questionOptions(q);
        assert.equal(options.length, 4, JSON.stringify(q));
        assert.equal(options.filter(value => Math.abs(number(String(value)) - expected) < 1e-10).length, 1, JSON.stringify(q));
        assert.equal(new Set(options.map(value => number(String(value)))).size, 4, JSON.stringify(q));
    }
    assert.ok(fractionCount > 9000);
});

test('CSV questions keep available alternatives without placeholders or invented answers', () => {
    assert.deepEqual(questionOptions({ a: '了解、知道', wrong: ['清楚、明確', '聰明、不糊塗'] }), ['了解、知道', '清楚、明確', '聰明、不糊塗']);
    assert.deepEqual(questionOptions({ a: '0.20', wrong: ['0.2', '2', '20'] }), ['0.20', '0.2', '2', '20']);
    assert.deepEqual(questionOptions({ a: '1/1', wrong: ['2/2', '3/3', '1/3'], numericAnswer: true }), ['1/1', '1/3']);
});

const items = { exam_zero: { type: 'weapon' }, potion_s: { type: 'consumable' }, egg_1: { type: 'egg' } };
const guest = {
    name: '勇者', accountId: '', level: 3, exp: 12, gold: 80, hp: 20, baseAtk: 8, baseMaxHp: 15, maxExp: 100,
    inventory: [{ id: 'potion_s', qty: 2 }], equipped: { weapon: 'exam_zero', pet: null },
    zoneClears: { west_desert: 1 }, tutorialDone: true, gameCleared: true
};
const hatch = { eggId: 'egg_1', progress: 50 };
const memoryStorage = () => {
    const data = new Map();
    return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};

test('guest checkpoint restores spent gold, equipment, achievements and incubating egg after a new session', () => {
    const storage = memoryStorage();
    const written = writeGuestCheckpoint(() => storage, 'game', guest, hatch);
    assert.equal(written.error, '');
    const restored = readGuestCheckpoint(() => storage, 'game', items);
    assert.deepEqual(restored.save.player, guest);
    assert.deepEqual(restored.save.hatchSlot, hatch);
    assert.equal(readGuestCheckpoint(() => storage, 'different-teacher', items).save, null);
});

test('cloud characters cannot overwrite a local guest checkpoint', () => {
    const storage = memoryStorage();
    writeGuestCheckpoint(() => storage, 'game', guest, hatch);
    const previous = storage.getItem('game');
    assert.ok(writeGuestCheckpoint(() => storage, 'game', { ...guest, accountId: 'abc123' }, hatch).error);
    assert.equal(storage.getItem('game'), previous);
});

test('blocked or full browser storage reports failure and keeps the running guest untouched', () => {
    const original = structuredClone(guest);
    const blocked = () => { throw new Error('SecurityError'); };
    assert.ok(readGuestCheckpoint(blocked, 'game', items).error);
    assert.ok(writeGuestCheckpoint(blocked, 'game', guest, hatch).error);
    const full = { setItem() { throw new Error('QuotaExceededError'); } };
    assert.ok(writeGuestCheckpoint(() => full, 'game', guest, hatch).error);
    assert.deepEqual(guest, original);
});

test('corrupt, unknown-item and future-version guest data is rejected without deleting it', () => {
    for (const change of [
        data => { data.version = 2; },
        data => { data.player.inventory[0].id = 'unknown'; },
        data => { data.player.equipped.weapon = 'potion_s'; },
        data => { data.player.gold = -1; },
        data => { data.hatchSlot.eggId = 'potion_s'; },
        data => { data.hatchSlot.progress = 101; }
    ]) {
        const data = structuredClone(makeGuestCheckpoint(guest, hatch));
        change(data);
        const raw = JSON.stringify(data);
        assert.throws(() => parseGuestCheckpoint(raw, items));
        const storage = memoryStorage(); storage.setItem('game', raw);
        assert.ok(readGuestCheckpoint(() => storage, 'game', items).error);
        assert.equal(storage.getItem('game'), raw);
    }
});
