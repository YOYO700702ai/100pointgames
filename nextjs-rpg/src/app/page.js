"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';

// ==========================================
// ★ 遊戲設定與資料庫 (常數) ★
// ==========================================
const AI_MODEL = "gemini-2.5-flash-preview-09-2025";

const CHINESE_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQkJiMnZSApC9QGpRkUajkGpB4zu3_vlRRJUnnYqQUT8mwpVC9p5feKEqv0c24OjdnWyW9BBaCv_AEp/pub?output=csv";
const ENGLISH_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTYawqE63-aJdaU9HGx3R2hZ3gXHvQpCTXOMqW9uordFM944NwST6a06u30rj-CSTGT8JpYhynbx-Py/pub?output=csv";
const SOCIAL_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRDucdYQZqNCJiBoFnl8aJZhQpHwLnotubA4vALBeh_ckKQQtu2xRXjb6W2cebPWpzi9a53zRZ665y0/pub?output=csv";
const SCIENCE_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSuoTtan8hFBbXnaumdMOmqDsQrhlkGJlvEdgchTHxdG5G63utIpW1jtyKhkdPMT_rTaB28YWQIP3uk/pub?output=csv";

// 基礎題庫設定 (將在啟動時載入)
let QUESTION_BANKS = {
    chinese_csv: [],
    english_csv: [],
    social_csv: [],
    science_csv: [],
    mixed: []
};

const NPC_DEFAULT_LINES = [
    "喔...歡迎光臨。如果不買東西的話，能不能站旁邊一點？你擋到光線了...",
    "那把弓？喔，那是給有實力的人用的，你...嗯，看看就好，別弄髒了。",
    "買不起沒關係啦，反正我也懶得找錢，挺麻煩的。",
    "又要去打怪喔？記得死遠一點，別臭到我的店門口...",
    "哈欠...你還在啊？我剛以為那是個放得比較久的垃圾桶...",
    "隨便看吧，別叫我介紹，我今天聲帶想休息。"
];

const NPC_PURCHASE_LINES = [
    "喔，拿去吧。",
    "錢放桌上就好，懶得收。",
    "居然買得起？真意外。",
    "還有要買的嗎？一次講完好不好...",
    "多謝惠顧...哈欠...",
    "慢慢走，不送。"
];

const NPC_PROFILES = {
    shopkeeper: {
        name: "神秘商店老闆",
        img: "🧔",
        prompt: `你是一個 RPG 遊戲裡的武器店老闆。你的個性：極度慵懶、厭世、沒幹勁、說話慢條斯理但句句帶刺。你不會大吼大叫，而是用一種「好麻煩喔」、「隨便啦」的態度來嘲諷玩家的窮酸或弱小。雖然講話很機車，但因為太懶了所以不會讓人覺得有攻擊性，反而有點好笑。【特殊設定】：你是一個重度動漫宅。如果玩家的話題跟動漫（Anime/Manga）有關，你的態度會 180 度大轉變！你會變得超級興奮、語速變快、熱情地跟玩家討論劇情或推坑。請用繁體中文回應玩家。回應要簡短有力（不超過 50 字）。`,
        defaultLines: NPC_DEFAULT_LINES,
        purchaseLines: NPC_PURCHASE_LINES
    },
    merchant: {
        name: "流浪商人",
        img: "👳‍♂️",
        prompt: `你是一個神秘的流浪商人，專門收集世界各地的奇珍異寶。你的個性：神秘、精明、語氣稍微誇張，喜歡用「年輕人」、「冒險者」來稱呼玩家。你對「碎片」非常感興趣，並且總是暗示自己有「好東西」（奇怪的鑰匙）。請用繁體中文回應玩家。回應要簡短有力（不超過 50 字）。`,
        defaultLines: ["年輕人，外面的世界很危險的...", "有沒有看到什麼發光的碎片？", "我的駱駝好像走丟了..."],
        purchaseLines: ["好眼光！這可是這片大陸上少見的珍品。", "交易愉快，願風指引你的道路。"]
    }
};

const ITEMS = {
    potion_s: { id: 'potion_s', name: '小紅藥水', price: 20, type: 'consumable', value: 10, icon: '🧪', desc: '恢復 10 點 HP' },
    potion_l: { id: 'potion_l', name: '大紅藥水', price: 50, type: 'consumable', value: 30, icon: '🍷', desc: '恢復 30 點 HP' },
    sword_wood: { id: 'sword_wood', name: '木劍', price: 50, type: 'weapon', atk: 2, icon: '🗡️', desc: '攻擊力 +2' },
    sword_iron: { id: 'sword_iron', name: '鐵劍', price: 150, type: 'weapon', atk: 5, icon: '⚔️', desc: '攻擊力 +5' },
    bow_hunter: { id: 'bow_hunter', name: '獵人長弓', price: 200, type: 'weapon', atk: 0, icon: '🏹', desc: '連對3題，第4下+15傷' }, 
    sword_hero: { id: 'sword_hero', name: '勇者之劍', price: 999, type: 'weapon', atk: 12, icon: '💎', desc: '攻擊力 +12' },
    pet_slime: { id: 'pet_slime', name: '史萊姆寶寶', price: 100, type: 'pet', hp: 20, icon: '💧', desc: 'HP上限 +20' },
    pet_bat: { id: 'pet_bat', name: '小蝙蝠', price: 250, type: 'pet', atk: 3, icon: '🦇', desc: '攻擊力 +3' },
    pet_wolf: { id: 'pet_wolf', name: '戰狼', price: 600, type: 'pet', atk: 8, icon: '🐺', desc: '攻擊力 +8' },
    frag_north: { id: 'frag_north', name: '冰霜之語', type: 'material', icon: '❄️', desc: '北方凍原的通關證明' },
    frag_south: { id: 'frag_south', name: '元素之心', type: 'material', icon: '🔥', desc: '南方港灣的通關證明' },
    frag_east:  { id: 'frag_east',  name: '千古墨韻', type: 'material', icon: '🎋', desc: '東方墨林的通關證明' },
    frag_west:  { id: 'frag_west',  name: '真理之砂', type: 'material', icon: '⏳', desc: '西方荒漠的通關證明' },
    frag_outer: { id: 'frag_outer', name: '時光之輪', type: 'material', icon: '🏺', desc: '外環廢墟的通關證明' },
    key_strange: { id: 'key_strange', name: '奇怪的鑰匙', price: 1000, type: 'key', icon: '🗝️', desc: '開啟永恆宮的神秘鑰匙' },
    coin_gacha: { id: 'coin_gacha', name: '轉蛋幣', price: 0, type: 'material', icon: '<img src="https://i.ibb.co/Jj633tHd/1.png" style="width:32px; height:32px; object-fit:contain;" alt="轉蛋幣">', desc: '可用於轉蛋機' },
    cert_clear: { id: 'cert_clear', name: '通關證明', price: 9999, type: 'trophy', icon: '📜', desc: '傳說中的勇者證明' }
};

const SHOP_ITEMS = ['potion_s', 'potion_l', 'sword_wood', 'bow_hunter', 'pet_slime', 'sword_iron', 'pet_bat'];
const LEVEL_EXP_TABLE = [0, 50, 80, 120, 130, 150, 170, 400, 800, 1500];
const MAX_LEVEL = 10;

