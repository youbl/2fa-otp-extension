let __codeRefreshing = false;
const STORAGE_OTP_KEY = 'key';          // otp's key used in storage
const STORAGE_CONFIG_KEY = 'configs';   // global config's key used in storage
let __currentLang = 'en-US';            // start language
var __languageMap = null;               // all multi-language map

startRun();

function startRun() {
    loadAndSwitchLanguage();

    // get all dialog's close-button
    const closeBtns = document.getElementsByClassName('dialog-close');
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            // stop esc to close window
            event.preventDefault();

            // enable esc to close all dialog
            for(let i=0,j=closeBtns.length; i<j; i++) {
                if(!isHidden(closeBtns[i]))
                    closeBtns[i].click();
            }
        }
    });

    /** extensions can't add onclick for dom, so I can only add listener in js */

    // add event for: all dialog's close-button 
    for(let i=0,j=closeBtns.length; i<j; i++) {
        closeBtns[i].addEventListener('click', function (){
            this.parentNode.style.display = 'none';
        });
    }

    // show add-key dialog
    document.getElementById('btnShowAddCode').addEventListener('click', function (){
        clearCanvas();
        document.getElementById('dialogAdd').style.display = 'block';
        document.getElementById('txtName').value = '';
        document.getElementById('txtSecret').value = '';
        document.getElementById('txtUrl').value = '';
        document.getElementById('txtName').focus();
    });
    // confirm event in add-key dialog
    document.getElementById('btnAddCode').addEventListener('click', function (){
        let desc = document.getElementById('txtName').value.trim();
        let secret = document.getElementById('txtSecret').value.trim();
        let url = document.getElementById('txtUrl').value.trim();
        if(!desc || !secret)
            return alert('title and key are required!');
        addNode(desc, secret, url);            
        addSecret(desc, secret, url);
        document.getElementById('dialogAdd').style.display = 'none';
        // Clear input fields
        document.getElementById('txtName').value = '';
        document.getElementById('txtSecret').value = '';
        document.getElementById('txtUrl').value = '';
    });
    // export all otp key from storage to clipboard
    document.getElementById('btnExport').addEventListener('click', function (){
        exportSecrets();
    });
    // import otp key from clipboard, and save to storage
    document.getElementById('btnImport').addEventListener('click', function (){
        importSecrets();
    });
    // close current window
    document.getElementById('btnClose').addEventListener('click', function (){
        window.close();
    });
    // read otp key from qrcode file, triggered after file select
    document.getElementById('fileSelect').addEventListener('change', (evt) => {
        const file = evt.target.files[0];
        parseKeyFromQRCode(file);
    });

    // search box: filter rows by title or url on keyup
    document.getElementById('searchInput').addEventListener('keyup', filterCodes);

    // custom confirm dialog: Yes runs the callback, No just closes
    document.getElementById('btnConfirmYes').addEventListener('click', function() {
        document.getElementById('dialogConfirm').style.display = 'none';
        if (__confirmCallback) {
            const cb = __confirmCallback;
            __confirmCallback = null;
            cb();
        }
    });
    document.getElementById('btnConfirmNo').addEventListener('click', function() {
        __confirmCallback = null;
        document.getElementById('dialogConfirm').style.display = 'none';
    });

    refreshCode();
    // regenerate otp-code per second
    setInterval(refreshCode, 1000);

    // show or hide code's pop-layer
    const tooltip = document.getElementById('tooltip');

    // Add click event listener for tooltip (event delegation, click code to copy)
    tooltip.addEventListener('click', function(event) {
        const target = event.target;
        console.log('Tooltip clicked, target:', target, 'classes:', target.classList);
        if (target.classList.contains('tooltip-code')) {
            const code = target.getAttribute('data-code');
            console.log('Found tooltip-code with data-code:', code);
            if (code) {
                copyCodeFromTooltip(code);
                event.stopPropagation(); // Prevent event bubbling
            }
        }
    });

    // Click anywhere outside the tooltip closes it.
    // Arrow clicks stopPropagation, so they are handled by their own open/switch logic
    // and never reach here.
    document.addEventListener('click', function(event) {
        if (tooltip.style.display !== 'block') return;
        if (tooltip.contains(event.target)) return;
        tooltip.style.display = 'none';
        if (tooltip._currentCode && tooltip._currentCode._tooltipUpdateTimer) {
            clearInterval(tooltip._currentCode._tooltipUpdateTimer);
            tooltip._currentCode._tooltipUpdateTimer = null;
        }
        const curBtn = tooltip._currentCode ? tooltip._currentCode.querySelector('.code-expand-btn') : null;
        if (curBtn) curBtn.classList.remove('expanded');
        tooltip._currentCode = null;
    });
    // wait for node rendered
    setTimeout(addHoverLayer, 500);
}

