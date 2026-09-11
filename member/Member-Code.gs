/* MEMBER AREA BACKEND — deploy as a NEW Apps Script project (not Code.gs CBT). */
const MEMBER_SHEET_ID = PropertiesService.getScriptProperties().getProperty('MEMBER_SHEET_ID');
const ADMIN_KEY = PropertiesService.getScriptProperties().getProperty('MEMBER_ADMIN_KEY');
function doPost(e){try{return json_(route_(JSON.parse(e.postData.contents||'{}')))}catch(err){return json_({ok:false,error:err.message})}}
function doGet(){return json_({ok:true,service:'KlinikFisikapku Member API'})}
function route_(p){
  if(p.action==='register')return daftar_(p);
  if(p.action==='login')return login_(p);
  if(p.action==='session')return sesi_(p);
  if(p.action==='adminList')return adminList_(p);
  if(p.action==='adminActivate')return aktifkan_(p);
  if(p.action==='adminDelete')return hapus_(p);
  throw new Error('Aksi tidak dikenal.');
}
function ss_(){if(!MEMBER_SHEET_ID)throw new Error('MEMBER_SHEET_ID belum diatur di Script Properties.');return SpreadsheetApp.openById(MEMBER_SHEET_ID)}
function sheet_(n,h){const s=ss_();let sh=s.getSheetByName(n);if(!sh){sh=s.insertSheet(n);sh.appendRow(h)}return sh}
function members_(){return sheet_('Members',['id','nama','wa','email','username','password_hash','jenjang','sekolah','status','dibuat'])}
function sessions_(){return sheet_('Sessions',['token_hash','member_id','berakhir'])}
function rows_(sh){const v=sh.getDataRange().getValues(),h=v.shift();return v.map((r,i)=>Object.fromEntries(h.map((x,j)=>[x,r[j]]),{_row:i+2}))}
function sha_(x){const b=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(x),Utilities.Charset.UTF_8);return b.map(x=>('0'+(x&255).toString(16)).slice(-2)).join('')}
function id_(){return Utilities.getUuid()}
function cek_(v,n){if(!String(v||'').trim())throw new Error(n+' wajib diisi.')}
function daftar_(p){['nama','wa','email','username','password','jenjang','sekolah'].forEach(x=>cek_(p[x],x));if(String(p.password).length<8)throw new Error('Password minimal 8 karakter.');const sh=members_(),a=rows_(sh);if(a.some(x=>String(x.username).toLowerCase()===String(p.username).toLowerCase()))throw new Error('Username sudah digunakan.');if(a.some(x=>String(x.email).toLowerCase()===String(p.email).toLowerCase()))throw new Error('Email sudah terdaftar.');sh.appendRow([id_(),p.nama,p.wa,String(p.email).toLowerCase(),String(p.username).toLowerCase(),sha_(p.password),String(p.jenjang).toLowerCase(),p.sekolah,'menunggu',new Date()]);return {ok:true,message:'Pendaftaran diterima. Tunggu aktivasi admin.'}}
function login_(p){cek_(p.username,'Username');cek_(p.password,'Password');const m=rows_(members_()).find(x=>String(x.username).toLowerCase()===String(p.username).toLowerCase()&&x.password_hash===sha_(p.password));if(!m)throw new Error('Username atau password salah.');if(m.status!=='aktif')throw new Error('Akun belum aktif.');const raw=id_()+id_(),akhir=new Date(Date.now()+1000*60*60*12);sessions_().appendRow([sha_(raw),m.id,akhir]);return {ok:true,token:raw,member:profil_(m)}}
function sesi_(p){const raw=String(p.token||''),s=rows_(sessions_()).find(x=>x.token_hash===sha_(raw)&&new Date(x.berakhir)>new Date());if(!s)throw new Error('Sesi tidak valid atau telah berakhir.');const m=rows_(members_()).find(x=>x.id===s.member_id&&x.status==='aktif');if(!m)throw new Error('Akses tidak tersedia.');return {ok:true,member:profil_(m)}}
function admin_(p){if(!ADMIN_KEY||p.adminKey!==ADMIN_KEY)throw new Error('Admin tidak sah.')}
function adminList_(p){admin_(p);return {ok:true,members:rows_(members_()).map(profil_)}}
function aktifkan_(p){admin_(p);const sh=members_(),m=rows_(sh).find(x=>x.id===p.id);if(!m)throw new Error('Peserta tidak ditemukan.');sh.getRange(m._row,9).setValue(p.status==='aktif'?'aktif':'menunggu');return {ok:true}}
function hapus_(p){admin_(p);const sh=members_(),m=rows_(sh).find(x=>x.id===p.id);if(!m)throw new Error('Peserta tidak ditemukan.');sh.deleteRow(m._row);return {ok:true}}
function profil_(m){return {id:m.id,nama:m.nama,wa:m.wa,email:m.email,username:m.username,kelas:m.jenjang,sekolah:m.sekolah,status:m.status,aktif:m.status==='aktif'}}
function json_(x){return ContentService.createTextOutput(JSON.stringify(x)).setMimeType(ContentService.MimeType.JSON)}