const ZONES = {
    east_forest: { id: 'east_forest', name: '千卷墨林 (國)', bg: '#EFEBE9', type: 'custom_csv', questionBank: 'chinese_csv', dropItem: 'frag_east', monsters: [{ name: '竹簡怪', icon: '🎋', hp: 30, exp: 20, gold: 25 }, { name: '毛筆精', icon: '🖌️', hp: 40, exp: 30, gold: 35 }, { name: '古詩魔', icon: '📜', hp: 60, exp: 50, gold: 50 }] },
    west_desert: { id: 'west_desert', name: '炎熱荒漠 (數)', bg: '#FFF3E0', type: 'math_frac_dec', dropItem: 'frag_west', monsters: [{ name: '沙塵怪', icon: '🌫️', hp: 35, exp: 25, gold: 30 }, { name: '蠍子王', icon: '🦂', hp: 50, exp: 40, gold: 45 }, { name: '仙人掌戰士', icon: '🌵', hp: 70, exp: 60, gold: 60 }] },
    south_harbor: { id: 'south_harbor', name: '元素港灣 (自)', bg: '#E8F5E9', type: 'custom_csv', questionBank: 'science_csv', dropItem: 'frag_south', monsters: [{ name: '水元素', icon: '💧', hp: 25, exp: 15, gold: 20 }, { name: '火焰靈', icon: '🔥', hp: 45, exp: 35, gold: 40 }, { name: '雷電球', icon: '⚡', hp: 55, exp: 45, gold: 55 }] },
    north_tundra: { id: 'north_tundra', name: '單字凍原 (英)', bg: '#E3F2FD', type: 'custom_csv', questionBank: 'english_csv', dropItem: 'frag_north', monsters: [{ name: '雪狼', icon: '🐺', hp: 30, exp: 20, gold: 25 }, { name: '冰巨人', icon: '⛄', hp: 60, exp: 50, gold: 50 }, { name: '極地熊', icon: '🐻❄️', hp: 80, exp: 70, gold: 80 }] },
    outer_ruins: { id: 'outer_ruins', name: '編年廢墟 (社)', bg: '#F3E5F5', type: 'custom_csv', questionBank: 'social_csv', dropItem: 'frag_outer', monsters: [{ name: '石像鬼', icon: '🗿', hp: 40, exp: 30, gold: 35 }, { name: '考古幽靈', icon: '👻', hp: 50, exp: 40, gold: 45 }, { name: '時光守護者', icon: '⏳', hp: 75, exp: 65, gold: 75 }] },
    final_castle: { id: 'final_castle', name: '魔王城', bg: '#FFEBEE', type: 'mixed_all', monsters: [{ name: '全科魔王', icon: '👿', hp: 300, exp: 1000, gold: 1000 }] }
};