// add pop-layer for each code
function addHoverLayer() {
    const tooltip = document.getElementById('tooltip');
    const codeElementArr = document.querySelectorAll('.code');
    //alert(codeElementArr.length)
    codeElementArr.forEach(codeElement => {
        // Avoid duplicate event binding
        if (codeElement.getAttribute('hover-bindclick') !== null) {
            return;
        }

        const expandBtn = codeElement.querySelector('.code-expand-btn');
        if (expandBtn) {
            expandBtn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();

                // Click the same arrow again -> collapse
                if (tooltip.style.display === 'block' && tooltip._currentCode === codeElement) {
                    tooltip.style.display = 'none';
                    if (codeElement._tooltipUpdateTimer) {
                        clearInterval(codeElement._tooltipUpdateTimer);
                        codeElement._tooltipUpdateTimer = null;
                    }
                    tooltip._currentCode = null;
                    expandBtn.classList.remove('expanded');
                    return;
                }

                // Switching from another row: stop its timer and reset its arrow
                if (tooltip._currentCode && tooltip._currentCode !== codeElement) {
                    if (tooltip._currentCode._tooltipUpdateTimer) {
                        clearInterval(tooltip._currentCode._tooltipUpdateTimer);
                        tooltip._currentCode._tooltipUpdateTimer = null;
                    }
                    const prevBtn = tooltip._currentCode.querySelector('.code-expand-btn');
                    if (prevBtn) prevBtn.classList.remove('expanded');
                }

                tooltip.style.display = 'block';

                // Get secret to generate next code
                const parentLi = codeElement.closest('li');
                const secretElement = parentLi ? parentLi.querySelector('.copy-btn[data]') : null;
                const secret = secretElement ? secretElement.getAttribute('data') : '';

                // Generate dual code tooltip content
                const currentCode = codeElement.querySelector('.copy-btn').getAttribute('data');
                const nextCode = secret ? getNextCode(secret) : '';
                const nextNextCode = secret ? getCodeAhead(secret, 2) : '';
                const currentTimeLeft = getCodeTimeLeft();
                const nextTimeLeft = getNextCodeTimeLeft();
                const nextNextTimeLeft = getNextNextCodeTimeLeft();

                const tooltipHtml = `
                    <div style="margin-bottom: 6px; font-weight: bold; color: #666;">📋 Click code to copy:</div>
                    <div class="tooltip-code-item tooltip-current">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span class="tooltip-current-time" style="color: #0066cc; font-size: 12px;">Expires in ${currentTimeLeft}s</span>
                            <div class="tooltip-code tooltip-code-current" style="color: #0066cc; cursor: pointer;" data-code="${currentCode}" title="Click to copy">${currentCode}</div>
                        </div>
                    </div>
                    <div class="tooltip-code-item tooltip-next">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span class="tooltip-next-time" style="color: #22aa22; font-size: 12px;">Active in ${nextTimeLeft}s</span>
                            <div class="tooltip-code tooltip-code-next" style="color: #22aa22; cursor: pointer;" data-code="${nextCode}" title="Click to copy">${nextCode}</div>
                        </div>
                    </div>
                    <div class="tooltip-code-item tooltip-nextnext">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span class="tooltip-nextnext-time" style="color: #999; font-size: 12px;">Active in ${nextNextTimeLeft}s</span>
                            <div class="tooltip-code tooltip-code-nextnext" style="color: #999; cursor: pointer;" data-code="${nextNextCode}" title="Click to copy">${nextNextCode}</div>
                        </div>
                    </div>
                `;

                tooltip.innerHTML = tooltipHtml;

                // Start real-time update timer
                if (codeElement._tooltipUpdateTimer) {
                    clearInterval(codeElement._tooltipUpdateTimer);
                }
                codeElement._tooltipUpdateTimer = setInterval(updateTooltipContent, 1000);

                // Position relative to the code row (does not follow the cursor)
                updateTooltipPosition();

                tooltip._currentCode = codeElement;
                expandBtn.classList.add('expanded');
            });
        }
        
        // Update only the dynamic text nodes in place (avoids full innerHTML rebuild flicker)
        function updateTooltipContent() {
            if (tooltip.style.display !== 'block') return;
            const parentLi = codeElement.closest('li');
            const secretElement = parentLi ? parentLi.querySelector('.copy-btn[data]') : null;
            const secret = secretElement ? secretElement.getAttribute('data') : '';

            const currentCode = codeElement.querySelector('.copy-btn').getAttribute('data');
            const nextCode = secret ? getNextCode(secret) : '';
            const nextNextCode = secret ? getCodeAhead(secret, 2) : '';

            const curEl = tooltip.querySelector('.tooltip-code-current');
            const nextEl = tooltip.querySelector('.tooltip-code-next');
            const nextNextEl = tooltip.querySelector('.tooltip-code-nextnext');
            if (curEl && curEl.textContent !== currentCode) {
                curEl.textContent = currentCode;
                curEl.setAttribute('data-code', currentCode);
            }
            if (nextEl && nextEl.textContent !== nextCode) {
                nextEl.textContent = nextCode;
                nextEl.setAttribute('data-code', nextCode);
            }
            if (nextNextEl && nextNextEl.textContent !== nextNextCode) {
                nextNextEl.textContent = nextNextCode;
                nextNextEl.setAttribute('data-code', nextNextCode);
            }
            const curTime = tooltip.querySelector('.tooltip-current-time');
            const nextTime = tooltip.querySelector('.tooltip-next-time');
            const nextNextTime = tooltip.querySelector('.tooltip-nextnext-time');
            if (curTime) curTime.textContent = 'Expires in ' + getCodeTimeLeft() + 's';
            if (nextTime) nextTime.textContent = 'Active in ' + getNextCodeTimeLeft() + 's';
            if (nextNextTime) nextNextTime.textContent = 'Active in ' + getNextNextCodeTimeLeft() + 's';
        }
        
        // Position the tooltip just below the code (left-aligned with it), so the cursor can
        // move straight down into it. Flip above only when there's no room below.
        function updateTooltipPosition() {
            const codeRect = codeElement.getBoundingClientRect();
            const windowHeight = window.innerHeight || document.documentElement.clientHeight;
            const tooltipHeight = tooltip.offsetHeight || 120;
            let topPosition = codeRect.bottom + 2;
            if (topPosition + tooltipHeight > windowHeight) {
                topPosition = codeRect.top - tooltipHeight - 2;
            }
            if (topPosition < 5) {
                topPosition = 5;
            }
            tooltip.style.left = codeRect.left + 'px';
            tooltip.style.top = topPosition + 'px';
        }
        
        // Mark as bound to avoid duplicate binding
        codeElement.setAttribute('hover-bindclick', '1');
    });
}

