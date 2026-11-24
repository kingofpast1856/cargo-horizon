/* v0.9: settlement receipts, warehouse network, capacity and delivery fixes. */
const init09=init;init=s=>{init09(s);s.receiptsVersion09=1;return s};
// pending() already includes production in v0.6; old v0.4 wrapper subtracted it twice in TR.
available=id=>cap()-totalStock(id)-pending(id);
const risk09=damageChance;damageChance=s=>risk09(s)*(s.intervention==='protect'&&!s.protected ? .35 : 1);
const finite09=n=>typeof n==='number'&&Number.isFinite(n);
function settle09(s,at){
  if(s.done)return false;
  const a=country(s.from),b=country(s.to),p=product(s.p),q=s.qty;
  const old=S.stock?.[s.to]?.[s.p],oldCost=S.costs?.[s.to]?.[s.p];
  const basis=s.basis??((S.prices?.[s.from]?.[s.p]??NaN)*q+s.cost);
  if(!a||!b||!p||!validq(q)||!finite09(basis)||basis<0||!finite09(S.cash)||(!s.customer&&(!finite09(old)||old<0||!finite09(oldCost)||oldCost<0))||(s.customer&&(!finite09(s.customer.reward)||s.customer.reward<0))){
    if(!s.blocked09){s.blocked09=true;notice('delivery','⚠ Teslimat işlenemedi; yük kaybolmadı. Sevkiyat ekranını kontrol et.');}return false;
  }
  const loss=Math.random()<damageChance(s)?Math.min(q,Math.max(1,Math.round(q*(.08+Math.random()*.18)))):0;
  const delivered=q-loss,comp=s.insured&&loss?Math.round(basis*loss/q*.8):0;
  const netBasis=basis-comp;
  let kind='stock',revenue=0,deposit=0,profit=null;
  if(s.customer){kind='customer';revenue=Math.floor(s.customer.reward*delivered/q);profit=revenue-netBasis;}
  else if(!delivered){kind='lost';profit=-netBasis;}
  else if(s.autoSell){kind='sold';revenue=sellprice(s.to,s.p)*delivered;profit=revenue-netBasis;}
  else deposit=delivered;
  // Validate all calculated values before committing. Do not mark done until stock/money is committed.
  if(!finite09(revenue)||!finite09(comp)||!finite09(S.cash+revenue+comp)||(kind==='sold'&&(!finite09(S.market?.[s.to]?.[s.p]?.stock)||!finite09(S.prices?.[s.to]?.[s.p])))){if(!s.blocked09){s.blocked09=true;notice('delivery','⚠ Teslimat hesaplaması bekliyor.')}return false;}
  if(deposit){S.stock[s.to][s.p]=old+deposit;S.costs[s.to][s.p]=(oldCost*old+netBasis)/(old+deposit);}
  if(comp)cash(comp,'Sigorta tazminatı');
  if(kind==='customer'){cash(revenue,'Müşteri siparişi teslimi');S.sales+=revenue;S.contracts++;const job=S.customerJobs.find(j=>j.id===s.customer.id);if(job)job.done=true;if(s.personal06&&delivered)S.parcels06++;}
  if(kind==='sold'){cash(revenue,p.n+' otomatik satış · '+b.n);S.sales+=revenue;S.stats.sell+=revenue;marketMove(s.to,s.p,delivered);}
  if(profit!==null)S.stats.profit+=profit;
  if(!s.customer&&delivered)S.trade06++;
  S.damage+=loss;S.completed++;s.delivered=delivered;s.loss=loss;s.receipt09={kind,at:s.end,deposit,revenue,comp,basis,profit,loss,delivered};s.done=true;delete s.blocked09;
  log('Teslimat · '+b.n);
  const message=kind==='stock'?`${deposit} ${p.n} → ${b.n} deposuna eklendi.`:kind==='sold'?`${delivered} ${p.n} · ${b.n} otomatik satış: ${fmt(revenue)}`:kind==='customer'?`Müşteriye ${delivered}/${q} paket teslimi · ${fmt(revenue)}`:`${p.n} · yük tamamen hasarlı; depoya ürün girmedi.`;
  notice(kind==='sold'||kind==='customer'?'sale':'delivery',message+(loss?` Hasar: ${loss} adet.`:'')+(comp?` Sigorta: ${fmt(comp)}.`:''));dirty=true;return true;
}
completeUntil=at=>{completeProduction(at);for(const s of active().filter(x=>x.end<=at).sort((a,b)=>a.end-b.end))settle09(s,at);S.shipments=S.shipments.filter(s=>!s.done).concat(S.shipments.filter(s=>s.done).sort((a,b)=>b.end-a.end).slice(0,100));const n=S.npcTraffic.length;finishTraffic05(at);if(n!==S.npcTraffic.length)dirty=true;};
function depot09(c){warehouseCountry=c;go('warehouse')}
function status09(s){const r=s.receipt09;if(!r)return s.customer?'Müşteriye teslim (eski kayıt)':s.autoSell?'Otomatik satış seçilmiş (eski kayıt)':'Teslim edildi (eski kayıt)';return {stock:'Depoya ulaştı',sold:'Otomatik satıldı',customer:'Müşteriye teslim',lost:'Tam hasar'}[r.kind];}
function receipt09(id){const s=S.shipments.find(x=>String(x.id)===id&&x.done);if(!s)return toast('Makbuz bulunamadı.');const r=s.receipt09;modal('📋 Teslimat makbuzu',`<div class="receipt09"><h3>${country(s.from).f} ${country(s.from).n} → ${country(s.to).f} ${country(s.to).n}</h3><b>${product(s.p).e} ${product(s.p).n} · ${status09(s)}</b>${row06('Gönderilen',s.qty+' adet')}${row06('Teslim edilen',(s.delivered??s.qty)+' adet')}${row06('Hasar',(s.loss??0)+' adet')}${r?row06('Depoya eklenen',r.deposit+' adet')+row06('Satış / hizmet geliri',fmt(r.revenue))+row06('Sigorta tazminatı',fmt(r.comp))+row06('Toplam maliyet',fmt(r.basis))+row06('Gerçekleşen kâr',r.profit===null?'Satış bekleniyor':fmt(r.profit)):'<p class="note">Bu teslimat eski sürümde tamamlandı. Ayrıntılı makbuz kaydı yok; otomatik olarak yeniden stok eklenmez.</p>'}<p class="note">${s.customer?'Müşteri yükü şirket stokuna girmez.':s.autoSell?'Varışta satış seçilmiş; satılmış yük stokta görünmez.':'Depo mevcut stoğu gösterir; daha sonra satılan veya taşınan ürünler burada kalmaz.'}</p><button onclick="closeModal();depot09('${s.to}')">${country(s.to).n} deposunu aç</button></div>`);}
let shipFilter09='all';
function setShipFilter09(v){shipFilter09=v;render()}
shipping=()=>{const history=S.shipments.filter(s=>s.done&&(shipFilter09==='all'||(s.receipt09?.kind||'legacy')===shipFilter09)).sort((a,b)=>b.end-a.end).slice(0,30);return heading('Sevkiyat merkezi','Yoldaki yükler, teslimat makbuzları ve satış sonuçları.')+card('Yoldaki yükler · '+active().length,shipRows()+active().filter(s=>s.blocked09).map(s=>`<p class="note">⚠ ${esc(product(s.p)?.n||s.p)} · Teslimat işlenemedi, kayıt korunuyor.</p>`).join(''))+card('Teslimat geçmişi',`<select aria-label="Teslimat türü" onchange="setShipFilter09(this.value)">${[['all','Tümü'],['stock','Depoya ulaşan'],['sold','Otomatik satılan'],['customer','Müşteri kargosu'],['lost','Tam hasar'],['legacy','Eski teslimatlar']].map(([k,n])=>`<option value="${k}" ${shipFilter09===k?'selected':''}>${n}</option>`).join('')}</select>`+(history.length?history.map(s=>`<article class="receipt-list09"><div class="between"><b>${country(s.from).f} → ${country(s.to).f} ${country(s.to).n}</b><span class="pill ${s.receipt09?.kind==='lost'?'yellow':'green'}">${status09(s)}</span></div><p>${product(s.p).e} ${s.delivered??s.qty}/${s.qty} ${product(s.p).n}${s.receipt09?.revenue?' · '+fmt(s.receipt09.revenue):''}</p><div class="product-actions"><button onclick="receipt09('${s.id}')">Makbuz</button>${!s.customer?`<button class="ghost" onclick="depot09('${s.to}')">Depoya git</button>`:''}</div></article>`).join(''):empty('📋','Bu türde teslimat yok.')));};
const oldWarehouse09=warehouse;let warehouseNetwork09=true;
function toggleNetwork09(){warehouseNetwork09=!warehouseNetwork09;render()}
warehouse=()=>{let rows=C.map(c=>({c,stock:totalStock(c.id),incoming:pending(c.id)})).filter(x=>x.stock||x.incoming).sort((a,b)=>b.stock+b.incoming-a.stock-a.incoming);return card('🌍 Depo ağı',`<div class="between"><b>${rows.length} aktif ülke</b><button class="ghost" onclick="toggleNetwork09()">${warehouseNetwork09?'Gizle':'Göster'}</button></div>${warehouseNetwork09?rows.map(({c,stock,incoming})=>`<button class="depot09 ${warehouseCountry===c.id?'selected09':'ghost'}" onclick="depot09('${c.id}')"><span>${c.f} ${c.n}</span><small>${stock} stok · ${incoming} beklenen</small></button>`).join('')||'<p class="note">Henüz stok veya beklenen yük yok.</p>':''}`)+oldWarehouse09();};
const settings09=settings;settings=()=>settings09()+card('Bulut kaydı','<button onclick="saveNow09()">Şimdi kaydet</button><p class="note">Otomatik kayıt devam eder. Oyunu kapatmadan önce istersen kaydı elle tamamlayabilirsin.</p>');
// Every transfer leg must fit the load, not just the first vehicle.
function routeCap09(m,a,b){const legs=route05(m,a,b);return legs?.length?Math.min(...legs.map(l=>mode(l.kind).cap)):0}
const shipCore09=shipCore;shipCore=(a,b,p,q,m,insured,autoSell=false,at=Date.now())=>{if(q>routeCap09(m,a,b))return false;return shipCore09(a,b,p,q,m,insured,autoSell,at)};
const shipData09=shipData;shipData=(a,p)=>{const d=shipData09(a,p);d.ok=d.ok&&d.q<=routeCap09(d.m,a,d.b);return d};
const shipQuote09=shipQuote;shipQuote=(a,p)=>{shipQuote09(a,p);const d=shipData(a,p),limit=routeCap09(d.m,a,d.b);if(limit&&limit<mode(d.m).cap)document.getElementById('quote').insertAdjacentHTML('beforeend',`<p class="note">Aktarmadaki araç sınırı: ${limit} adet. Daha büyük yükü ayrı sevkiyatlara böl.</p>`)};
const packFinish09=finalizePacking;finalizePacking=ok=>{if(packing&&!packing.personal06&&packing.q>routeCap09(packing.m,packing.a,packing.b))return toast('Aktarma araç kapasitesi yetersiz. Yükü daha küçük parçalara böl.');return packFinish09(ok)};