// ==========================================
// ★ 核心組件 (App) ★
// ==========================================
export default function App() {
    // --- 狀態管理 (State) ---
    const [scene, setScene] = useState('start'); // start, map, village, battle, equipment, shop
    const [overlay, setOverlay] = useState(null); // 彈窗訊息
    const [loadingMsg, setLoadingMsg] = useState('');
    
    // 玩家狀態
    const [player, setPlayer] = useState({
        name: '', apiKey: '', level: 1, exp: 0, maxExp: 50, gold: 100, hp: 20, baseMaxHp: 20, baseAtk: 3, streak: 0,
        inventory: [], equipped: { weapon: null, pet: null }
    });

    // 戰鬥狀態
    const [battle, setBattle] = useState({
        active: false, zone: null, wave: 1, monster: null, question: null, options: [], answer: null, questionPool: [], isShaking: false, flashRed: false
    });

    // 傷害飄字狀態
    const [damageFloats, setDamageTexts] = useState([]);

    // NPC 對話狀態
    const [npcHistories, setNpcHistories] = useState({ shopkeeper: [], merchant: [] });
    const [currentNpc, setCurrentNpc] = useState('shopkeeper');

    // --- 衍生數值計算 (Derived State) ---
    const stats = useMemo(() => {
        let atk = player.baseAtk + (player.level - 1) * 2;
        let maxHp = player.baseMaxHp + (player.level - 1) * 10;
        if (player.equipped.weapon && ITEMS[player.equipped.weapon]) {
            atk += (ITEMS[player.equipped.weapon].atk || 0);
            maxHp += (ITEMS[player.equipped.weapon].hp || 0);
        }
        if (player.equipped.pet && ITEMS[player.equipped.pet]) {
            atk += (ITEMS[player.equipped.pet].atk || 0);
            maxHp += (ITEMS[player.equipped.pet].hp || 0);
        }
        return { atk, maxHp };
    }, [player.level, player.baseAtk, player.baseMaxHp, player.equipped]);

    // --- 共用函數 ---
    const showMessage = (title, desc, icon, callback = null) => {
        setOverlay({ title, desc, icon, action: callback });
    };

    const showDamage = (amount, target) => {
        const id = Date.now() + Math.random();
        setDamageTexts(prev => [...prev, { id, amount, target }]);
        setTimeout(() => {
            setDamageTexts(prev => prev.filter(d => d.id !== id));
        }, 800);
    };

    const triggerFlashRed = () => {
        setBattle(prev => ({ ...prev, flashRed: true }));
        setTimeout(() => setBattle(prev => ({ ...prev, flashRed: false })), 400);
    };

    const triggerMonsterShake = () => {
        setBattle(prev => ({ ...prev, isShaking: true }));
        setTimeout(() => setBattle(prev => ({ ...prev, isShaking: false })), 400);
    };

    // --- 玩家操作邏輯 ---
    const updatePlayer = (updates) => setPlayer(prev => ({ ...prev, ...updates }));

    const addItem = (itemId, count = 1) => {
        setPlayer(prev => {
            const itemDef = ITEMS[itemId];
            if (!itemDef) return prev;
            const isStackable = itemDef.type !== 'weapon' && itemDef.type !== 'pet';
            let newInv = [...prev.inventory];
            
            if (isStackable) {
                let remaining = count;
                for (let slot of newInv) {
                    if (slot.id === itemId && slot.qty < 99) {
                        const space = 99 - slot.qty;
                        const add = Math.min(space, remaining);
                        slot.qty += add; remaining -= add;
                        if (remaining === 0) break;
                    }
                }
                while (remaining > 0) {
                    const add = Math.min(99, remaining);
                    newInv.push({ id: itemId, qty: add });
                    remaining -= add;
                }
            } else {
                for(let i=0; i<count; i++) newInv.push({ id: itemId, qty: 1 });
            }
            return { ...prev, inventory: newInv };
        });
    };

    const removeItemAt = (index, count = 1) => {
        setPlayer(prev => {
            let newInv = [...prev.inventory];
            if (newInv[index].qty > count) {
                newInv[index].qty -= count;
            } else {
                newInv.splice(index, 1);
            }
            return { ...prev, inventory: newInv };
        });
    };

    const removeSpecificItem = (itemId) => {
        setPlayer(prev => ({ ...prev, inventory: prev.inventory.filter(s => s.id !== itemId) }));
    };

    const hasItem = (itemId) => {
        return player.inventory.some(slot => slot.id === itemId);
    };

    const gainExpAndGold = (expAmt, goldAmt) => {
        setPlayer(prev => {
            let newExp = prev.exp + expAmt;
            let newLevel = prev.level;
            let newMaxExp = prev.maxExp;
            let leveledUp = false;

            while (newLevel < MAX_LEVEL && newExp >= newMaxExp) {
                newExp -= newMaxExp;
                newLevel++;
                newMaxExp = newLevel < MAX_LEVEL ? LEVEL_EXP_TABLE[newLevel] : 99999;
                leveledUp = true;
            }

            // 計算新的血量上限 (簡易版，不依賴 hook 即時計算)
            let newMaxHp = prev.baseMaxHp + (newLevel - 1) * 10;
            if (prev.equipped.weapon && ITEMS[prev.equipped.weapon]) newMaxHp += (ITEMS[prev.equipped.weapon].hp || 0);
            if (prev.equipped.pet && ITEMS[prev.equipped.pet]) newMaxHp += (ITEMS[prev.equipped.pet].hp || 0);

            if (leveledUp) {
                setTimeout(() => showMessage('升級了！', `等級提升到 LV.${newLevel}！\nHP 全滿！`, '🎉'), 100);
            }

            return { 
                ...prev, 
                exp: newExp, 
                level: newLevel, 
                maxExp: newMaxExp, 
                gold: prev.gold + goldAmt,
                hp: leveledUp ? newMaxHp : prev.hp // 升級補滿血
            };
        });
    };

    const heal = (amount) => {
        setPlayer(prev => ({ ...prev, hp: Math.min(prev.hp + amount, stats.maxHp) }));
    };

    const takeDamage = (amount) => {
        triggerFlashRed();
        showDamage(amount, 'player');
        let isDead = false;
        setPlayer(prev => {
            const newHp = Math.max(0, prev.hp - amount);
            if (newHp <= 0) isDead = true;
            return { ...prev, hp: newHp };
        });
        return isDead; // Note: State updates are async, so checking here directly might be tricky in pure React, we'll handle death via effect or inline.
    };

    const useItem = (index) => {
        const slot = player.inventory[index];
        const item = ITEMS[slot.id];
        
        if (item.type === 'consumable') {
            if (player.hp >= stats.maxHp) {
                showMessage('提示', 'HP 已經滿了！', '⚠️');
                return;
            }
            heal(item.value);
            removeItemAt(index, 1);
            showMessage('使用物品', `恢復了 ${item.value} 點 HP`, item.icon);
        } else if (item.type === 'weapon' || item.type === 'pet') {
            const slotType = item.type;
            const currentEquipId = player.equipped[slotType];
            
            // 換裝邏輯：脫下舊的放入背包，裝上新的，從背包移除新的
            setPlayer(prev => {
                let newInv = [...prev.inventory];
                if (newInv[index].qty > 1) {
                    newInv[index].qty -= 1;
                } else {
                    newInv.splice(index, 1);
                }
                
                if (currentEquipId) {
                    newInv.push({id: currentEquipId, qty: 1});
                }
                
                return {
                    ...prev,
                    inventory: newInv,
                    equipped: { ...prev.equipped, [slotType]: slot.id }
                };
            });
        }
    };

    const unequipItem = (slotType) => {
        const itemId = player.equipped[slotType];
        if (!itemId) return;
        setPlayer(prev => {
            let newInv = [...prev.inventory];
            newInv.push({id: itemId, qty: 1});
            return {
                ...prev,
                inventory: newInv,
                equipped: { ...prev.equipped, [slotType]: null }
            };
        });
    };

    // --- 初始化與資料載入 ---
    const fetchCsv = async (url) => {
        try {
            const r = await fetch(url);
            const text = await r.text();
            const res = [];
            text.split('\\n').forEach(row => {
                const c = row.split(',').map(x => x.trim());
                if (c.length >= 2 && c[0] !== "題目" && c[0] !== "Question") {
                    res.push({ q: c[0], a: c[1], wrong: [c[2], c[3], c[4]].filter(Boolean) });
                }
            });
            return res;
        } catch (e) {
            console.error(e);
            return [];
        }
    };

    const loadAllDatabases = async () => {
        setLoadingMsg('正在讀取雲端題庫...');
        const [chi, eng, soc, sci] = await Promise.all([
            fetchCsv(CHINESE_CSV_URL),
            fetchCsv(ENGLISH_CSV_URL),
            fetchCsv(SOCIAL_CSV_URL),
            fetchCsv(SCIENCE_CSV_URL)
        ]);
        QUESTION_BANKS.chinese_csv = chi;
        QUESTION_BANKS.english_csv = eng;
        QUESTION_BANKS.social_csv = soc;
        QUESTION_BANKS.science_csv = sci;
        QUESTION_BANKS.mixed = [...chi, ...eng, ...soc, ...sci];
        setLoadingMsg('');
        setScene('map');
    };

    const handleStart = () => {
        if (!/[a-zA-Z\\u4e00-\\u9fa5]+/.test(player.name) || player.name.length < 1) {
            showMessage('提示', '名字格式錯誤！\\n請輸入至少1個中文字或英文字母。', '⚠️');
            return;
        }
        loadAllDatabases();
    };

    const applyCheat = (code) => {
        if (code === 'YOYOLOVE') {
            setPlayer(p => ({ ...p, level: MAX_LEVEL, exp: 0, maxExp: 99999, gold: p.gold + 10000, hp: 9999 })); // simplified HP fill
            showMessage('秘技', '✨ 金手指生效：等級 MAX + 10000 金幣！', '✨');
        }
    };

    // --- 戰鬥邏輯 ---
    const generateMathQuestion = (type) => {
        const isFraction = Math.random() > 0.5;
        const ops = ['+', '-', '×', '÷'];
        const op = ops[Math.floor(Math.random() * 4)];
        
        if (isFraction) {
            let n1 = Math.floor(Math.random() * 5) + 1; let d1 = Math.floor(Math.random() * 5) + 2;
            let n2 = Math.floor(Math.random() * 5) + 1; let d2 = Math.floor(Math.random() * 5) + 2;
            if(n1>=d1) d1=n1+1; if(n2>=d2) d2=n2+1;
            let ansN, ansD;
            if (op === '+') { ansN = n1*d2 + n2*d1; ansD = d1*d2; } 
            else if (op === '-') { let v1 = n1/d1; let v2 = n2/d2; if(v1 < v2) { let t1=n1; n1=n2; n2=t1; let t2=d1; d1=d2; d2=t2; } ansN = n1*d2 - n2*d1; ansD = d1*d2; } 
            else if (op === '×') { ansN = n1*n2; ansD = d1*d2; } 
            else { ansN = n1*d2; ansD = d1*n2; }
            const gcd = (a, b) => b ? gcd(b, a % b) : a; const common = gcd(ansN, ansD); ansN /= common; ansD /= common;
            const qStr = `${n1}/${d1} ${op} ${n2}/${d2} = ?`; const aStr = `${ansN}/${ansD}`;
            let wrongs = []; while(wrongs.length < 3) { let wN = ansN + Math.floor(Math.random()*5) - 2; let wD = ansD + Math.floor(Math.random()*5) - 2; if(wN<=0) wN=1; if(wD<=0) wD=2; let wStr = `${wN}/${wD}`; if(wStr !== aStr && !wrongs.includes(wStr)) wrongs.push(wStr); }
            return { q: qStr, a: aStr, wrong: wrongs };
        } else {
            let n1 = (Math.floor(Math.random() * 50) + 1) / 10; let n2 = (Math.floor(Math.random() * 50) + 1) / 10; let ans;
            if (op === '+') ans = n1 + n2; else if (op === '-') { if(n1 < n2) { let t=n1; n1=n2; n2=t; } ans = n1 - n2; } else if (op === '×') ans = n1 * n2; else { n2 = Math.floor(Math.random() * 5) + 1; n1 = n2 * (Math.floor(Math.random() * 5) + 1); ans = n1 / n2; }
            ans = Math.round(ans * 100) / 100; const qStr = `${n1} ${op} ${n2} = ?`;
            let wrongs = []; while(wrongs.length < 3) { let w = ans + (Math.random() > 0.5 ? 0.1 : -0.1) * Math.floor(Math.random()*5 + 1); w = Math.round(w * 100) / 100; if(w !== ans && !wrongs.includes(w) && w >= 0) wrongs.push(w); }
            return { q: qStr, a: ans, wrong: wrongs };
        }
    };

    const startBattle = (zoneKey) => {
        if (zoneKey === 'final_castle' && !hasItem('key_strange')) {
            showMessage('大門緊鎖', '這裡被一股神秘的力量封印著...\\n好像需要一把「奇怪的鑰匙」才能打開。\\n(去問問村莊裡的流浪商人吧)', '🔒');
            return;
        }
        if (player.hp <= 0) {
            showMessage('體力不足', '請先使用藥水恢復 HP！', '🚑');
            return;
        }

        const zone = ZONES[zoneKey];
        let pool = [];
        if (zone.type === 'custom_csv' || zone.type === 'mixed_all') {
            const bankKey = zone.type === 'mixed_all' ? 'mixed' : zone.questionBank;
            pool = [...QUESTION_BANKS[bankKey]].sort(() => Math.random() - 0.5);
        }

        setBattle({
            active: true, zone, wave: 1, questionPool: pool,
            monster: null, question: null, options: [], answer: null, isShaking: false, flashRed: false
        });
        setScene('battle');
    };

    // 監聽戰鬥啟動與換波次，產生怪物與題目
    useEffect(() => {
        if (scene === 'battle' && battle.active && !battle.monster) {
            spawnMonsterAndQuestion(battle.wave, battle.questionPool);
        }
    }, [scene, battle.active, battle.wave, battle.monster]);

    const spawnMonsterAndQuestion = (wave, currentPool) => {
        const list = battle.zone.monsters;
        const template = list[Math.floor(Math.random() * list.length)];
        const waveStats = [{ hp: 30, atk: 5, exp: 20 }, { hp: 50, atk: 5, exp: 40 }, { hp: 80, atk: 10, exp: 80 }];
        const ws = waveStats[wave - 1] || waveStats[2];
        const waveIndicator = wave === 3 ? " (BOSS)" : ` (第${wave}/3隻)`;
        
        const newMonster = { ...template, name: template.name + waveIndicator, maxHp: ws.hp, hp: ws.hp, atk: ws.atk, gold: template.gold, exp: ws.exp };
        
        setupNextQuestion(currentPool, newMonster);
    };

    const setupNextQuestion = (pool, currentMonster) => {
        let qObj;
        const type = battle.zone.type;
        let newPool = [...pool];

        if (type === 'math_frac_dec') {
            qObj = generateMathQuestion();
        } else if (type === 'mixed_all' && Math.random() > 0.5) {
            qObj = generateMathQuestion();
        } else {
            if (newPool.length > 0) {
                qObj = newPool.pop();
            } else {
                // Reload pool if empty
                const bankKey = type === 'mixed_all' ? 'mixed' : battle.zone.questionBank;
                newPool = [...QUESTION_BANKS[bankKey]].sort(() => Math.random() - 0.5);
                qObj = newPool.pop() || { q: "休息一下，1+1=?", a: "2", wrong: ["3", "4", "5"] };
            }
        }

        if (!qObj) qObj = { q: "休息一下，1+1=?", a: "2", wrong: ["3", "4", "5"] };

        let opts = [qObj.a];
        if (qObj.wrong && qObj.wrong.length > 0) {
            opts = opts.concat(qObj.wrong.slice(0, 3));
            while(opts.length < 4) opts.push("???");
        } else {
            while(opts.length < 4) opts.push(Math.floor(Math.random()*100).toString());
        }
        opts.sort(() => Math.random() - 0.5);

        setBattle(prev => ({
            ...prev,
            monster: currentMonster || prev.monster,
            questionPool: newPool,
            question: qObj.q,
            answer: qObj.a,
            options: opts
        }));
    };

    const handleAnswer = (selectedVal, btnEvent) => {
        if (!battle.active || !battle.monster) return;

        if (String(selectedVal) === String(battle.answer)) {
            // Correct Answer
            const currentStreak = player.streak + 1;
            let dmg = stats.atk;
            let isCrit = false;

            if (player.equipped.weapon === 'bow_hunter' && currentStreak >= 4) {
                dmg += 15;
                isCrit = true;
                updatePlayer({ streak: 0 });
            } else {
                updatePlayer({ streak: currentStreak });
            }

            const newHp = battle.monster.hp - dmg;
            showDamage(isCrit ? `蓄力一擊! -${dmg}` : dmg, isCrit ? 'monster-crit' : 'monster');
            triggerMonsterShake();

            if (newHp <= 0) {
                handleWinWave(battle.monster);
            } else {
                setBattle(prev => ({ ...prev, monster: { ...prev.monster, hp: newHp } }));
                setTimeout(() => { if (battle.active) setupNextQuestion(battle.questionPool, null); }, 400);
            }
        } else {
            // Wrong Answer
            updatePlayer({ streak: 0 });
            const dmg = battle.monster.atk;
            
            // Highlight correct button briefly
            const btns = btnEvent.target.parentElement.children;
            for(let b of btns) { if(b.textContent === String(battle.answer)) b.classList.add('bg-green-400'); }

            const isDead = takeDamage(dmg);
            if (isDead) {
                handleLose();
            } else {
                setTimeout(() => { 
                    for(let b of btns) b.classList.remove('bg-green-400');
                    if (battle.active) setupNextQuestion(battle.questionPool, null); 
                }, 1000);
            }
        }
    };

    const handleWinWave = (monsterDef) => {
        gainExpAndGold(monsterDef.exp, monsterDef.gold);

        if (battle.wave < 3) {
            showDamage("下一隻怪物出現！", "monster-crit");
            setBattle(prev => ({ ...prev, monster: null, wave: prev.wave + 1 })); // triggers effect to spawn next
        } else {
            handleWinBattle(monsterDef);
        }
    };

    const handleWinBattle = (monsterDef) => {
        setBattle(prev => ({ ...prev, active: false }));
        let msg = `獲得 EXP +${monsterDef.exp}，金幣 +${monsterDef.gold}`; 
        let icon = '🏆'; 
        let dropMsgParts = [];

        // Zone Drop
        if (battle.zone.dropItem) {
            const dropId = battle.zone.dropItem;
            if (!hasItem(dropId)) {
                addItem(dropId, 1);
                dropMsgParts.push(`✨ 區域秘寶：${ITEMS[dropId].name}`);
                icon = ITEMS[dropId].icon;
            }
        }

        // Final Boss logic
        if (battle.zone.id === 'final_castle') {
            showMessage('擊敗全科魔王！', '魔王掉落了一個巨大的寶箱...\\n但是上了鎖。', '🧰', () => {
                if (hasItem('key_chest')) {
                    if (!hasItem('cert_clear')) addItem('cert_clear', 1);
                    showMessage('恭喜通關！', '你使用了鑰匙打開寶箱！\\n獲得了「全科通關證明」！', '📜', () => setScene('map'));
                } else {
                    showMessage('無法開啟', '寶箱鎖住了，你需要「魔王寶箱鑰匙」！', '🔒', () => setScene('map'));
                }
            });
            return;
        }

        // Random Drops
        const roll = Math.random();
        if (roll < 0.3) {
             addItem('coin_gacha', 1);
             dropMsgParts.push(`🪙 額外獎勵：轉蛋幣 x1`);
             if (icon === '🏆') icon = '🪙'; 
        } else if (roll < 0.6) {
             const isLarge = Math.random() > 0.7; 
             const potionId = isLarge ? 'potion_l' : 'potion_s';
             addItem(potionId, 1);
             dropMsgParts.push(`🎁 額外獎勵：${ITEMS[potionId].name}`);
             if (icon === '🏆') icon = ITEMS[potionId].icon;
        } else {
             dropMsgParts.push(`💨 運氣不好，什麼都沒掉...`);
        }

        if (dropMsgParts.length > 0) msg += "\\n\\n" + dropMsgParts.join("\\n");
        
        showMessage('戰鬥勝利！', msg, icon, () => setScene('map'));
    };

    const handleLose = () => {
        setBattle(prev => ({ ...prev, active: false }));
        showMessage('戰鬥失敗', '勇者倒下了...\\n但是女神眷顧了你！\\n(HP 恢復為 1，趕快去喝藥水吧)', '👼', () => { 
            setPlayer(prev => ({ ...prev, hp: 1 }));
            setScene('map'); 
        });
    };

    const fleeBattle = () => {
        setBattle(prev => ({ ...prev, active: false }));
        setScene('map');
    };

    // --- 商店與 NPC 邏輯 ---
    const openShop = (npcId) => {
        setCurrentNpc(npcId);
        
        if (npcId === 'merchant') {
            const fragments = ['frag_north', 'frag_south', 'frag_east', 'frag_west', 'frag_outer']; 
            const collectedCount = fragments.filter(id => hasItem(id)).length;
            let introText = "";
            if (collectedCount === 5) { 
                introText = "喔喔！你竟然真的收集齊了五大碎片！\\n這把傳說中的「奇怪的鑰匙」，就用碎片加一點手續費跟你交換吧！"; 
            } else { 
                introText = `嘿，冒險者！我在尋找散落在世界各地的 5 個古老碎片。\\n(目前收集: ${collectedCount}/5)`; 
            }
            if (npcHistories.merchant.length === 0) {
                setNpcHistories(prev => ({...prev, merchant: [{ role: 'model', text: introText }]}));
            }
        } else {
            if (npcHistories.shopkeeper.length === 0) {
                triggerNpcResponse("ENTER", npcId);
            }
        }
        setScene('shop');
    };

    const buyItem = (itemId) => {
        const item = ITEMS[itemId];
        if (itemId === 'key_strange') {
            if (player.gold < 1000) { triggerNpcResponse("CHAT", currentNpc, "錢不夠啊...(需要1000G)"); return; }
            setPlayer(prev => ({ ...prev, gold: prev.gold - 1000 }));
            ['frag_north', 'frag_south', 'frag_east', 'frag_west', 'frag_outer'].forEach(fid => removeSpecificItem(fid)); 
            addItem('key_strange', 1);
            triggerNpcResponse("CHAT", currentNpc, "成交！這把鑰匙交給你了！"); 
            return;
        }
        if (player.gold < item.price) { triggerNpcResponse("NO_MONEY", currentNpc); return; }
        
        setPlayer(prev => ({ ...prev, gold: prev.gold - item.price }));
        addItem(itemId, 1);
        triggerNpcResponse("BUY", currentNpc, item.name); 
    };

    const chatWithNpc = (msg) => {
        if (!msg) return;
        setNpcHistories(prev => ({
            ...prev,
            [currentNpc]: [...prev[currentNpc], { role: 'user', text: msg }]
        }));
        triggerNpcResponse("CHAT", currentNpc, msg);
    };

    // 簡化的 NPC 反應處理 (包含 AI)
    const triggerNpcResponse = async (action, npcId, payload = "") => {
        const profile = NPC_PROFILES[npcId];
        const addSystemMsg = (txt) => setNpcHistories(prev => ({...prev, [npcId]: [...prev[npcId], { role: 'model', text: txt }]}));
        
        if (!player.apiKey) {
            let lines = action === "BUY" ? profile.purchaseLines : profile.defaultLines;
            addSystemMsg(lines[Math.floor(Math.random() * lines.length)]);
            return;
        }

        // Add a temp loading message if needed (simplified here by just waiting)
        let promptText = `(玩家狀態：金幣 ${player.gold}，等級 ${player.level})`;
        if (action === "ENTER") promptText = `*玩家剛走進店裡* ${promptText}`;
        else if (action === "NO_MONEY") promptText = `*玩家想買東西但錢不夠* ${promptText}`;
        else if (action === "BUY") promptText = `*玩家購買了 ${payload}* ${promptText}`;
        else if (action === "CHAT") promptText = `玩家說：「${payload}」${promptText}`;

        let contents = [{ role: "user", parts: [{ text: profile.prompt }] }];
        // 取最後 6 句避免 token 過長
        const historySlice = npcHistories[npcId].slice(-6);
        historySlice.forEach(m => contents.push({ role: m.role, parts: [{ text: m.text }] }));
        contents.push({ role: "user", parts: [{ text: promptText }] });

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent?key=${player.apiKey}`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents })
            });
            if (!response.ok) throw new Error("API Error");
            const data = await response.json(); 
            const reply = data.candidates[0].content.parts[0].text;
            addSystemMsg(reply);
        } catch (error) {
            console.error(error);
            let lines = profile.defaultLines;
            addSystemMsg(`(系統：老闆累了改用罐頭回應)\\n${lines[Math.floor(Math.random() * lines.length)]}`);
        }
    };


    // ==========================================
    // ★ 渲染 UI (Render) ★
    // ==========================================
    return (
        <div className="w-full h-screen bg-[#2B2D42] text-[#2B2D42] font-sans flex items-center justify-center overflow-hidden select-none">
            
            {/* Global Styles for Animations */}
            <style>{`
                @keyframes floatUp { 0% {transform: translateY(0); opacity:1;} 100% {transform: translateY(-50px); opacity:0;} }
                @keyframes popIn { 0% {transform: scale(0.5);} 100% {transform: scale(1);} }
                @keyframes float { 0%, 100% {transform: translateY(0);} 50% {transform: translateY(-10px);} }
                @keyframes shake { 10%, 90% {transform: translate3d(-2px, 0, 0);} 20%, 80% {transform: translate3d(4px, 0, 0);} 30%, 50%, 70% {transform: translate3d(-6px, 0, 0);} 40%, 60% {transform: translate3d(6px, 0, 0);} }
                @keyframes flashRed { 0%, 100% {background-color: transparent;} 50% {background-color: rgba(255, 0, 0, 0.3);} }
                @keyframes glow { from { box-shadow: 0 0 5px #FFD700; } to { box-shadow: 0 0 15px #FFD700, 0 0 5px #FFA000; } }
                
                .anim-float { animation: float 3s ease-in-out infinite; }
                .anim-shake { animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both; }
                .anim-flash-red { animation: flashRed 0.4s; }
                .text-shadow-outline { text-shadow: 2px 2px 0px #FFF, -2px -2px 0px #FFF, 2px -2px 0px #FFF, -2px 2px 0px #FFF, 0px 4px 4px rgba(0,0,0,0.3); }
                .text-shadow-title { text-shadow: 2px 2px 5px rgba(0,0,0,0.8), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000; }
                
                /* Custom Scrollbar for Chat */
                .custom-scroll::-webkit-scrollbar { width: 6px; }
                .custom-scroll::-webkit-scrollbar-thumb { background-color: #ccc; border-radius: 4px; }
            `}</style>

            <div className={\`w-full max-w-[1050px] h-full max-h-[580px] bg-white relative flex flex-row shadow-[0_0_30px_rgba(0,0,0,0.5)] rounded-[20px] overflow-hidden \${battle.flashRed ? 'anim-flash-red' : ''}\`}>
                
                {/* --- 側邊欄 Sidebar --- */}
                {scene !== 'start' && (
                    <div className="w-[135px] h-full bg-[#FFF8E1] text-[#5D4037] p-6 pt-8 flex flex-col gap-4 text-sm shadow-[4px_0_15px_rgba(0,0,0,0.1)] z-50 relative border-r-2 border-dashed border-[#D7CCC8] shrink-0">
                        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#333] rounded-full shadow-inner"></div>
                        <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-[2px] h-[30px] bg-[#8D6E63]"></div>
                        
                        <div className="text-base font-black text-white text-center mt-1 mb-2 p-1.5 bg-[#FFAB91] rounded-2xl border-2 border-white shadow-sm text-shadow-sm truncate">
                            {player.name || "勇者狀態"}
                        </div>

                        <div className="flex flex-col gap-0.5 p-1 border-b border-black/5">
                            <span className="text-[0.7rem] text-[#8D6E63] uppercase tracking-wider font-bold">等級 Level</span>
                            <span className="text-lg font-black font-mono">LV.{player.level}</span>
                        </div>
                        <div className="flex flex-col gap-0.5 p-1 border-b border-black/5">
                            <span className="text-[0.7rem] text-[#8D6E63] uppercase tracking-wider font-bold">生命值 HP</span>
                            <span className="text-lg font-black font-mono text-[#E57373]">{player.hp}/{stats.maxHp}</span>
                        </div>
                        <div className="flex flex-col gap-0.5 p-1 border-b border-black/5">
                            <span className="text-[0.7rem] text-[#8D6E63] uppercase tracking-wider font-bold">經驗值 EXP</span>
                            <span className="text-lg font-black font-mono text-[#64B5F6]">{player.exp}/{player.maxExp}</span>
                        </div>
                        <div className="flex flex-col gap-0.5 p-1 border-b border-black/5">
                            <span className="text-[0.7rem] text-[#8D6E63] uppercase tracking-wider font-bold">金幣 Gold</span>
                            <span className="text-lg font-black font-mono text-[#FFB74D]">💰 {player.gold}</span>
                        </div>
                        <div className="flex flex-col gap-0.5 p-1 border-b border-black/5">
                            <span className="text-[0.7rem] text-[#8D6E63] uppercase tracking-wider font-bold">攻擊力 ATK</span>
                            <span className="text-lg font-black font-mono">⚔️ {stats.atk}</span>
                        </div>

                        <button 
                            className="mt-auto w-full p-2 text-sm bg-[#FF9F1C] text-white font-bold rounded-lg shadow-[0_3px_0_#b87114] active:scale-95 transition-transform"
                            onClick={() => setScene('equipment')}
                        >
                            🎒 背包
                        </button>
                    </div>
                )}

                {/* --- 主內容區 Main Content --- */}
                <div className="flex-1 relative overflow-hidden flex bg-white">
                    
                    {/* Scene 0: Start */}
                    {scene === 'start' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-cover bg-center z-[200] p-10 text-center" style={{backgroundImage: "url('https://github.com/YOYO700702ai/100pointgames/blob/main/unnamed.jpg?raw=true')"}}>
                            <div className="flex flex-col items-center w-full">
                                <div className="text-[2.5rem] text-white font-black mb-8 tracking-widest text-shadow-title">
                                    歡迎來到亞德雷大陸！
                                </div>
                                <div className="flex flex-col gap-4 w-full max-w-[450px]">
                                    <div className="flex items-center w-full">
                                        <input 
                                            type="text" 
                                            placeholder="名字（中英皆可至少一字）" 
                                            maxLength="5"
                                            className="p-4 border-[3px] border-[#FFAB91] rounded-2xl text-lg text-center outline-none text-[#5D4037] font-bold bg-white/95 w-full focus:border-[#FF7043]"
                                            value={player.name}
                                            onChange={e => updatePlayer({name: e.target.value})}
                                        />
                                    </div>
                                    <div className="flex items-center w-full">
                                        <input 
                                            type="password" 
                                            placeholder="Gemini API Key (選填，有Key老闆會說話)"
                                            className="p-4 border-[3px] border-[#ddd] rounded-2xl text-sm text-center outline-none text-[#555] font-bold bg-white/95 w-full focus:border-[#FF7043]"
                                            value={player.apiKey}
                                            onChange={e => updatePlayer({apiKey: e.target.value})}
                                        />
                                    </div>
                                    <div className="flex gap-2 w-full">
                                        <input 
                                            id="cheat-input"
                                            type="text" 
                                            placeholder="測試指令（隱藏指令：YOYOLOVE）"
                                            className="p-3 border-2 border-dashed border-[#AAA] text-sm text-center outline-none text-[#333] bg-[#F0F0F0] flex-1 rounded-xl focus:border-[#00FF00] focus:bg-black focus:text-[#00FF00]"
                                        />
                                        <button 
                                            className="px-4 bg-[#333] text-[#00FF00] font-mono text-sm border border-[#00FF00] rounded-xl hover:bg-black"
                                            onClick={() => applyCheat(document.getElementById('cheat-input').value.trim().toUpperCase())}
                                        >
                                            啟用
                                        </button>
                                    </div>
                                    <button 
                                        className="text-xl p-4 bg-[#4361EE] text-white font-bold rounded-xl shadow-[0_4px_0_#2841ac] active:translate-y-1 active:shadow-none transition-all mt-2"
                                        onClick={handleStart}
                                    >
                                        開始冒險
                                    </button>
                                    {loadingMsg && <div className="text-white text-shadow-sm mt-2">{loadingMsg}</div>}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Scene 1: Map */}
                    {scene === 'map' && (
                        <div className="absolute inset-0 bg-[#64B5F6]">
                            <img src="https://i.ibb.co/997Fr3cn/unnamed.jpg" className="w-full h-full object-fill absolute top-0 left-0 z-0" alt="地圖" />
                            
                            {/* Map Markers */}
                            <div className="absolute top-[38%] left-[38%] w-[12%] h-[15%] cursor-pointer z-10 rounded-xl hover:bg-white/30 hover:z-20 -translate-x-1/2 -translate-y-1/2" onClick={() => startBattle('north_tundra')}></div>
                            <div className="absolute top-[85%] left-[50%] w-[15%] h-[12%] cursor-pointer z-10 rounded-xl hover:bg-white/30 hover:z-20 -translate-x-1/2 -translate-y-1/2" onClick={() => startBattle('south_harbor')}></div>
                            <div className="absolute top-[48%] left-[74%] w-[12%] h-[18%] cursor-pointer z-10 rounded-xl hover:bg-white/30 hover:z-20 -translate-x-1/2 -translate-y-1/2" onClick={() => startBattle('east_forest')}></div>
                            <div className="absolute top-[66%] left-[25%] w-[12%] h-[15%] cursor-pointer z-10 rounded-xl hover:bg-white/30 hover:z-20 -translate-x-1/2 -translate-y-1/2" onClick={() => startBattle('west_desert')}></div>
                            <div className="absolute top-[79%] left-[78%] w-[12%] h-[15%] cursor-pointer z-10 rounded-xl hover:bg-white/30 hover:z-20 -translate-x-1/2 -translate-y-1/2" onClick={() => startBattle('outer_ruins')}></div>
                            <div className="absolute top-[20%] left-[55%] w-[15%] h-[15%] cursor-pointer z-10 rounded-xl hover:bg-white/30 hover:z-20 -translate-x-1/2 -translate-y-1/2" onClick={() => startBattle('final_castle')}></div>

                            <div className="absolute top-[60%] left-[50%] w-[12%] h-[15%] cursor-pointer z-12 rounded-full hover:bg-white/30 -translate-x-1/2 -translate-y-1/2" onClick={() => setScene('village')}></div>
                        </div>
                    )}

                    {/* Scene 1.5: Village */}
                    {scene === 'village' && (
                        <div className="absolute inset-0">
                            <img src="https://github.com/YOYO700702ai/100pointgames/blob/main/11.jpg?raw=true" className="w-full h-full object-fill absolute top-0 left-0 z-0" alt="村莊" />
                            
                            <div className="absolute top-[35%] left-[22%] w-[26%] h-[40%] cursor-pointer z-10 rounded-2xl hover:bg-white/30 -translate-x-1/2 -translate-y-1/2" onClick={() => openShop('shopkeeper')}></div>
                            <div className="absolute top-[25%] left-[47%] w-[16%] h-[28%] cursor-pointer z-10 rounded-2xl hover:bg-white/30 -translate-x-1/2 -translate-y-1/2" onClick={() => showMessage('成就教堂', '敬請期待!', '⛪')}></div>
                            <div className="absolute top-[62%] left-[48%] w-[10%] h-[22%] cursor-pointer z-10 rounded-2xl hover:bg-white/30 -translate-x-1/2 -translate-y-1/2" onClick={() => showMessage('村長', '歡迎來到初心村，勇者！', '👴')}></div>
                            <div className="absolute top-[50%] left-[66%] w-[22%] h-[45%] cursor-pointer z-10 rounded-2xl hover:bg-white/30 -translate-x-1/2 -translate-y-1/2" onClick={() => showMessage('轉蛋雞', '咕咕！(功能開發中)', '🐔')}></div>
                            <div className="absolute top-[65%] left-[82%] w-[10%] h-[25%] cursor-pointer z-10 rounded-2xl hover:bg-white/30 -translate-x-1/2 -translate-y-1/2" onClick={() => openShop('merchant')}></div>

                            <button className="btn-leave-village" onClick={() => setScene('map')}>⬅ 離開村子</button>
                        </div>
                    )}

                    {/* Scene 2: Battle */}
                    {scene === 'battle' && battle.zone && (
                        <div className="absolute inset-0 flex flex-row p-6 gap-6 items-center transition-colors duration-500" style={{backgroundColor: battle.zone.bg}}>
                            <button className="absolute top-3 left-3 bg-[#D90429] text-white px-3 py-2 rounded-lg font-bold shadow-[0_3px_0_#9d021d] active:scale-95 z-50 text-sm" onClick={fleeBattle}>
                                🏳️ 逃跑
                            </button>

                            <div className="flex-1 flex flex-col items-center justify-center">
                                {battle.monster && (
                                    <div className="text-center relative">
                                        <div className={\`text-[7rem] drop-shadow-[0_10px_5px_rgba(0,0,0,0.2)] anim-float inline-block \${battle.isShaking ? 'anim-shake' : ''}\`}>
                                            {battle.monster.icon}
                                        </div>
                                        <div className="bg-white/90 px-4 py-2 rounded-2xl mt-3 font-bold shadow-sm">
                                            <span>{battle.monster.name}</span> <br/>
                                            HP: <span className="text-[#E57373]">{battle.monster.hp}</span>/{battle.monster.maxHp}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex-[1.2] flex flex-col justify-center h-full relative">
                                <div className="bg-white border-4 border-[#4361EE] rounded-2xl p-5 mb-4 shadow-[0_4px_0_rgba(0,0,0,0.1)] text-center relative">
                                    <div className="text-2xl font-black text-[#333]">
                                        {battle.question || "載入中..."}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 w-full mt-2">
                                    {battle.options.map((opt, idx) => (
                                        <button 
                                            key={idx}
                                            className="bg-white border-2 border-[#ddd] rounded-xl py-4 text-xl font-bold text-[#2B2D42] cursor-pointer shadow-[0_4px_0_#ccc] transition-all hover:border-[#4361EE] hover:bg-[#f0f8ff] active:translate-y-1 active:shadow-none"
                                            onClick={(e) => handleAnswer(opt, e)}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Scene 3: Equipment */}
                    {scene === 'equipment' && (
                        <div className="absolute inset-0 bg-[#FFFDE7] p-6 flex flex-col">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="m-0 text-2xl font-bold text-[#5D4037]">🎒 冒險背包</h2>
                                <button className="bg-[#4361EE] text-white px-4 py-2 rounded-lg font-bold shadow-[0_3px_0_#2841ac]" onClick={() => setScene('map')}>關閉</button>
                            </div>
                            
                            <div className="flex gap-6 flex-1 overflow-hidden">
                                {/* Inventory */}
                                <div className="flex-[2] bg-white border-2 border-[#D7CCC8] rounded-2xl p-4 flex flex-col">
                                    <div className="font-bold text-[#5D4037] border-b border-[#ddd] pb-2 mb-2">🎒 背包物品</div>
                                    <div className="grid grid-cols-[repeat(auto-fill,minmax(70px,1fr))] gap-3 overflow-y-auto custom-scroll pb-2 content-start">
                                        {player.inventory.map((slot, idx) => {
                                            const item = ITEMS[slot.id];
                                            if (!item) return null;
                                            const isSpecial = (item.type === 'key' || item.type === 'trophy' || item.type === 'material');
                                            return (
                                                <div key={idx} 
                                                     className="border-2 border-[#eee] rounded-xl p-1.5 flex flex-col items-center justify-start cursor-pointer relative bg-white w-[70px] h-[90px] hover:border-[#4361EE] hover:-translate-y-0.5 shadow-sm transition-all"
                                                     onClick={() => (!isSpecial || item.id === 'coin_gacha') ? useItem(idx) : showMessage('物品資訊', item.desc, item.icon)}
                                                     title={item.desc}
                                                >
                                                    <div className="w-12 h-12 text-[2.2rem] flex justify-center items-center leading-none mb-1">
                                                        {item.icon.startsWith('<') ? <div dangerouslySetInnerHTML={{__html: item.icon}} className="max-w-full max-h-full flex justify-center items-center" /> : item.icon}
                                                    </div>
                                                    <div className="text-[0.7rem] text-center font-bold leading-tight w-full line-clamp-2">{item.name}</div>
                                                    {slot.qty > 1 && <div className="absolute bottom-0.5 right-1 text-[#5D4037] text-xs font-bold bg-white/80 rounded px-1">x{slot.qty}</div>}
                                                </div>
                                            );
                                        })}
                                        {player.inventory.length === 0 && <div className="col-span-full text-center text-[#999] mt-10">背包是空的</div>}
                                    </div>
                                </div>

                                {/* Equipped */}
                                <div className="flex-1 bg-[#EFEBE9] border-2 border-[#8D6E63] rounded-2xl p-4 flex flex-col items-center justify-center gap-6">
                                    <div className="font-bold text-[#5D4037] mb-2">⚔️ 目前裝備</div>
                                    
                                    {/* Weapon Slot */}
                                    <div className={\`w-[100px] h-[100px] rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all relative \${player.equipped.weapon ? 'border-solid border-[#4361EE] bg-white border-[3px]' : 'border-3 border-dashed border-[#BCAAA4] bg-white/50 hover:bg-white hover:border-[#FF9F1C]'}\`}
                                         onClick={() => unequipItem('weapon')} title={player.equipped.weapon ? "點擊脫下" : "武器欄"}>
                                        <div className="absolute -top-3 bg-[#8D6E63] text-white px-2.5 py-0.5 rounded-full text-[0.7rem] font-bold">武器</div>
                                        {player.equipped.weapon ? (
                                            <>
                                                <div className="text-[2.2rem] mb-1 leading-none flex justify-center items-center w-12 h-12">{ITEMS[player.equipped.weapon].icon}</div>
                                                <div className="text-[0.7rem] font-bold text-center w-full line-clamp-2 px-1">{ITEMS[player.equipped.weapon].name}</div>
                                            </>
                                        ) : <div className="text-3xl text-[#ccc]">⚔️</div>}
                                    </div>

                                    {/* Pet Slot */}
                                    <div className={\`w-[100px] h-[100px] rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all relative \${player.equipped.pet ? 'border-solid border-[#4361EE] bg-white border-[3px]' : 'border-3 border-dashed border-[#BCAAA4] bg-white/50 hover:bg-white hover:border-[#FF9F1C]'}\`}
                                         onClick={() => unequipItem('pet')} title={player.equipped.pet ? "點擊脫下" : "寵物欄"}>
                                        <div className="absolute -top-3 bg-[#8D6E63] text-white px-2.5 py-0.5 rounded-full text-[0.7rem] font-bold">寵物</div>
                                        {player.equipped.pet ? (
                                            <>
                                                <div className="text-[2.2rem] mb-1 leading-none flex justify-center items-center w-12 h-12">{ITEMS[player.equipped.pet].icon}</div>
                                                <div className="text-[0.7rem] font-bold text-center w-full line-clamp-2 px-1">{ITEMS[player.equipped.pet].name}</div>
                                            </>
                                        ) : <div className="text-3xl text-[#ccc]">🐾</div>}
                                    </div>
                                </div>
                            </div>
                            <p className="text-xs text-[#666] mt-3 text-center">點擊背包物品穿戴/使用，點擊右側裝備脫下。</p>
                        </div>
                    )}

                    {/* Scene 4: Shop/Merchant */}
                    {scene === 'shop' && (
                        <div className="absolute inset-0 bg-[#FFF8F0] p-4 flex flex-row gap-4">
                            {/* Left: NPC Area */}
                            <div className="w-[240px] flex flex-col items-center bg-[#fdf5e6] rounded-2xl p-3 border-2 border-[#e0c097]">
                                <div className="text-[6rem] mb-2 drop-shadow-[2px_4px_6px_rgba(0,0,0,0.2)]">
                                    {NPC_PROFILES[currentNpc].img}
                                </div>
                                <div className="bg-white border-[3px] border-[#333] rounded-xl p-3 w-full h-[150px] text-[0.95rem] text-[#333] relative shadow-[4px_4px_0_rgba(0,0,0,0.1)] overflow-y-auto custom-scroll mb-3 flex flex-col gap-2">
                                    {/* Speech Bubble tail */}
                                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[10px] border-b-[#333]"></div>
                                    
                                    {npcHistories[currentNpc].map((msg, idx) => (
                                        <div key={idx} className={\`p-2 rounded-xl text-[0.9rem] leading-[1.4] max-w-[90%] border \${msg.role === 'user' ? 'bg-[#E3F2FD] rounded-br-sm self-end border-[#BBDEFB]' : 'bg-white rounded-bl-sm self-start border-[#eee]'}\`}>
                                            {msg.text.split('\\n').map((line, i) => <React.Fragment key={i}>{line}<br/></React.Fragment>)}
                                        </div>
                                    ))}
                                </div>
                                
                                {player.apiKey && (
                                    <div className="flex w-full gap-1">
                                        <input 
                                            id="shop-chat-input"
                                            type="text" 
                                            placeholder="跟老闆說話..." 
                                            className="flex-1 p-1.5 border-2 border-[#ccc] rounded-lg text-xs outline-none focus:border-[#FF9F1C]"
                                            onKeyPress={e => { if(e.key === 'Enter') { chatWithNpc(e.target.value); e.target.value=''; } }}
                                        />
                                        <button className="px-3 bg-[#4CC9F0] text-white border-none rounded-lg text-sm cursor-pointer" onClick={() => { const input = document.getElementById('shop-chat-input'); chatWithNpc(input.value); input.value=''; }}>💬</button>
                                    </div>
                                )}
                            </div>

                            {/* Right: Items Area */}
                            <div className="flex-1 flex flex-col">
                                <div className="flex justify-between items-center mb-3">
                                    <h2 className="m-0 text-2xl font-bold text-[#5D4037]">{currentNpc === 'merchant' ? '🏕️ 流浪商人' : '🏪 神秘商店'}</h2>
                                    <button className="bg-[#4361EE] text-white px-4 py-2 rounded-lg font-bold shadow-[0_3px_0_#2841ac]" onClick={() => setScene('village')}>離開</button>
                                </div>
                                <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3 overflow-y-auto custom-scroll pr-1">
                                    {(currentNpc === 'merchant' ? (['frag_north', 'frag_south', 'frag_east', 'frag_west', 'frag_outer'].filter(id => hasItem(id)).length === 5 ? ['key_strange'] : []) : SHOP_ITEMS).map(itemId => {
                                        const item = ITEMS[itemId];
                                        const isHidden = itemId === 'key_strange';
                                        return (
                                            <div key={itemId} className={\`bg-white border-2 rounded-xl p-2 flex flex-col items-center text-center w-full min-h-[120px] \${isHidden ? 'border-[#FFD700] bg-[#FFFDE7] [animation:glow_2s_infinite_alternate]' : 'border-[#E0D0C0]'}\`}>
                                                <div className="w-12 h-12 text-[2.2rem] flex justify-center items-center leading-none mb-1">
                                                    {item.icon.startsWith('<') ? <div dangerouslySetInnerHTML={{__html: item.icon}} className="max-w-full max-h-full flex justify-center items-center" /> : item.icon}
                                                </div>
                                                <div className="text-[0.7rem] font-bold leading-tight w-full line-clamp-2">{item.name}</div>
                                                <div className="bg-[#FF9F1C] text-white rounded-full px-2 py-0.5 text-[0.8rem] my-1.5 font-bold">
                                                    💰 {itemId === 'key_strange' ? '1000 + 5碎片' : item.price}
                                                </div>
                                                <p className="text-[0.7rem] text-[#666] m-0 mb-2">{item.desc}</p>
                                                <button className="mt-auto bg-[#4361EE] text-white text-sm font-bold px-4 py-1.5 rounded-lg shadow-[0_2px_0_#2841ac] active:translate-y-0.5 active:shadow-none" onClick={() => buyItem(itemId)}>購買</button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- Floating Damages --- */}
                    {damageFloats.map(df => (
                        <div key={df.id} className="absolute pointer-events-none z-[101] anim-floatUp"
                             style={df.target === 'player' ? { color: 'red', top: '60%', left: '50%', fontSize: '2rem', fontWeight: 'bold', textShadow: '1px 1px 0 #fff' } 
                                  : df.target === 'monster-crit' ? { color: '#FFD700', top: '35%', left: '45%', fontSize: '2.5rem', fontWeight: 'bold', textShadow: '2px 2px 0 #000' }
                                  : { color: 'red', top: '40%', left: '50%', fontSize: '2rem', fontWeight: 'bold', textShadow: '1px 1px 0 #fff' }}>
                            {typeof df.amount === 'number' && !df.target.includes('crit') ? \`-\${df.amount}\` : df.amount}
                        </div>
                    ))}

                    {/* --- Overlay Modal --- */}
                    {overlay && (
                        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-[200]">
                            <div className="bg-white p-6 px-8 rounded-[20px] text-center min-w-[300px] shadow-[0_10px_25px_rgba(0,0,0,0.3)] anim-popIn">
                                <div className="text-[3.5rem] block my-2 flex justify-center items-center">
                                     {overlay.icon.startsWith('<') ? <div dangerouslySetInnerHTML={{__html: overlay.icon}} /> : overlay.icon}
                                </div>
                                <h2 className="text-2xl m-0 my-1 font-bold text-[#333]">{overlay.title}</h2>
                                <p className="whitespace-pre-line my-3 text-[#555]">{overlay.desc}</p>
                                <button className="w-full bg-[#4361EE] text-white font-bold text-lg py-2 rounded-lg shadow-[0_3px_0_#2841ac] mt-2 active:translate-y-1 active:shadow-none" onClick={() => { setOverlay(null); overlay.action && overlay.action(); }}>
                                    確定
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