// read last language, and switch to this lang on app start.
async function loadAndSwitchLanguage() {
    // hidden current language button, show the others
    const langBtns = document.getElementsByClassName('multi-lang-btn');
    for(let i=0, j=langBtns.length; i<j; i++) {
        const btn = langBtns[i];
        const lang = btn.attributes['lang'].value;
        // switch language event
        clickListen(btn, () => {
            switchLanguage(lang);
        });
    }

    // change language by last selected
    let configs = await getConfigs();
    await switchLanguage(configs.lang);
}

function hideLanguageBtns() {
    const langBtns = document.getElementsByClassName('multi-lang-btn');
    for(let i=0, j=langBtns.length; i<j; i++) {
        const btn = langBtns[i];
        const lang = btn.attributes['lang'].value;
        if(lang === __currentLang) {
            btn.style.display = 'none';
        }else{
            btn.style.display = '';
        }
    }
}

async function switchLanguage(targetLang) {
    targetLang = targetLang ? targetLang : 'en-US';
    console.log('current: ', __currentLang, ' target: ', targetLang);
    if(targetLang === __currentLang) {
        hideLanguageBtns();
        return;
    }
    
    const allMap = await getLanguageJson();
    if(!allMap) return;
    console.log(allMap);

    // do language change
    const langMapKey = __currentLang + '|' + targetLang;
    changeDomTextByLanguage(allMap[langMapKey]);

    // switch ok, save to global config
    let configs = await getConfigs();
    __currentLang = targetLang;
    configs.lang = __currentLang;
    setConfigs(configs);

    hideLanguageBtns();
}

// combine multi-language json
// example: key=en-US|zh-CN value={'a':'b'}
async function getLanguageJson() {
    if(__languageMap === null) {
        const ret = {};

        const jsPath = 'js/zh-CN.json';
        // map for: en-US => zh-CN
        const mapEnToZh = await getJsonFromUrl(jsPath);
        ret['en-US|zh-CN'] = mapEnToZh;

        // map for: zh-CN => en-US
        const mapZhToUs = {};
        ret['zh-CN|en-US'] = mapZhToUs;
        for(let key in mapEnToZh) {
            if (!mapEnToZh.hasOwnProperty(key)) 
                continue;
            let val = mapEnToZh[key];
            mapZhToUs[val] = key;
        }

        // todo: can add other language map here
        __languageMap = ret;
    }
    return __languageMap;
}

function changeDomTextByLanguage(json) {
    if(!json) return;

    const domArr = document.getElementsByClassName('multi-lang');
    for(let i=0, j=domArr.length; i<j; i++) {
        const dom = domArr[i];
        // inputs carry their text in placeholder instead of innerText
        if(dom.tagName === 'INPUT' && dom.hasAttribute('placeholder')) {
            const key = dom.placeholder.trim();
            const langTxt = json[key];
            if(langTxt !== undefined) {
                dom.placeholder = langTxt;
            }
            continue;
        }
        const key = dom.innerText.trim();
        const langTxt = json[key];
        if(langTxt !== undefined) {
            dom.innerText = langTxt;
        }
    }
}

function exportSecrets() {
    getStorage()
        .then((arrSecrets)=>{
            let ret = '';
            if(arrSecrets) {
                Object.keys(arrSecrets).forEach((key) => {
                    let item = arrSecrets[key];
                    // Compatible with old format (secret string only) and new format (object with secret and url)
                    let secret, url = '';
                    if (typeof item === 'string') {
                        secret = item;
                    } else {
                        secret = item.secret || '';
                        url = item.url || '';
                    }
                    if (url) {
                        ret += key + ':' + secret + '|' + url + '\n';
                    } else {
                        ret += key + ':' + secret + '\n';
                    }
                });
            }
            if(!ret){
                return showCustomAlert('no data can export');
            }
            copyStr(ret).then(()=>{
                showCustomAlert('exported to clipboard, please save and import next time.');
            });            
        });    
}

