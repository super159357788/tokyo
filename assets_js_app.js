// Improved app script for TOKYO_TRIP
// - Replaces eval() with a safe math evaluator
// - resetData() clears only trip_* keys
// - Initializes on DOMContentLoaded and exposes functions to window
(function() {
    // --- SAFE MATH EVALUATOR (shunting-yard -> RPN -> eval) ---
    function isOperator(token) {
        return ['+', '-', '*', '/'].includes(token);
    }
    function precedence(op) {
        if (op === '+' || op === '-') return 1;
        if (op === '*' || op === '/') return 2;
        return 0;
    }

    function tokenize(expr) {
        // Remove spaces
        expr = expr.replace(/\s+/g, '');
        const tokens = [];
        let i = 0;
        while (i < expr.length) {
            const ch = expr[i];
            if (/[0-9.]/.test(ch)) {
                let num = ch;
                i++;
                while (i < expr.length && /[0-9.]/.test(expr[i])) {
                    num += expr[i++];
                }
                if (num.split('.').length > 2) throw new Error('Invalid number');
                tokens.push(num);
            } else if (isOperator(ch) || ch === '(' || ch === ')') {
                tokens.push(ch);
                i++;
            } else {
                // invalid character
                throw new Error('Invalid character in expression');
            }
        }
        return tokens;
    }

    function toRPN(tokens) {
        const output = [];
        const ops = [];
        tokens.forEach(token => {
            if (!isNaN(token)) {
                output.push(token);
            } else if (isOperator(token)) {
                while (ops.length && isOperator(ops[ops.length - 1]) &&
                       precedence(ops[ops.length - 1]) >= precedence(token)) {
                    output.push(ops.pop());
                }
                ops.push(token);
            } else if (token === '(') {
                ops.push(token);
            } else if (token === ')') {
                while (ops.length && ops[ops.length - 1] !== '(') {
                    output.push(ops.pop());
                }
                if (ops.length === 0) throw new Error('Mismatched parentheses');
                ops.pop(); // remove '('
            } else {
                throw new Error('Unknown token');
            }
        });
        while (ops.length) {
            const op = ops.pop();
            if (op === '(' || op === ')') throw new Error('Mismatched parentheses');
            output.push(op);
        }
        return output;
    }

    function evalRPN(rpn) {
        const stack = [];
        rpn.forEach(token => {
            if (!isNaN(token)) {
                stack.push(parseFloat(token));
            } else if (isOperator(token)) {
                if (stack.length < 2) throw new Error('Invalid expression');
                const b = stack.pop();
                const a = stack.pop();
                let res;
                switch (token) {
                    case '+': res = a + b; break;
                    case '-': res = a - b; break;
                    case '*': res = a * b; break;
                    case '/':
                        if (b === 0) throw new Error('Division by zero');
                        res = a / b; break;
                }
                stack.push(res);
            } else {
                throw new Error('Invalid RPN token');
            }
        });
        if (stack.length !== 1) throw new Error('Invalid expression');
        return stack[0];
    }

    function safeEvaluate(expr) {
        if (!/^[0-9+\-*/().\s]*$/.test(expr)) {
            throw new Error('Expression contains invalid characters');
        }
        const tokens = tokenize(expr);
        const rpn = toRPN(tokens);
        return evalRPN(rpn);
    }

    // --- DATA INITIALIZATION ---
    const defaultItinerary = [
        { date: '12/13 DAY1', content: ['台中高鐵→桃園機場', '星宇航空 15:00起飛', '19:00抵達成田機場', '前往東京市區住宿'] },
        { date: '12/14 DAY2', content: ['上野動物園', '東京藝術大學', '上野公園聖誕市集', '東京市區住宿'] },
        { date: '12/15 DAY3', content: ['東京新宿車站 11:00出發 (2號車 1C,1D)', '箱根湯本', '箱根湯本商店街', '元箱根港 (海盜船)', '桃源台→大湧谷→強羅公園', '箱根住宿(18:00晚餐)'] },
        { date: '12/16 DAY4', content: ['箱根住宿→雕刻之森美術館', '箱根湯本 15:13出發 (7號車 10A,10B)', '東京新宿車站', '明治聖誕市集', '東京市區住宿'] },
        { date: '12/17 DAY5', content: ['中野百老匯', '吉祥寺', '下北澤', '東京市區住宿'] },
        { date: '12/18 DAY6', content: ['築地市場', '東京鐵塔', '六本木', '東京市區住宿'] },
        { date: '12/19 DAY7', content: ['新宿→澀谷', '涉谷SKY', '東京市區住宿'] },
        { date: '12/20 DAY8', content: ['東京市區住宿', '前往成田機場', '星宇航空 15:40起飛', '18:45抵達桃園機場', '回台中'] }
    ];

    let appData = {
        itinerary: JSON.parse(localStorage.getItem('trip_itinerary')) || defaultItinerary,
        shop: JSON.parse(localStorage.getItem('trip_shop')) || [],
        expenses: JSON.parse(localStorage.getItem('trip_expenses')) || [],
        rate: parseFloat(localStorage.getItem('trip_rate')) || 0.22,
        checklist: JSON.parse(localStorage.getItem('trip_checklist')) || [
            {text: '護照', done: false}, {text: '日幣', done: false}, {text: '網卡/漫遊', done: false}
        ],
        memo: localStorage.getItem('trip_memo') || ''
    };

    // --- COMMON UTILS ---
    function saveToLS() {
        localStorage.setItem('trip_itinerary', JSON.stringify(appData.itinerary));
        localStorage.setItem('trip_shop', JSON.stringify(appData.shop));
        localStorage.setItem('trip_expenses', JSON.stringify(appData.expenses));
        localStorage.setItem('trip_checklist', JSON.stringify(appData.checklist));
        localStorage.setItem('trip_rate', appData.rate);
        localStorage.setItem('trip_memo', appData.memo);
    }

    function resetData() {
        if (confirm('確定要重置所有資料嗎？這將會刪除所有新增的紀錄。')) {
            // Remove only keys that belong to this app (trip_ prefix)
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('trip_')) localStorage.removeItem(key);
            });
            location.reload();
        }
    }

    // Image Compression (Max 600px width, 0.6 quality) to save Space
    function previewImage(input, previewId) {
        const file = input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                let width = img.width;
                let height = img.height;
                const MAX_WIDTH = 600;

                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                const previewDiv = document.getElementById(previewId);
                if (previewDiv) {
                    previewDiv.classList.remove('hidden');
                    const imgEl = previewDiv.querySelector('img');
                    if (imgEl) {
                        imgEl.src = dataUrl;
                        imgEl.alt = 'preview';
                    }
                }
                input.dataset.base64 = dataUrl; // Store in dataset
            }
            img.src = e.target.result;
        }
        reader.readAsDataURL(file);
    }

    // --- ITINERARY LOGIC ---
    function renderItinerary() {
        const container = document.getElementById('itinerary-container');
        if (!container) return;
        container.innerHTML = '';

        appData.itinerary.forEach((day, dayIndex) => {
            let itemsHtml = '';
            day.content.forEach((item, itemIndex) => {
                // Check for links keywords
                let extras = '';
                if(item.includes('餐廳') || item.includes('住宿') || item.includes('機場') || item.includes('車站') || item.includes('園') || item.includes('宮') || item.includes('寺')) {
                     extras += `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item)}" target="_blank" class="ml-2 text-xs border border-black px-1 hover:bg-black hover:text-white"><i class="fas fa-map-marker-alt"></i> MAP</a>`;
                }

                // Highlight Time/Numbers
                let displayItem = item.replace(/(\\d{1,2}:\\d{2})/g, '<span class="bg-black text-white px-1">$1</span>');

                itemsHtml += `
                    <div class="flex items-start mb-4 relative group">
                        <div class="w-4 h-4 bg-black absolute -left-[1.3rem] top-1 border-2 border-white"></div>
                        <div class="flex-1 bg-white border-2 border-black p-2 shadow-[2px_2px_0_0_rgba(0,0,0,1)]">
                            <p class="text-base">${displayItem} ${extras}</p>
                            <div class="mt-2 flex gap-2 justify-end opacity-50 group-hover:opacity-100 transition-opacity">
                                <button onclick="moveItineraryItem(${dayIndex}, ${itemIndex}, -1)" class="text-xs border border-black px-1">▲</button>
                                <button onclick="moveItineraryItem(${dayIndex}, ${itemIndex}, 1)" class="text-xs border border-black px-1">▼</button>
                                <button onclick="deleteItineraryItem(${dayIndex}, ${itemIndex})" class="text-xs border border-black px-1 text-red-600">×</button>
                            </div>
                        </div>
                    </div>
                `;
            });

            const dayHtml = `
                <div class="relative pl-6 pb-4">
                    <div class="timeline-line"></div>
                    <div class="mb-4">
                        <span class="text-xl font-bold bg-black text-white px-2 py-1 border-2 border-black inline-block relative z-10 shadow-[4px_4px_0_0_#ccc]">
                            ${day.date}
                        </span>
                        <button onclick="addItineraryItem(${dayIndex})" class="ml-2 text-xs border-2 border-black px-2 py-1 bg-white hover:bg-black hover:text-white">+ 新增</button>
                        <button onclick="deleteItineraryDay(${dayIndex})" class="ml-1 text-xs border-2 border-black px-2 py-1 bg-red-100 text-red-600">刪除整天</button>
                    </div>
                    ${itemsHtml}
                </div>
            `;
            container.innerHTML += dayHtml;
        });
    }

    function addItineraryDay() {
        const date = prompt("請輸入日期與標題 (例如: 12/21 DAY9)");
        if(date) {
            appData.itinerary.push({date: date, content: []});
            saveToLS();
            renderItinerary();
        }
    }

    function deleteItineraryDay(index) {
        if(confirm("確定刪除這整天的行程嗎？")) {
            appData.itinerary.splice(index, 1);
            saveToLS();
            renderItinerary();
        }
    }

    function addItineraryItem(dayIndex) {
        const text = prompt("輸入行程內容：");
        if(text) {
            appData.itinerary[dayIndex].content.push(text);
            saveToLS();
            renderItinerary();
        }
    }

    function deleteItineraryItem(dayIndex, itemIndex) {
        if(confirm("刪除此項目？")) {
            appData.itinerary[dayIndex].content.splice(itemIndex, 1);
            saveToLS();
            renderItinerary();
        }
    }

    function moveItineraryItem(dayIdx, itemIdx, direction) {
        const arr = appData.itinerary[dayIdx].content;
        const newIdx = itemIdx + direction;
        if (newIdx >= 0 && newIdx < arr.length) {
            [arr[itemIdx], arr[newIdx]] = [arr[newIdx], arr[itemIdx]];
            saveToLS();
            renderItinerary();
        }
    }

    // --- SHOPPING LOGIC ---
    function renderShop() {
        const list = document.getElementById('shop-list');
        if (!list) return;
        list.innerHTML = '';
        appData.shop.forEach((item, index) => {
            const imgHtml = item.img ? `<img src="${item.img}" class="w-20 h-20 object-cover border-2 border-black mr-3" alt="${item.name}">` : '';
            list.innerHTML += `
                <div class="pixel-box p-3 flex items-start">
                    ${imgHtml}
                    <div class="flex-1">
                        <div class="flex justify-between items-start">
                            <h3 class="font-bold text-lg">${item.name}</h3>
                            <button onclick="deleteShop(${index})" class="text-red-500 font-bold px-2">×</button>
                        </div>
                        <p class="text-sm text-gray-600"><span class="bg-black text-white text-xs px-1 mr-1">${item.type}</span> @ ${item.loc}</p>
                    </div>
                </div>
            `;
        });
    }

    function addShopItem() {
        const name = document.getElementById('shop-name').value;
        const type = document.getElementById('shop-type').value;
        const loc = document.getElementById('shop-loc').value;
        const imgInput = document.getElementById('shop-img');
        const img = imgInput ? (imgInput.dataset.base64 || '') : '';

        if(!name) return alert('請輸入名稱');

        appData.shop.push({ name, type: type || '未分類', loc: loc || '不限', img });
        saveToLS();
        renderShop();

        // Clear inputs
        document.getElementById('shop-name').value = '';
        document.getElementById('shop-type').value = '';
        document.getElementById('shop-loc').value = '';
        if (imgInput) {
            imgInput.value = '';
            delete imgInput.dataset.base64;
        }
        const preview = document.getElementById('shop-preview');
        if (preview) preview.classList.add('hidden');
    }

    function deleteShop(index) {
        if(confirm('刪除購買項目？')) {
            appData.shop.splice(index, 1);
            saveToLS();
            renderShop();
        }
    }

    // --- EXPENSE LOGIC ---
    function saveRate() {
        const el = document.getElementById('exchange-rate');
        if (!el) return;
        appData.rate = parseFloat(el.value);
        saveToLS();
        renderExpenses();
        calculate(); // Re-calc calc result
    }

    function calcAppend(val) {
        const input = document.getElementById('calc-input');
        if (input) input.value += val;
        // update preview
        updateCalcPreview();
    }

    function calculate() {
        const input = document.getElementById('calc-input');
        const resDisplay = document.getElementById('calc-result-twd');
        if (!input || !resDisplay) return;
        try {
            const raw = input.value;
            const result = safeEvaluate(raw.toString());
            if (result !== undefined) {
                // Normalize small floating point rounding
                const rounded = Math.round((result + Number.EPSILON) * 1000000) / 1000000;
                input.value = rounded;
                const twd = Math.round(rounded * appData.rate);
                resDisplay.innerText = `≈ NT$ ${twd}`;
            }
        } catch (e) {
            input.value = 'Error';
            resDisplay.innerText = '≈ NT$ 0';
        }
    }

    function updateCalcPreview() {
        const input = document.getElementById('calc-input');
        const resDisplay = document.getElementById('calc-result-twd');
        if (!input || !resDisplay) return;
        try {
            if(/^[0-9+\-*/().\s]*$/.test(input.value) && input.value.trim() !== '') {
                const result = safeEvaluate(input.value);
                if(!isNaN(result)) {
                    const rounded = Math.round((result + Number.EPSILON) * 1000000) / 1000000;
                    const twd = Math.round(rounded * appData.rate);
                    resDisplay.innerText = `≈ NT$ ${twd}`;
                    return;
                }
            }
        } catch (e) {
            // ignore errors while typing
        }
        // fallback
        resDisplay.innerText = `≈ NT$ 0`;
    }

    // --- Render & expense functions (same logic, kept) ---
    function renderExpenses() {
        const list = document.getElementById('expense-list');
        if (!list) return;
        list.innerHTML = '';
        let totalJPY = 0;
        let totalTWD = 0;

        // Sort by new -> old
        const sorted = [...appData.expenses].reverse();

        sorted.forEach((item, index) => {
            const realIndex = appData.expenses.length - 1 - index;
            const twd = Math.round(item.amt * appData.rate);
            totalJPY += parseInt(item.amt);
            totalTWD += twd;

            const imgHtml = item.img ? `<img src="${item.img}" class="w-12 h-12 object-cover border-2 border-black mr-2" alt="${item.name}">` : '';

            list.innerHTML += `
                <div class="bg-white border-2 border-black p-2 flex items-center shadow-[2px_2px_0_0_#000]">
                    ${imgHtml}
                    <div class="flex-1">
                        <div class="flex justify-between">
                            <span class="font-bold">${item.name}</span>
                            <button onclick="deleteExpense(${realIndex})" class="text-red-500 font-bold px-2">×</button>
                        </div>
                        <div class="flex justify-between text-sm mt-1">
                            <span class="text-gray-600">¥${item.amt}</span>
                            <span class="text-blue-800 font-bold">NT$${twd}</span>
                        </div>
                    </div>
                </div>
            `;
        });

        const elTotalJPY = document.getElementById('total-jpy');
        const elTotalTWD = document.getElementById('total-twd');
        if (elTotalJPY) elTotalJPY.innerText = `¥${totalJPY}`;
        if (elTotalTWD) elTotalTWD.innerText = `NT$${totalTWD}`;
        const rateEl = document.getElementById('exchange-rate');
        if (rateEl) rateEl.value = appData.rate;
    }

    function addExpense() {
        const nameEl = document.getElementById('expense-name');
        const amtEl = document.getElementById('expense-amt');
        const imgInput = document.getElementById('expense-img');
        if (!nameEl || !amtEl) return;
        const name = nameEl.value;
        const amt = amtEl.value;
        const img = imgInput ? (imgInput.dataset.base64 || '') : '';

        if(!name || !amt) return alert('請輸入項目與金額');

        appData.expenses.push({ name, amt, img, date: new Date().toISOString() });
        saveToLS();
        renderExpenses();

        // Clear
        nameEl.value = '';
        amtEl.value = '';
        if (imgInput) {
            imgInput.value = '';
            delete imgInput.dataset.base64;
        }
        const preview = document.getElementById('expense-preview');
        if (preview) preview.classList.add('hidden');
    }

    function deleteExpense(index) {
        if(confirm('刪除此筆記帳？')) {
            appData.expenses.splice(index, 1);
            saveToLS();
            renderExpenses();
        }
    }

    // --- CHECKLIST & MEMO ---
    function renderChecklist() {
        const list = document.getElementById('check-list');
        if (!list) return;
        list.innerHTML = '';
        appData.checklist.forEach((item, index) => {
            list.innerHTML += `
                <li class="flex items-center bg-white border-2 border-black p-2 shadow-[2px_2px_0_0_#000]">
                    <input type="checkbox" ${item.done ? 'checked' : ''} onchange="toggleCheck(${index})" class="w-5 h-5 accent-black mr-3">
                    <span class="flex-1 ${item.done ? 'line-through text-gray-400' : ''}">${item.text}</span>
                    <button onclick="deleteCheck(${index})" class="text-red-500 font-bold ml-2">×</button>
                </li>
            `;
        });
    }

    function addCheckItem() {
        const input = document.getElementById('check-input');
        if(input && input.value) {
            appData.checklist.push({text: input.value, done: false});
            input.value = '';
            saveToLS();
            renderChecklist();
        }
    }

    function toggleCheck(index) {
        appData.checklist[index].done = !appData.checklist[index].done;
        saveToLS();
        renderChecklist();
    }

    function deleteCheck(index) {
        appData.checklist.splice(index, 1);
        saveToLS();
        renderChecklist();
    }

    function saveMemo() {
        const el = document.getElementById('memo-area');
        if (!el) return;
        const val = el.value;
        appData.memo = val;
        saveToLS();
        renderMemoLinks(val);
    }

    function renderMemoLinks(text) {
        const container = document.getElementById('memo-links');
        if (!container) return;
        container.innerHTML = '';
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const matches = text.match(urlRegex);
        if(matches) {
            matches.forEach(url => {
                container.innerHTML += `<a href="${url}" target="_blank" class="pixel-btn text-xs px-2 py-1 truncate max-w-full" rel="noopener noreferrer"><i class="fas fa-link"></i> 連結</a>`;
            });
        }
    }

    // --- NAVIGATION (keeps the existing inline-logic) ---
    function switchTab(tabName) {
        // Update Buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('nav-active');
            if(btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(tabName)) btn.classList.add('nav-active');
        });
        // Update Sections
        document.querySelectorAll('.page-section').forEach(sec => sec.classList.remove('active'));
        const section = document.getElementById(`page-${tabName}`);
        if (section) section.classList.add('active');

        // Scroll to top
        const main = document.getElementById('main-container');
        if (main) main.scrollTop = 0;
    }

    // --- INITIAL RENDER ---
    function init() {
        renderItinerary();
        renderShop();
        renderExpenses();
        renderChecklist();

        const memoEl = document.getElementById('memo-area');
        if (memoEl) {
            memoEl.value = appData.memo;
            renderMemoLinks(appData.memo);
            memoEl.addEventListener('input', saveMemo);
        }

        // calc input binding
        const calcInput = document.getElementById('calc-input');
        if (calcInput) {
            calcInput.addEventListener('input', updateCalcPreview);
        }

        // expose functions used by inline onclicks to global scope
        window.resetData = resetData;
        window.previewImage = previewImage;
        window.addItineraryDay = addItineraryDay;
        window.deleteItineraryDay = deleteItineraryDay;
        window.addItineraryItem = addItineraryItem;
        window.deleteItineraryItem = deleteItineraryItem;
        window.moveItineraryItem = moveItineraryItem;
        window.switchTab = switchTab;
        window.addShopItem = addShopItem;
        window.deleteShop = deleteShop;
        window.saveRate = saveRate;
        window.calcAppend = calcAppend;
        window.calculate = calculate;
        window.addExpense = addExpense;
        window.deleteExpense = deleteExpense;
        window.addCheckItem = addCheckItem;
        window.toggleCheck = toggleCheck;
        window.deleteCheck = deleteCheck;
        window.saveMemo = saveMemo;
        window.renderItinerary = renderItinerary;
        // Ensure initial preview calc shown
        updateCalcPreview();
    }

    document.addEventListener('DOMContentLoaded', init);
})();