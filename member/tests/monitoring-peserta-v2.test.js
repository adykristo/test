// Jalankan dari root repo: node --test member/tests/monitoring-peserta-v2.test.js
const {test}=require("node:test");
const assert=require("node:assert/strict");
const {classifyMember}=require("../monitoring-peserta-v2.js");
const now=Date.parse("2026-10-09T09:00:00Z");
const member={id:"user-1",nama:"Peserta",jenjang:"SD",status:"aktif"};
const pkg={id:"paket-1",nama:"SD Paket 1",jenjang:"SD",durasi_hari:30};
const active={package_id:pkg.id,package_name:pkg.nama,status:"active",expires_at:"2026-11-01T00:00:00Z"};
const order={id:"ord-1",status:"approved",created_at:"2026-10-08T09:00:00Z"};
const items={"ord-1":[{package_id:pkg.id,package_name:pkg.nama}]};
const base={member,ownerships:[],orders:[],orderItems:{},catalog:[pkg],materialCounts:new Map([[pkg.id,1]]),now};
const cases=[
 ["Belum membeli bukan akun rusak",{}, "none"],
 ["Pending tidak otomatis diaktifkan",{orders:[{id:"ord-1",status:"pending"}]},"pending"],
 ["Transaksi disetujui tetapi akses hilang",{orders:[order],orderItems:items},"bad"],
 ["Transaksi lama tanpa bukti masa aktif",{orders:[{...order,created_at:"2025-01-01T00:00:00Z"}],orderItems:items},"review"],
 ["Hak paket valid",{ownerships:[active]},"normal"],
 ["Materi kosong bukan kesalahan kepemilikan",{ownerships:[active],materialCounts:new Map()},"warn"],
 ["Gagal baca ownership bukan nol paket",{ownershipError:"RPC unavailable"},"review"],
 ["Gagal baca pembayaran bukan belum membeli",{ordersError:"RPC unavailable"},"review"],
 ["Paket aktif dan transaksi disetujui",{ownerships:[active],orders:[order],orderItems:items},"normal"],
 ["Akses kedaluwarsa",{ownerships:[{...active,status:"expired",expires_at:"2026-09-01T00:00:00Z"}]},"expired"],
 ["Item pembayaran tidak terbaca",{orders:[order]},"review"],
 ["Jenjang salah",{ownerships:[active],member:{...member,jenjang:"SMA"}},"bad"],
 ["Materi tidak terbaca",{ownerships:[active],materialsError:"RLS denied"},"warn"],
 ["Akun nonaktif tetapi memiliki entitlement",{ownerships:[active],member:{...member,status:"nonaktif"}},"review"],
 ["Pemesanan baru sesudah kedaluwarsa",{ownerships:[{...active,status:"expired",expires_at:"2026-09-01T00:00:00Z"}],orders:[order],orderItems:items},"bad"],
 ["Pembelian dibatalkan",{orders:[{...order,status:"cancelled"}]},"none"]
];
for(const [name,overrides,expected] of cases){
 test(name,()=>{
   const result=classifyMember({...base,...overrides});
   assert.equal(result.status,expected);
   assert.equal(result.member.id,member.id);
   assert.equal(result.active.every(x=>x.status==="active"),true);
 });
}