function importSecrets() {
    readCopy().then(text=>{
        if(!text)
            return showCustomAlert('no data in clipboard');
        let arr = text.split(/[\r\n]/g);
        let result = [];
        for(let i=0,j=arr.length;i<j;i++) {
            let item = arr[i].trim();
            if(item.length === 0) 
                continue;
            // Find the first colon (not lastIndexOf) to split desc and value
            // This handles cases where URL might contain colons
            let idx = item.indexOf(':');
            if(idx <= 0 || idx >= item.length - 1)
                continue;
            let desc = item.substring(0, idx);
            let value = item.substring(idx+1);
            // Support new format: desc:secret|url or old format: desc:secret
            let secret, url = '';
            let pipeIdx = value.indexOf('|');
            if (pipeIdx > 0 && pipeIdx < value.length - 1) {
                secret = value.substring(0, pipeIdx);
                url = value.substring(pipeIdx + 1);
            } else {
                secret = value;
            }
            // Trim whitespace
            desc = desc.trim();
            secret = secret.trim();
            url = url.trim();
            if(desc && secret) {
                result.push([desc, secret, url]);
            }
        }
        
        if(result.length <= 0)
            return showCustomAlert('the data in clipboard is not valid.');
        if(!confirm('confirm to import these ' + result.length + ' line data? Note: key with same title will be replaced'))
            return;
        getStorage()
            .then((arrSecrets)=>{
                if(!arrSecrets)
                    arrSecrets = {};
                for(let i=0,j=result.length;i<j;i++){
                    let item = result[i];
                    let desc = item[0];
                    let secret = item[1];
                    let url = item[2] || '';
                    // Save as new format: {secret: secret, url: url}
                    arrSecrets[desc] = {
                        secret: secret,
                        url: url
                    };
                }
                setStorage(arrSecrets)
                    .then(refreshCode);
            });
    });
}

function refreshCode(){
    if(__codeRefreshing)
        return;
    __codeRefreshing = true;
    
    try{
        let root = document.getElementById('divCode');
        let ulList = root.getElementsByTagName('UL');
        if(ulList.length <= 0){
            // full load at first
            getStorage()
                .then((arrSecrets)=>{
                    if(arrSecrets) {
                        Object.keys(arrSecrets).forEach((key) => {
                            let item = arrSecrets[key];
                            // Compatible with old format (secret string only) and new format (object with secret and url)
                            let secret, url = '';
                            if (typeof item === 'string') {
                                secret = item;
                            } else {
                                secret = item.secret || '';
                                url = item.url || '';
                            }
                            addNode(key, secret, url);
                        });
                    }
                    filterCodes();
                });    
            return;
        }
    
        // only refresh code and time, don't refresh others
        let liList = ulList[0].getElementsByTagName('LI');
        let endTime = getCodeTimeLeft();
        for(let i=0,j=liList.length;i<j;i++) {
            let node = liList[i];
            let copyNodes = node.getElementsByClassName('copy-btn');
            let copyCodeNode = copyNodes[1];
            let copySecretNode = copyNodes[0];
            let endTimeNode = node.getElementsByClassName('endTime')[0];
    
            let secret = copySecretNode.getAttribute('data');
            let code = getCode(secret);
    
            endTimeNode.innerText = endTime + 's';
            if (parseInt(endTime, 10) < 11) {
                endTimeNode.classList.add('urgent');
            } else {
                endTimeNode.classList.remove('urgent');
            }
            if(code !== copyCodeNode.getAttribute('data')) {
                copyCodeNode.innerText = code;
                copyCodeNode.setAttribute('data', code);
            }
        }
    }catch(e){
        alert('err:' + e.message);
    }finally{
        __codeRefreshing = false;
    }
}

// filter list rows by title or url (case-insensitive substring), triggered by search box
function filterCodes() {
    const keyword = document.getElementById('searchInput').value.trim().toLowerCase();
    const root = document.getElementById('divCode');
    const ulList = root.getElementsByTagName('UL');
    let matched = 0;
    if(ulList.length > 0) {
        const liList = ulList[0].getElementsByTagName('LI');
        for(let i=0, j=liList.length; i<j; i++) {
            const li = liList[i];
            const descNode = li.querySelector('.desc');
            const urlBtn = li.querySelector('.url-btn');
            const desc = descNode ? descNode.innerText.toLowerCase() : '';
            const url = urlBtn ? (urlBtn.getAttribute('data-url') || '').toLowerCase() : '';
            if(!keyword || desc.indexOf(keyword) >= 0 || url.indexOf(keyword) >= 0) {
                li.style.display = '';
                matched++;
            } else {
                li.style.display = 'none';
            }
        }
    }
    const hint = document.getElementById('noMatchHint');
    if(hint) {
        hint.style.display = (keyword && matched === 0) ? 'block' : 'none';
    }
}

function addCopyClick(container){
    let btns = container.getElementsByClassName('copy-btn');
    for(let i=0,j=btns.length;i<j;i++){
        //let code = btns[i].parentNode.previousElementSibling.innerText;
        if(btns[i].getAttribute('bindclick') === null) {
            btns[i].addEventListener('click', function () {
                let code = this.getAttribute('data');
                copyStr(code).then(()=>{
                    showCustomAlert('copyed: ' + code, true);
                });
            });
            btns[i].setAttribute('bindclick', 1); // avoid repeatedly bind.
        }
    }
}

function addDelClick(container){
    let btns = container.getElementsByClassName('del-btn');
    for(let i=0,j=btns.length;i<j;i++){
        if(btns[i].getAttribute('bindclick') === null) {
            btns[i].addEventListener('click', function () {
                let desc = this.getAttribute('data');
                const btn = this;
                showCustomConfirm("Confirm del? Note: can't restore!", function() {
                    removeNode(btn);
                    removeSecret(desc);
                });
            });
            btns[i].setAttribute('bindclick', 1); // avoid repeatedly bind.
        }
    }
}

