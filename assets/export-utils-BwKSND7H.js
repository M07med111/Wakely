import{c as s}from"./createLucideIcon-Dkvp0_iz.js";import{_ as d}from"./index-BpUjNH_1.js";const n=[["path",{d:"M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2",key:"143wyd"}],["path",{d:"M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6",key:"1itne7"}],["rect",{x:"6",y:"14",width:"12",height:"8",rx:"1",key:"1ue0tg"}]],p=s("printer",n);async function h(r,o){const t=await d(()=>import("./xlsx-CNerDvZX.js"),[]),e=t.utils.book_new();for(const i of o){const a=t.utils.json_to_sheet(i.rows);a["!views"]=[{RTL:!0}],t.utils.book_append_sheet(e,a,i.name.slice(0,31))}t.writeFile(e,`${r}.xlsx`)}function f(r,o="تقرير ميزان"){const t=document.getElementById(r);if(!t)return;const e=window.open("","_blank","width=1024,height=800");e&&(e.document.write(`<!doctype html><html lang="ar" dir="rtl"><head>
    <meta charset="utf-8"/>
    <title>${o}</title>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap"/>
    <style>
      body { font-family: Cairo, system-ui, sans-serif; padding: 24px; color: #111; background: #fff; }
      h1,h2,h3 { color: #8a6a00; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: right; font-size: 12px; }
      th { background: #f7eccb; }
      .glass-card, [class*="card"] { border: 1px solid #eee; border-radius: 8px; padding: 16px; margin-bottom: 12px; background: #fff; }
      .gold-text { color: #8a6a00; }
      .recharts-wrapper svg { background: #fff; }
      @media print { body { padding: 0; } }
    </style></head><body>
    <h1>${o}</h1>
    <div>${t.innerHTML}</div>
    <script>window.onload=()=>{setTimeout(()=>{window.print();},400);};<\/script>
  </body></html>`),e.document.close())}export{p as P,h as e,f as p};