// add a line to page table
function addNode(desc, secret, url) {
    url = url || '';
    let codeTml = document.getElementById('codeItemTemp').innerHTML;
    
    let endTime = getCodeTimeLeft();
    let code = getCode(secret);
    // console.log(key + ':' + secret + ' code:' + code);
    let itemHtml = codeTml.replace(/\{\{desc\}\}/g, desc)
        .replace(/\{\{code\}\}/g, code)
        .replace(/\{\{secret\}\}/g, secret)
        .replace(/\{\{endTime\}\}/g, endTime)
        .replace(/\{\{url\}\}/g, url);

    let root = document.getElementById('divCode');
    let ulList = root.getElementsByTagName('UL');
    let container = null;
    if(ulList.length > 0){
        ulList[0].innerHTML += itemHtml;
        
    }else{
        root.innerHTML = '<ul>' + itemHtml + '</ul>';
    }
    // wait a moment, to avoid render not ok
    setTimeout(()=>{
        let liList = root.getElementsByTagName('LI');
        for(let i=0,j=liList.length;i<j;i++){
        let container = liList[i]; 
        addCopyClick(container);
        addDelClick(container);
        addQRCodeClick(container);
        addUrlClick(container);}
        
        // Rebind hover effect to ensure newly added codes also have tooltip
        addHoverLayer();
        // Re-apply current search filter to the newly added row
        filterCodes();

        __codeRefreshing = false;
    }, 50);
}

// add a record into LocalStorage
function addSecret(desc, secret, url){
    url = url || '';
    getStorage()
        .then((arrSecrets)=>{
            if(!arrSecrets)
                arrSecrets = {};
            // Save as new format: {secret: secret, url: url}
            arrSecrets[desc] = {
                secret: secret,
                url: url
            };
            setStorage(arrSecrets);
        });
}

// remove btn's parentNode(delete the current row)
function removeNode(btn) {
    let parent = btn.parentNode;
    while(parent) {
        if(parent.tagName.toLowerCase() === 'li') {
            parent.remove();
            break;
        }
        parent = parent.parentNode;
    }
}

// delete a key according desc
function removeSecret(desc) {
    getStorage()
        .then((arrSecrets)=>{
            if(!arrSecrets)
                return;
            delete arrSecrets[desc];
            setStorage(arrSecrets);
        });
}

/**
 * generate a otp-code
 * 
 * @param {string} secret otp-key
 * @returns code
 */
function getCode(secret) {
    if (!secret) {
        return '';
    }
    let totp = new OTPAuth.TOTP({
        issuer: 'youbl',
        algorithm: "SHA1",
        digits: 6,                  // number of otp-code bits
        period: 30,                 // generate a code per 30 seconds
        secret: secret,
    });
    return totp.generate();
}

/**
 * generate next otp-code (for next 30-second period)
 * 
 * @param {string} secret otp-key
 * @returns next code
 */
/**
 * generate otp-code for a future period (periodsAhead periods after the current one)
 *
 * @param {string} secret otp-key
 * @param {number} periodsAhead how many 30s periods ahead (1 = next, 2 = next-next)
 * @returns otp-code for that period
 */
function getCodeAhead(secret, periodsAhead) {
    if (!secret) {
        return '';
    }
    // temporarily override Date.now() to simulate the target period
    const originalNow = Date.now;
    try {
        const currentPeriod = Math.floor(Math.floor(Date.now() / 1000) / 30);
        const targetPeriodMs = (currentPeriod + periodsAhead) * 30 * 1000;
        Date.now = function() { return targetPeriodMs; };

        let totp = new OTPAuth.TOTP({
            issuer: 'youbl',
            algorithm: "SHA1",
            digits: 6,
            period: 30,
            secret: secret,
        });
        return totp.generate();
    } catch(e) {
        console.error('Failed to generate OTP code:', e);
        return '';
    } finally {
        Date.now = originalNow;
    }
}

/**
 * generate next otp-code (for next 30-second period)
 *
 * @param {string} secret otp-key
 * @returns next code
 */
function getNextCode(secret) {
    return getCodeAhead(secret, 1);
}

/**
 * generate left-time for current otp-code
 * 
 * @returns left-time
 */
function getCodeTimeLeft() {
    let ts = Math.floor(Date.now()/1000); // current timestamp
    let beginTime = Math.floor(ts / 30) * 30;
    let endTime = beginTime + 30;
    let ret = endTime - ts;
    if(ret > 9)
        return ret.toString();
    return '0' + ret.toString();
}

/**
 * generate time left until next otp-code becomes active
 * 
 * @returns time left for next code to be active
 */
function getNextCodeTimeLeft() {
    let ts = Math.floor(Date.now()/1000); // current timestamp
    let currentPeriod = Math.floor(ts / 30);
    let nextPeriodStart = (currentPeriod + 1) * 30;
    let ret = nextPeriodStart - ts;
    if(ret > 9)
        return ret.toString();
    return '0' + ret.toString();
}

/**
 * generate time left until the next-next otp-code becomes active (2 periods ahead)
 *
 * @returns time left for next-next code to be active
 */
function getNextNextCodeTimeLeft() {
    let ts = Math.floor(Date.now()/1000); // current timestamp
    let currentPeriod = Math.floor(ts / 30);
    let nextNextPeriodStart = (currentPeriod + 2) * 30;
    let ret = nextNextPeriodStart - ts;
    if(ret > 9)
        return ret.toString();
    return '0' + ret.toString();
}

/**
 * read global config from LocalStorage
 * 
 * @returns configs
 */
async function getConfigs() {
    let configs = await getStorage(STORAGE_CONFIG_KEY);
    if(!configs) {
        configs = {
            'lang': 'en-US',  // default language set
        };
    }
    return configs;
}

/**
 * save global config to LocalStorage
 */
function setConfigs(configs) {
    setStorage(configs, STORAGE_CONFIG_KEY);
}

/**
 * save data to LocalStorage
 *
 * @param {Object} val data
 * @returns Promise
 */
function setStorage(val, key) {
    val = validVal(val) ? val : '';
    let data = { };
    key = key ? key : STORAGE_OTP_KEY;
    data[key] = val;
    
    return new Promise((resolve, reject) => {
        chrome.storage.sync.set(data, ()=>{
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                console.log(key + ' saved to Storage: ' + JSON.stringify(data, null, 4));
                resolve(val);
              }
        });
      });
}

/**
 * read data from LocalStorage
 *
 * @returns Promise
 */
function getStorage(key) {
    key = key ? key : STORAGE_OTP_KEY;
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get(key, function(result) {
          if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            console.log(key + ' geted from Storage: ' + JSON.stringify(result, null, 4));
            let ret = validVal(result[key]) ? result[key] : '';
            resolve(ret);
          }
        });
    });
}

function validVal(val){
    if(val === undefined || val === null)
        return false;
    return val !== '';
}

/**
 * set str to clipboard
 */
function copyStr(str) {
    return navigator.clipboard.writeText(str);
}

/**
 * read str data from clipboard
 */
function readCopy() {
    return navigator.clipboard.readText();
}

// these 2 var, used to avoid multi setTimeout executed, cause alert-win closed early
var __customAlertSecond = 3;
var __customAlertRuning = false;
function showCustomAlert(message, large) {
    __customAlertSecond = 3;
    const alertElement = document.getElementById('customAlert');
    const alertContentElement = document.getElementById('alertContent');
    alertContentElement.textContent = message;
    alertElement.style.display = 'block';
    if (large) {
        // big bold text (e.g. showing a copied code), auto-shrink if it overflows
        alertContentElement.style.fontWeight = 'bold';
        fitAlertFontSize(alertContentElement, 32, 12, 200);
    } else {
        // normal readable size for status messages
        alertContentElement.style.fontWeight = 'normal';
        alertContentElement.style.fontSize = '15px';
    }

    if(__customAlertRuning)
        return;
    __customAlertRuning=true;
    hideCustomAlert();
}

// shrink font from maxSize down to minSize until text fits within maxHeight (and element width)
function fitAlertFontSize(el, maxSize, minSize, maxHeight) {
    el.style.fontSize = maxSize + 'px';
    let size = maxSize;
    while (size > minSize && (el.scrollHeight > maxHeight || el.scrollWidth > el.clientWidth)) {
        size -= 1;
        el.style.fontSize = size + 'px';
    }
}

let __confirmCallback = null;
function showCustomConfirm(message, onConfirm) {
    __confirmCallback = onConfirm;
    document.getElementById('confirmContent').textContent = message;
    document.getElementById('dialogConfirm').style.display = 'block';
}

function hideCustomAlert() {
    if(__customAlertSecond > 0){
        __customAlertSecond--;
        setTimeout(hideCustomAlert, 1000);
        return;
    }
    __customAlertRuning = false;
    const alertElement = document.getElementById('customAlert');
    alertElement.style.display = 'none';
}

// clear canvas's data before
function clearCanvas() {
    const canvas = document.getElementById("canvas");
    const ctx = (canvas).getContext('2d', {willReadFrequently: true});
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// parse otp-key from qrcode image
function parseKeyFromQRCode(file) {
    const canvas = document.getElementById("canvas");
    const URL = window.URL || window.webkitURL;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = function () {
        canvas.width = img.width;
        canvas.height = img.height;
        // release URL memory
        URL.revokeObjectURL(img.src);
        
        const context = (canvas).getContext('2d', {willReadFrequently: true});
        context.drawImage(this, 0, 0, img.width, img.height);
        const imageData = context.getImageData(0, 0, img.width, img.height);
        // read data by jsQR
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (!code || !code.data) {
            return alert('The file isn\'t a otp image：' + code);
        }
        console.log("Found QR code", code.data);
        let qrKey = parseSecretFromCode(code.data);
        if(!qrKey) {
            qrKey = parseSecretFromGoogleAppExport(code.data);
            // only get the first key
            if(qrKey && qrKey.length > 0) {
                qrKey = qrKey[0].secret;
            }
        }
        if(!qrKey) {
            return alert('The file doesn\'t contain otp-key：' + code);
        }
        document.getElementById('txtSecret').value = qrKey;
    };
    img.src = url;  // set img.src, to trigger img.onload
}

// parse otp-key from a standard OTP string
// standard like: "otpauth://totp/AmazonWebServices:mfa-abc?secret=abc&issuer=AmazonWebServices"
function parseSecretFromCode(code) {
    if (!code)
        return '';
    let start = 'secret=';
    let idx = code.indexOf(start);
    if (idx < 0) 
        return '';
    let ret = code.substring(idx + start.length);
    idx = ret.indexOf('&');
    if (idx > 0)
        ret = ret.substring(0, idx);
    return ret;
}

function clickListen(btnId, handler) {
    if(btnId === null || btnId === undefined || btnId === '') {
        return alert('btnId can not be empty.');
    }
    let btn;
    if(typeof(btnId) === 'string')
        btn = document.getElementById(btnId);
    else 
        btn = btnId;
    if(!btn) {
        return alert('btn="' + btnId + '" can not exists.');
    }
    btn.addEventListener('click', handler);
}

// check the element is unvisible or not
function isHidden(el) {
    return (el.offsetParent === null);
    //let style = window.getComputedStyle(el);
    //while(style) {
    //    if (style.display === 'none')
    //        return true;
    //    style = el.parentNode ? window.getComputedStyle(el.parentNode) : null;
    //}
    //return false;
}

// sync get json-data from the url
async function getJsonFromUrl(url) {
    const response = await fetch(url);
    if (!response.ok) {
        return null;
    }
    return await response.json();
}



/**
 * parse otp-key from a string exported by "Google Authenticator APP"
 * @param {string} otpauthString - a string start with "otpauth-migration://offline"
 * @returns {Array} array contains all otp-key info, demo: [{name: 'name-1', secret: 'secret-1'},{name: 'name-2', secret: 'secret-2'}]
 */
function parseSecretFromGoogleAppExport(otpauthString) {
  if (!otpauthString.startsWith('otpauth-migration://offline')) {
    throw new Error('invalid otpauth string');
  }

  try {
    // remove url scheme
    const decodedString = decodeURIComponent(otpauthString.replace('otpauth-migration://offline?data=', ''));    
    // Base64 decode
    const decodedData = atob(decodedString);
    
    // convert to Uint8Array
    const uint8Array = new Uint8Array(decodedData.length);
    for (let i = 0; i < decodedData.length; i++) {
      uint8Array[i] = decodedData.charCodeAt(i);
    }
    
    // parse data by pre-defined struct
    const mfaKeys = parseMigrationPayload(uint8Array);

    return mfaKeys;
  } catch (error) {
    console.error('parse otpauth string error:', error);
    throw new Error('parse otpauth string error');
  }
}

/**
 * parse MigrationPayload struct
 * @param {Uint8Array} data - binary data to parse
 * @returns {Array} array contains all otp-key info
 */
function parseMigrationPayload(data) {
  let offset = 0;
  const mfaKeys = [];

  while (offset < data.length) {
    const tag = data[offset] >> 3;
    offset++;

    if (tag === 1) { // otpParameters
      const length = readVarint(data, offset);
      offset += varintLength(length);
      
      const endOffset = offset + length;
      const otpParameter = parseOtpParameter(data.slice(offset, endOffset));
      if (otpParameter) {
        mfaKeys.push(otpParameter);
      }
      
      offset = endOffset;
    } else {
      // skip unknown field
      const wireType = data[offset - 1] & 0x7;
      if (wireType === 0) {
        offset += varintLength(readVarint(data, offset));
      } else if (wireType === 2) {
        const length = readVarint(data, offset);
        offset += varintLength(length) + length;
      } else {
        console.warn('unknown wire type:', wireType, 'at offset:', offset - 1);
        break; // break while loop
      }
    }
  }

  return mfaKeys;
}

/**
 * parse OtpParameter struct
 * @param {Uint8Array} data - binary data to parse
 * @returns {Object|null} object contains name and secret, or null
 */
function parseOtpParameter(data) {
  let offset = 0;
  let name, secret;

  while (offset < data.length) {
    const tag = data[offset] >> 3;
    offset++;

    if (tag === 1) { // secret
      const length = readVarint(data, offset);
      offset += varintLength(length);
      let secretArr = data.slice(offset, offset + length);
      secret = base32Encode(secretArr);
      offset += length;
    } else if (tag === 2) { // name
      const length = readVarint(data, offset);
      offset += varintLength(length);
      name = new TextDecoder().decode(data.slice(offset, offset + length));
      offset += length;
    } else {
      // skip unknown field
      const wireType = data[offset - 1] & 0x7;
      if (wireType === 0) {
        offset += varintLength(readVarint(data, offset));
      } else if (wireType === 1) {
        offset += 8;
      } else if (wireType === 2) {
        const length = readVarint(data, offset);
        offset += varintLength(length) + length;
      } else if (wireType === 5) {
        offset += 4;
      } else {
        console.warn('unknown wire type:', wireType, 'at offset:', offset - 1);
        // try to skip this field
        offset++;
      }
    }
  }

  return name && secret ? { name, secret } : null;
}

/**
 * read varint encoded integer
 * @param {Uint8Array} data - data contains varint
 * @param {number} offset - start position
 * @returns {number} decoded integer
 */
function readVarint(data, offset) {
  let result = 0;
  let shift = 0;
  let byte;

  do {
    byte = data[offset++];
    result |= (byte & 0x7f) << shift;
    shift += 7;
  } while (byte & 0x80);

  return result;
}

/**
 * calculate varint encoded length
 * @param {number} value - integer to calculate length
 * @returns {number} varint encoded length
 */
function varintLength(value) {
  let length = 0;
  while (value > 0) {
    value >>= 7;
    length++;
  }
  return length || 1;
}

function base32Encode(data) {
    return base32.encode(data);
}

/**
 * Copy OTP code from tooltip
 * @param {string} code - Code to copy
 */
function copyCodeFromTooltip(code) {
    if (code) {
        copyStr(code).then(() => {
            showCustomAlert('Copied code: ' + code, true);
        }).catch((error) => {
            console.error('Copy failed:', error);
            showCustomAlert('Copy failed, please try again');
        });
    }
}

/**
 * Generate otpauth:// format URI
 * @param {string} desc - Secret description/title
 * @param {string} secret - OTP secret
 * @returns {string} otpauth URI
 */
function generateOtpAuthUrl(desc, secret) {
    const issuer = 'beinetOtpExt';
    const account = desc;
    
    // Build otpauth URI
    const params = new URLSearchParams({
        secret: secret,
        issuer: issuer,
        algorithm: 'SHA1',
        digits: '6',
        period: '30'
    });
    
    return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?${params.toString()}`;
}

/**
 * Generate and display QR code
 * @param {string} desc - Secret description
 * @param {string} secret - OTP secret
 * @param {Element} container - QR code container element
 */
function generateQRCode(desc, secret, container) {
    // Clear container
    container.innerHTML = '';
    
    // Generate otpauth URL
    const otpauthUrl = generateOtpAuthUrl(desc, secret);
    
    // Create QR code
    try {
        const qr = new QRCode(container, {
            text: otpauthUrl,
            width: 180,
            height: 180,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.M
        });
        
        // Add tip text
        const tipDiv = document.createElement('div');
        tipDiv.style.textAlign = 'center';
        tipDiv.style.fontSize = '12px';
        tipDiv.style.color = '#666';
        tipDiv.style.marginTop = '5px';
        tipDiv.textContent = 'Use Google Authenticator to scan';
        container.appendChild(tipDiv);
        
    } catch (error) {
        console.error('Failed to generate QR code:', error);
        container.innerHTML = '<div style="color: red; font-size: 12px;">Failed to generate QR code</div>';
    }
}

/**
 * Add event listener for QR code button
 * @param {Element} container - Container containing QR code button
 */
function addQRCodeClick(container) {
    const qrcodeBtns = container.getElementsByClassName('qrcode-btn');
    for (let i = 0, j = qrcodeBtns.length; i < j; i++) {
        const btn = qrcodeBtns[i];
        if (btn.getAttribute('qrcode-bindclick') === null) {
            const desc = btn.getAttribute('data-desc');
            const secret = btn.getAttribute('data-secret');
            const popupId = 'qrcode-popup-' + desc;
            const popup = document.getElementById(popupId);
            
            // Show QR code on mouse hover
            btn.addEventListener('mouseenter', function() {
                if (popup && desc && secret) {
                    // Generate once per row; the QR for a fixed secret never changes
                    if (popup.getAttribute('data-generated') !== '1') {
                        generateQRCode(desc, secret, popup);
                        popup.setAttribute('data-generated', '1');
                    }
                    
                    // Smart positioning: detect if popup should appear above
                    const btnRect = this.getBoundingClientRect();
                    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
                    const popupHeight = 250; // Estimated popup height (180px QR code + padding + text)
                    const spaceBelow = windowHeight - btnRect.bottom;
                    const spaceAbove = btnRect.top;
                    
                    // If insufficient space below and sufficient space above, popup upward
                    if (spaceBelow < popupHeight && spaceAbove > popupHeight) {
                        popup.classList.add('qrcode-popup-up');
                    } else {
                        popup.classList.remove('qrcode-popup-up');
                    }
                    
                    popup.style.display = 'block';
                }
            });
            
            // Hide QR code on mouse leave
            btn.addEventListener('mouseleave', function() {
                if (popup) {
                    // Delay hiding to allow mouse to move to QR code
                    setTimeout(() => {
                        if (!popup.matches(':hover') && !btn.matches(':hover')) {
                            popup.style.display = 'none';
                            // Clear positioning class
                            popup.classList.remove('qrcode-popup-up');
                        }
                    }, 100);
                }
            });
            
            // Mouse events for QR code container itself
            if (popup) {
                popup.addEventListener('mouseenter', function() {
                    this.style.display = 'block';
                });
                
                popup.addEventListener('mouseleave', function() {
                    // Delay hiding so a brief edge-cross doesn't flash-hide the QR popup
                    setTimeout(() => {
                        if (!popup.matches(':hover') && !btn.matches(':hover')) {
                            popup.style.display = 'none';
                            // Clear positioning class
                            popup.classList.remove('qrcode-popup-up');
                        }
                    }, 100);
                });
            }
            
            btn.setAttribute('qrcode-bindclick', '1'); // Avoid duplicate binding
        }
    }
}

/**
 * Add event listener for URL button
 * @param {Element} container - Container containing URL button
 */
function addUrlClick(container) {
    const urlBtns = container.getElementsByClassName('url-btn');
    for (let i = 0, j = urlBtns.length; i < j; i++) {
        const btn = urlBtns[i];
        if (btn.getAttribute('url-bindclick') === null) {
            btn.addEventListener('click', function() {
                const url = this.getAttribute('data-url');
                if (url) {
                    // Open URL in new tab without requiring tabs permission
                    const link = document.createElement('a');
                    link.href = url;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }
            });
            btn.setAttribute('url-bindclick', '1'); // Avoid duplicate binding
        }
    }
    
    // Show/hide URL button container based on whether URL exists
    const urlBtnContainer = container.getElementsByClassName('url-btn-container')[0];
    if (urlBtnContainer) {
        const urlBtn = urlBtnContainer.getElementsByClassName('url-btn')[0];
        if (urlBtn) {
            const url = urlBtn.getAttribute('data-url');
            if (url && url.trim()) {
                urlBtnContainer.style.display = '';
            } else {
                urlBtnContainer.style.display = 'none';
            }
        } else {
            urlBtnContainer.style.display = 'none';
        }
    }
}